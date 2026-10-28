#!/usr/bin/env python3
"""Fail on Vale findings newly introduced in changed Markdown files."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path


FINGERPRINT_FIELDS = ("Check", "Severity", "Message", "Match")


def fingerprint(alert: dict) -> tuple[str, ...]:
    return tuple(str(alert.get(field, "")) for field in FINGERPRINT_FIELDS)


def new_findings(current: list[dict], baseline: list[dict]) -> list[dict]:
    """Return current alerts beyond the baseline, ignoring line movement."""
    remaining = Counter(fingerprint(alert) for alert in baseline)
    additions = []
    for alert in current:
        key = fingerprint(alert)
        if remaining[key]:
            remaining[key] -= 1
        else:
            additions.append(alert)
    return additions


def changed_markdown(base: str | None, root: Path) -> dict[str, str | None]:
    """Map each changed Markdown path to its previous path, if any."""
    if base is None:
        output = subprocess.run(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "*.md"],
            cwd=root,
            check=True,
            capture_output=True,
        ).stdout
        return {
            name.decode(): None
            for name in output.split(b"\0")
            if name and name.decode().lower().endswith(".md")
        }

    output = subprocess.run(
        ["git", "diff", "--name-status", "--find-renames", "-z", base, "--", "*.md"],
        cwd=root,
        check=True,
        capture_output=True,
    ).stdout.split(b"\0")

    changed: dict[str, str | None] = {}
    index = 0
    while index < len(output) and output[index]:
        status = output[index].decode()
        index += 1
        if status.startswith(("R", "C")):
            previous = output[index].decode()
            current = output[index + 1].decode()
            index += 2
        else:
            previous = current = output[index].decode()
            index += 1
            if status.startswith("A"):
                previous = ""
            elif status.startswith("D"):
                continue

        if current.lower().endswith(".md"):
            changed[current] = previous if previous.lower().endswith(".md") else None

    untracked = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard", "-z", "--", "*.md"],
        cwd=root,
        check=True,
        capture_output=True,
    ).stdout
    for name in untracked.split(b"\0"):
        if name and name.decode().lower().endswith(".md"):
            changed[name.decode()] = None
    return changed


def vale_rules_changed(base: str, root: Path) -> bool:
    changed = subprocess.run(
        ["git", "diff", "--name-only", "-z", base, "--", ".vale.ini", ".vale/styles"],
        cwd=root,
        check=True,
        capture_output=True,
    ).stdout
    untracked = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard", "-z", "--", ".vale.ini", ".vale/styles"],
        cwd=root,
        check=True,
        capture_output=True,
    ).stdout
    return bool(changed or untracked)


def vale_alerts(paths: list[Path], root: Path) -> dict[Path, list[dict]]:
    if not paths:
        return {}
    command = [
        "vale",
        f"--config={root / '.vale.ini'}",
        "--output=JSON",
        "--no-exit",
        *(str(path) for path in paths),
    ]
    result = subprocess.run(command, cwd=root, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or f"Vale exited with status {result.returncode}")
    try:
        output = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        detail = result.stderr.strip() or result.stdout[:500]
        raise RuntimeError(f"Vale did not return JSON: {detail}") from error

    alerts_by_path: dict[Path, list[dict]] = {}
    for name, alerts in output.items():
        path = Path(name)
        if not path.is_absolute():
            path = root / path
        alerts_by_path[path.resolve()] = alerts
    return alerts_by_path


def git_file(ref: str, path: str, root: Path) -> bytes:
    return subprocess.run(
        ["git", "show", f"{ref}:{path}"],
        cwd=root,
        check=True,
        capture_output=True,
    ).stdout


def report_finding(path: str, alert: dict) -> None:
    line = alert.get("Line", 1)
    check = alert.get("Check", "Vale")
    message = alert.get("Message", "New Vale finding")
    if os.environ.get("GITHUB_ACTIONS") == "true":
        escape = lambda value: value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
        escaped_path = escape(path).replace(":", "%3A").replace(",", "%2C")
        escaped_check = escape(check).replace(":", "%3A").replace(",", "%2C")
        print(f"::error file={escaped_path},line={line},title={escaped_check}::{escape(message)}")
    else:
        print(f"{path}:{line}: {alert.get('Severity', 'suggestion')} [{check}] {message}")


def check(base: str | None, root: Path) -> int:
    if base is not None and vale_rules_changed(base, root):
        raise RuntimeError(
            "Vale configuration changed; run a full Vale review before comparing against the existing baseline."
        )

    changed = changed_markdown(base, root)
    if not changed:
        print("No changed Markdown files to lint.")
        return 0

    current_paths = [root / path for path in changed]
    symlinks = [path for path in current_paths if path.is_symlink()]
    if symlinks:
        names = ", ".join(str(path.relative_to(root)) for path in symlinks)
        raise RuntimeError(f"Refusing to lint symlinked Markdown files: {names}")
    current_alerts = vale_alerts(current_paths, root)
    new_alerts: list[tuple[str, dict]] = []

    with tempfile.TemporaryDirectory(prefix="vale-baseline-") as temp_name:
        temp_root = Path(temp_name)
        baseline_paths: dict[str, Path] = {}
        for current, previous in changed.items():
            if previous is None or base is None:
                continue
            baseline_path = temp_root / previous
            baseline_path.parent.mkdir(parents=True, exist_ok=True)
            baseline_path.write_bytes(git_file(base, previous, root))
            baseline_paths[current] = baseline_path

        baseline_alerts = vale_alerts(list(baseline_paths.values()), root)

        for current, previous in changed.items():
            path = (root / current).resolve()
            found = current_alerts.get(path, [])
            baseline = []
            if previous is not None and current in baseline_paths:
                baseline = baseline_alerts.get(baseline_paths[current].resolve(), [])
            new_alerts.extend((current, alert) for alert in new_findings(found, baseline))

    if not new_alerts:
        print(f"No new Vale findings in {len(changed)} changed Markdown file(s).")
        return 0

    for path, alert in new_alerts:
        report_finding(path, alert)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base", help="base Git revision (use '-' when no baseline exists)")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    base = None if args.base == "-" or set(args.base) == {"0"} else args.base
    try:
        return check(base, root)
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Vale changed-file check failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
