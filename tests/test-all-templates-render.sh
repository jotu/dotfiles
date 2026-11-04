#!/usr/bin/env bash
# Render every Chezmoi template for each supported OS to catch syntax and data errors.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
command -v chezmoi >/dev/null 2>&1 || { echo "ERROR: chezmoi is required." >&2; exit 1; }

command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required." >&2; exit 1; }

# Fixture data keeps the test independent of ~/.config/chezmoi/chezmoi.toml.
fixture=tests/fixtures/chezmoi-data.json

failures=0
while IFS= read -r -d '' file; do
  for os in darwin linux; do
    data="$(jq -c --arg os "$os" --arg src "$repo_root" \
      '. + {chezmoi: {os: $os, arch: "arm64", sourceDir: $src}}' "$fixture")"
    if ! chezmoi --config /dev/null --config-format toml execute-template --override-data "$data" \
      --file "$file" >/dev/null 2>&1; then
      printf 'FAIL: %s does not render for %s\n' "$file" "$os" >&2
      failures=$((failures + 1))
    fi
  done
done < <(git ls-files -z -- '*.tmpl' ':!:.chezmoitemplates')

[[ $failures -eq 0 ]] || exit 1
echo "All templates render for darwin and linux."
