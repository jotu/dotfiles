#!/bin/bash
# Test the retired multiplexer cleanup without invoking the real Mise.
set -eu
repo=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/home/.config/herdr/session-snapshots"
export HOME="$tmp/home"
mkdir -p "$HOME/.config/tuios" "$HOME/.agents/skills/tuios" "$HOME/Library/Application Support/tuios/sessions"
printf 'session\n' > "$HOME/Library/Application Support/tuios/sessions/session-0.json"
mkdir -p "$HOME/Library/Application Support/tuios/sessions/scrollback/session-0"
printf 'scrollback\n' > "$HOME/Library/Application Support/tuios/sessions/scrollback/session-0/test.hist.gz"
printf 'retired\n' > "$HOME/.config/tuios/config.toml"
printf 'retired\n' > "$HOME/.agents/skills/tuios/SKILL.md"
printf 'socket target\n' > "$tmp/socket-target"
ln -s "$tmp/socket-target" "$HOME/.config/herdr/herdr.sock.agent"
printf 'snapshot\n' > "$HOME/.config/herdr/session-snapshots/session-test.json"
printf 'keep\n' > "$HOME/.config/herdr/session-snapshots/unrelated.txt"
cat > "$tmp/bin/mise" <<'MOCK'
#!/bin/bash
case "$1" in
  ls) [ -z "${TRACE:-}" ] || printf 'ls\n' >> "$TRACE"
  case "${MODE:-installed}" in
    installed) echo installed ;;
    absent) : ;;
    failure) exit 1 ;;
    uninstall_failure) echo installed ;;
  esac ;;
  uninstall)
    [ "${MODE:-installed}" != uninstall_failure ] || exit 1
    printf '%s\n' "$*" >> "$CALLS" ;;
  *) exit 1 ;;
esac
MOCK
chmod +x "$tmp/bin/mise"
# shellcheck disable=SC2016 # The mock expands variables at runtime.
printf '#!/bin/sh\n[ "${PGREP_ERROR:-no}" != yes ] || exit 2\n[ "${RUNNING:-no}" = yes ]\n' > "$tmp/bin/pgrep"
chmod +x "$tmp/bin/pgrep"
# shellcheck disable=SC2016 # The mock expands variables at runtime.
printf '#!/bin/sh\n[ "${FIND_FAIL:-no}" != yes ] || exit 1\nexec /usr/bin/find "$@"\n' > "$tmp/bin/find"
chmod +x "$tmp/bin/find"
chezmoi execute-template < "$repo/run_once_after_remove-retired-multiplexers.sh.tmpl" > "$tmp/cleanup"
CALLS="$tmp/calls" PATH="$tmp/bin:$PATH" bash "$tmp/cleanup" 2> "$tmp/stderr"
grep -Fx 'uninstall --all --yes herdr' "$tmp/calls" >/dev/null
grep -Fx 'uninstall --all --yes go:github.com/Gaurav-Gosain/tuios/cmd/tuios' "$tmp/calls" >/dev/null
grep -F 'Git worktrees' "$tmp/stderr" >/dev/null
test ! -e "$HOME/Library/Application Support/tuios/sessions/session-0.json"
test ! -e "$HOME/Library/Application Support/tuios/sessions/scrollback/session-0/test.hist.gz"
test ! -e "$HOME/.config/tuios/config.toml"
test ! -e "$HOME/.agents/skills/tuios/SKILL.md"
test ! -L "$HOME/.config/herdr/herdr.sock.agent"
test -f "$tmp/socket-target"
test ! -e "$HOME/.config/herdr/session-snapshots/session-test.json"
test -e "$HOME/.config/herdr/session-snapshots/unrelated.txt"
mkdir -p "$tmp/external"
printf 'external\n' > "$tmp/external/config.toml"
mv "$HOME/Library/Application Support/tuios" "$tmp/original-tuios"
ln -s "$tmp/external" "$HOME/Library/Application Support/tuios"
git -C "$HOME/.config/tuios" init -q
printf 'worktree data\n' > "$HOME/.config/tuios/config.toml"
git -C "$HOME/.config/herdr/session-snapshots" init -q
printf 'worktree data\n' > "$HOME/.config/herdr/session-snapshots/session-keep.json"
if MODE=absent CALLS="$tmp/calls" PATH="$tmp/bin:$PATH" bash "$tmp/cleanup" 2> "$tmp/stderr"; then
  echo 'cleanup must fail when paths are skipped' >&2
  exit 1
fi
grep -F 'Cleanup incomplete' "$tmp/stderr" >/dev/null
test -e "$HOME/.config/herdr/session-snapshots/session-keep.json"
grep -F 'Skipping potentially unsafe snapshot directory' "$tmp/stderr" >/dev/null
test -e "$HOME/.config/tuios/config.toml"
test -e "$tmp/external/config.toml"
# A broken Git marker must also be treated as potentially containing worktrees.
mkdir -p "$HOME/.agents/skills/tuios"
printf 'gitdir: /missing\n' > "$HOME/.agents/skills/tuios/.git"
printf 'worktree data\n' > "$HOME/.agents/skills/tuios/SKILL.md"
if MODE=absent CALLS="$tmp/calls" PATH="$tmp/bin:$PATH" bash "$tmp/cleanup" 2> "$tmp/stderr"; then
  echo 'cleanup must fail when a Git marker is present' >&2
  exit 1
fi
test -e "$HOME/.agents/skills/tuios/SKILL.md"
rm "$tmp/calls"
mkdir -p "$tmp/nested-home/Library/Application Support/tuios/sessions/worktree"
nested="$tmp/nested-home/Library/Application Support/tuios/sessions/worktree"
git -C "$nested" init -q
printf 'uncommitted\n' > "$nested/keep.txt"
if HOME="$tmp/nested-home" MODE=absent CALLS="$tmp/calls" PATH="$tmp/bin:$PATH" bash "$tmp/cleanup" 2> "$tmp/stderr"; then
  echo 'cleanup must fail when a nested worktree is present' >&2
  exit 1
fi
test -f "$nested/keep.txt"
test -d "$nested/.git"
if HOME="$tmp/nested-home" FIND_FAIL=yes MODE=absent CALLS="$tmp/calls" PATH="$tmp/bin:$PATH" bash "$tmp/cleanup" 2> "$tmp/stderr"; then
  echo 'cleanup must fail when session traversal fails' >&2
  exit 1
fi
grep -F 'Failed to inspect session directory' "$tmp/stderr" >/dev/null
mkdir -p "$tmp/link-home/.config/herdr/session-snapshots"
ln -s /missing "$tmp/link-home/.config/herdr/session-snapshots/session-link.json"
if HOME="$tmp/link-home" MODE=absent CALLS="$tmp/calls" PATH="$tmp/bin:$PATH" bash "$tmp/cleanup" 2> "$tmp/stderr"; then
  echo 'cleanup must fail for a snapshot symlink' >&2
  exit 1
fi
grep -F 'Skipping potentially unsafe path' "$tmp/stderr" >/dev/null
mkdir -p "$tmp/empty-home"
export HOME="$tmp/empty-home"
MODE=absent CALLS="$tmp/calls" PATH="$tmp/bin:$PATH" bash "$tmp/cleanup" 2> "$tmp/stderr"
test ! -e "$tmp/calls"
if RUNNING=yes CALLS="$tmp/calls" PATH="$tmp/bin:$PATH" bash "$tmp/cleanup" 2> "$tmp/stderr"; then
  echo 'cleanup must fail while a multiplexer is running' >&2
  exit 1
fi
if PGREP_ERROR=yes CALLS="$tmp/calls" PATH="$tmp/bin:$PATH" bash "$tmp/cleanup" 2> "$tmp/stderr"; then
  echo 'cleanup must fail when process detection fails' >&2
  exit 1
fi
if MODE=failure CALLS="$tmp/calls" PATH="$tmp/bin:$PATH" bash "$tmp/cleanup" 2> "$tmp/stderr"; then
  echo 'cleanup must fail when mise ls fails' >&2
  exit 1
fi
if MODE=uninstall_failure CALLS="$tmp/calls" PATH="$tmp/bin:$PATH" bash "$tmp/cleanup" 2> "$tmp/stderr"; then
  echo 'cleanup must fail when uninstall fails' >&2
  exit 1
fi

# Exercise Chezmoi's actual run-once state in an isolated source and home.
mkdir -p "$tmp/source" "$tmp/destination"
cp "$repo/run_once_after_remove-retired-multiplexers.sh.tmpl" "$tmp/source/"
export HOME="$tmp/destination" PATH="$tmp/bin:$PATH" CALLS="$tmp/calls" TRACE="$tmp/trace"
chezmoi_args=(--config /dev/null --config-format toml --source "$tmp/source" --destination "$HOME" --persistent-state "$tmp/state" --cache "$tmp/cache" --override-data '{"chezmoi":{"os":"darwin"}}')
if MODE=failure chezmoi "${chezmoi_args[@]}" apply > "$tmp/apply-output" 2>&1; then
  echo 'chezmoi apply must fail when cleanup fails' >&2
  exit 1
fi
MODE=absent chezmoi "${chezmoi_args[@]}" apply > "$tmp/apply-output" 2>&1
count=$(wc -l < "$TRACE")
[ "$count" -eq 3 ] || { echo 'failed cleanup must be retried successfully' >&2; exit 1; }
MODE=absent chezmoi "${chezmoi_args[@]}" apply > "$tmp/apply-output" 2>&1
[ "$(wc -l < "$TRACE")" -eq "$count" ] || { echo 'successful cleanup must run once' >&2; exit 1; }
