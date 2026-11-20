#!/usr/bin/env bash
# Exercise bundled subagent discovery and refresh in an isolated home.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
installer="$repo_root/dot_config/mise/scripts/executable_install-pi-subagent"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
home="$tmp_dir/home"
bin="$tmp_dir/bin"
target="$home/.pi/agent/extensions/subagent"
mkdir -p "$home" "$bin"
# Shadow host installations so discovery cannot escape the fixture.
printf '#!/bin/sh\nexit 1\n' >"$bin/mise"
printf '#!/bin/sh\nexit 0\n' >"$bin/pi"
chmod +x "$bin/mise" "$bin/pi"

make_source() {
  local directory="$1" marker="$2"
  mkdir -p "$directory"
  printf '%s index\n' "$marker" >"$directory/index.ts"
  printf '%s agents\n' "$marker" >"$directory/agents.ts"
}

# A missing source leaves an existing installation alone.
mkdir -p "$target"
printf 'keep\n' >"$target/local.ts"
env -i HOME="$home" PATH="$bin:/usr/bin:/bin" bash "$installer" 2>"$tmp_dir/skip.log"
grep -q 'source not found; skipping sync' "$tmp_dir/skip.log"
test "$(<"$target/local.ts")" = keep

# An explicit Mise install path takes precedence and replaces the old contents.
root="$tmp_dir/install"
make_source "$root/examples/extensions/subagent" explicit
mkdir -p "$root/examples/extensions/subagent/lib"
printf 'support\n' >"$root/examples/extensions/subagent/lib/format.ts"
mkdir -p "$tmp_dir/mise-source/examples/extensions/subagent"
make_source "$tmp_dir/mise-source/examples/extensions/subagent" mise
printf '#!/bin/sh\n[ "$#" -eq 2 ] && [ "$1" = where ] && [ "$2" = npm:@earendil-works/pi-coding-agent ] || exit 1\nprintf "%%s\\n" "$FAKE_MISE_ROOT"\n' >"$bin/mise"
chmod +x "$bin/mise"
(umask 002; env -i HOME="$home" PATH="$bin:/usr/bin:/bin" MISE_TOOL_INSTALL_PATH="$root" \
  FAKE_MISE_ROOT="$tmp_dir/mise-source" bash "$installer")
test -z "$(find "$target" -prune -perm -020 -print)"
test "$(<"$target/index.ts")" = 'explicit index'
test "$(<"$target/agents.ts")" = 'explicit agents'
test "$(<"$target/lib/format.ts")" = 'support'
test ! -e "$target/local.ts"

# Missing or unreadable upstream content must not destroy the installed extension.
incomplete="$tmp_dir/incomplete"
incomplete_source="$incomplete/examples/extensions/subagent"
mkdir -p "$incomplete_source"
expect_source_rejected() {
  if env -i HOME="$home" PATH="$bin:/usr/bin:/bin" MISE_TOOL_INSTALL_PATH="$incomplete" \
    FAKE_MISE_ROOT="$tmp_dir/missing" bash "$installer" >"$tmp_dir/incomplete.log" 2>&1; then
    printf 'Incomplete or unreadable source must fail.\n' >&2
    exit 1
  fi
  test "$(<"$target/index.ts")" = 'explicit index'
  test "$(<"$target/agents.ts")" = 'explicit agents'
}
printf 'index\n' >"$incomplete_source/index.ts"
expect_source_rejected
rm "$incomplete_source/index.ts"
printf 'agents\n' >"$incomplete_source/agents.ts"
expect_source_rejected
printf 'index\n' >"$incomplete_source/index.ts"
chmod 000 "$incomplete_source/agents.ts"
if [ ! -r "$incomplete_source/agents.ts" ]; then expect_source_rejected; fi
chmod u+rw "$incomplete_source/agents.ts"

# A copy failure must leave the existing installation intact.
printf '#!/bin/sh\nexit 1\n' >"$bin/cp"
chmod +x "$bin/cp"
if env -i HOME="$home" PATH="$bin:/usr/bin:/bin" MISE_TOOL_INSTALL_PATH="$root" \
  bash "$installer" >"$tmp_dir/copy-failed.log" 2>&1; then
  printf 'A failed source copy must fail the sync.\n' >&2
  exit 1
fi
test "$(<"$target/index.ts")" = 'explicit index'
test "$(<"$target/lib/format.ts")" = 'support'
rm "$bin/cp"

# A source copy must not expose a second extension to Pi's discovery.
printf '%s\n' '#!/bin/sh' '/bin/cp "$@" || exit' \
  'for dir in "$HOME"/.pi/agent/extensions/* "$HOME"/.pi/agent/extensions/.[!.]* "$HOME"/.pi/agent/extensions/..?*; do' \
  '  if [ -f "$dir/index.ts" ] && [ "$dir" != "$HOME/.pi/agent/extensions/subagent" ]; then exit 1; fi' \
  'done' >"$bin/cp"
chmod +x "$bin/cp"
env -i HOME="$home" PATH="$bin:/usr/bin:/bin" MISE_TOOL_INSTALL_PATH="$root" bash "$installer"
rm "$bin/cp"

# An explicit install path must not silently fall back to another version.
nested="$tmp_dir/nested"
make_source "$nested/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/subagent" nested
if env -i HOME="$home" PATH="$bin:/usr/bin:/bin" MISE_TOOL_INSTALL_PATH="$tmp_dir/missing" \
  FAKE_MISE_ROOT="$nested" bash "$installer" >"$tmp_dir/explicit-missing.log" 2>&1; then
  printf 'A missing explicit source must fail instead of selecting another installation.\n' >&2
  exit 1
fi
test "$(<"$target/index.ts")" = 'explicit index'
test "$(<"$target/agents.ts")" = 'explicit agents'

# Manual sync may fall back to the npm-nested layout reported by Mise.
env -i HOME="$home" PATH="$bin:/usr/bin:/bin" FAKE_MISE_ROOT="$nested" bash "$installer"
test "$(<"$target/index.ts")" = 'nested index'
test "$(<"$target/agents.ts")" = 'nested agents'

# Finally, find the bundled source relative to the pi executable.
pi_root="$tmp_dir/pi"
make_source "$pi_root/examples/extensions/subagent" executable
mkdir -p "$pi_root/bin"
printf '#!/bin/sh\nexit 0\n' >"$pi_root/bin/pi"
chmod +x "$pi_root/bin/pi"
env -i HOME="$home" PATH="$pi_root/bin:$bin:/usr/bin:/bin" FAKE_MISE_ROOT="$tmp_dir/missing" bash "$installer"
test "$(<"$target/index.ts")" = 'executable index'
test "$(<"$target/agents.ts")" = 'executable agents'

# When a resolver exists, the fallback also follows a symlink to Pi.
rm "$bin/pi"
ln -s "$pi_root/bin/pi" "$bin/pi"
if PATH="$bin:/usr/bin:/bin" bash -c 'if command -v realpath >/dev/null; then realpath "$1"; else readlink -f "$1"; fi' _ "$bin/pi" >/dev/null 2>&1; then
  printf 'stale\n' >"$target/index.ts"
  env -i HOME="$home" PATH="$bin:/usr/bin:/bin" FAKE_MISE_ROOT="$tmp_dir/missing" bash "$installer"
  test "$(<"$target/index.ts")" = 'executable index'
  test "$(<"$target/agents.ts")" = 'executable agents'
fi

# A bundled npm executable resolves below the package root, not directly in bin/.
package_root="$tmp_dir/package"
make_source "$package_root/examples/extensions/subagent" bundled
mkdir -p "$package_root/dist/bundle"
printf '#!/bin/sh\nexit 0\n' >"$package_root/dist/bundle/cli.js"
chmod +x "$package_root/dist/bundle/cli.js"
rm "$bin/pi"
ln -s "$package_root/dist/bundle/cli.js" "$bin/pi"
if PATH="$bin:/usr/bin:/bin" bash -c 'if command -v realpath >/dev/null; then realpath "$1"; else readlink -f "$1"; fi' _ "$bin/pi" >/dev/null 2>&1; then
  env -i HOME="$home" PATH="$bin:/usr/bin:/bin" FAKE_MISE_ROOT="$tmp_dir/missing" bash "$installer"
  test "$(<"$target/index.ts")" = 'bundled index'
fi

printf 'Pi subagent installer checks passed.\n'
