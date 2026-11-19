#!/usr/bin/env bash
# Exercise the explicit legacy plan-mode cleanup without touching the real home.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cleanup="$repo_root/dot_config/mise/scripts/executable_remove-pi-plan-mode"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
home="$tmp_dir/home"
extensions="$home/.pi/agent/extensions"
installer="$home/.config/mise/scripts/install-pi-plan-mode"
mkdir -p "$extensions/plan-mode" "$extensions/subagent" "$(dirname "$installer")"
printf 'legacy extension\n' >"$extensions/plan-mode/index.ts"
printf 'keep subagent\n' >"$extensions/subagent/index.ts"
printf 'legacy installer\n' >"$installer"

# Declining must preserve both legacy files and unrelated extensions.
printf 'no\n' | HOME="$home" bash "$cleanup" >"$tmp_dir/declined.log"
test -f "$extensions/plan-mode/index.ts"
test -f "$installer"
test -f "$extensions/subagent/index.ts"

# Explicit confirmation removes only the named legacy paths and is repeatable.
printf 'remove\n' | HOME="$home" bash "$cleanup" >"$tmp_dir/removed.log"
test ! -e "$extensions/plan-mode"
test ! -e "$installer"
test -f "$extensions/subagent/index.ts"
HOME="$home" bash "$cleanup" </dev/null >"$tmp_dir/repeat.log"

# A symlinked target is not treated as an owned installation.
mkdir -p "$tmp_dir/outside"
printf 'keep\n' >"$tmp_dir/outside/index.ts"
ln -s "$tmp_dir/outside" "$extensions/plan-mode"
printf 'legacy installer\n' >"$installer"
if printf 'remove\n' | HOME="$home" bash "$cleanup" >"$tmp_dir/symlink.log" 2>&1; then
  printf 'Symlinked targets must fail closed.\n' >&2
  exit 1
fi
test -L "$extensions/plan-mode"
test -f "$tmp_dir/outside/index.ts"
test -f "$installer"
rm "$extensions/plan-mode"

# Unknown files and nested directories are preserved, even after confirmation.
mkdir -p "$extensions/plan-mode/custom"
printf 'keep custom\n' >"$extensions/plan-mode/custom/notes"
if printf 'remove\n' | HOME="$home" bash "$cleanup" >"$tmp_dir/custom.log" 2>&1; then
  printf 'Unexpected plan-mode content must fail closed.\n' >&2
  exit 1
fi
test -f "$extensions/plan-mode/custom/notes"
test -f "$installer"

# Failed inspection must never proceed to deletion.
error_home="$tmp_dir/error-home"
mkdir -p "$error_home/.pi/agent/extensions/plan-mode" "$tmp_dir/fail-bin"
printf 'keep\n' >"$error_home/.pi/agent/extensions/plan-mode/index.ts"
printf '#!/usr/bin/env bash\nexit 1\n' >"$tmp_dir/fail-bin/cksum"
chmod +x "$tmp_dir/fail-bin/cksum"
if printf 'remove\n' | HOME="$error_home" PATH="$tmp_dir/fail-bin:$PATH" \
  bash "$cleanup" >"$tmp_dir/inspection-error.log" 2>&1; then
  printf 'A failed inspection must fail closed.\n' >&2
  exit 1
fi
test -f "$error_home/.pi/agent/extensions/plan-mode/index.ts"

# The documented Mise entry point forwards the interactive confirmation.
mkdir -p "$tmp_dir/task" "$tmp_dir/mise-state"
awk '/^\[tasks\."pi:plan-mode:remove"\]$/ {copy=1} copy && /^$/ {exit} copy {print}' \
  "$repo_root/dot_config/mise/conf.d/00-base.toml.tmpl" >"$tmp_dir/task/mise.toml"
task_home="$tmp_dir/task-home"
mkdir -p "$task_home/.pi/agent/extensions/plan-mode" "$task_home/.config/mise/scripts"
cp "$cleanup" "$task_home/.config/mise/scripts/remove-pi-plan-mode"
printf 'legacy\n' >"$task_home/.pi/agent/extensions/plan-mode/index.ts"
printf 'remove\n' | HOME="$task_home" XDG_CONFIG_HOME="$task_home/.config" \
  XDG_CACHE_HOME="$tmp_dir/mise-state" XDG_DATA_HOME="$tmp_dir/mise-state" \
  XDG_STATE_HOME="$tmp_dir/mise-state" MISE_TRUSTED_CONFIG_PATHS="$tmp_dir/task" \
  mise -C "$tmp_dir/task" run --raw pi:plan-mode:remove >"$tmp_dir/mise-task.log" 2>&1
test ! -e "$task_home/.pi/agent/extensions/plan-mode"

# The Chezmoi hook continues to sync subagents and never runs cleanup or plan sync.
mkdir -p "$tmp_dir/bin"
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$*" >>"$FAKE_MISE_LOG"\n' >"$tmp_dir/bin/mise"
printf '#!/usr/bin/env bash\nexit 0\n' >"$tmp_dir/bin/pi"
chmod +x "$tmp_dir/bin/mise" "$tmp_dir/bin/pi"
hook_home="$tmp_dir/hook-home"
mkdir -p "$hook_home"
FAKE_MISE_LOG="$tmp_dir/mise.log" HOME="$hook_home" PATH="$tmp_dir/bin:$PATH" \
  bash "$repo_root/run_onchange_after_sync-pi-subagent.sh.tmpl"
test "$(<"$tmp_dir/mise.log")" = 'run pi:subagent:sync'
mkdir -p "$hook_home/.pi/agent/extensions/subagent"
printf 'preserve\n' >"$hook_home/.pi/agent/extensions/subagent/local.ts"
FAKE_MISE_LOG="$tmp_dir/mise.log" HOME="$hook_home" PATH="$tmp_dir/bin:$PATH" \
  bash "$repo_root/run_onchange_after_sync-pi-subagent.sh.tmpl"
test "$(wc -l <"$tmp_dir/mise.log" | tr -d ' ')" = 1
test -f "$hook_home/.pi/agent/extensions/subagent/local.ts"

printf 'Pi plan-mode cleanup and subagent sync checks passed.\n'
