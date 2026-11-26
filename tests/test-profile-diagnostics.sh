#!/usr/bin/env bash
# Exercise rendered diagnostics with fake tools, identities, and credentials.
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/home/.ssh" "$tmp/home/work" "$tmp/home/personal"
touch "$tmp/home/.ssh/id_personal" "$tmp/home/.ssh/id_org"
for tool in mise aerospace; do
  printf '#!/bin/sh\nexit 0\n' >"$tmp/bin/$tool"
done
printf '#!/bin/sh\necho "256 SHA256:fixture"\n' >"$tmp/bin/ssh-add"
cat >"$tmp/bin/gh" <<'MOCK'
#!/bin/sh
set -eu
[ "$*" = 'auth status --hostname github.com' ]
[ -z "${GH_TOKEN+x}" ] && [ -z "${GITHUB_TOKEN+x}" ]
printf '%s\n' "$GH_CONFIG_DIR" >>"$TEST_GH_LOG"
case "$GH_CONFIG_DIR" in
  "$HOME/.config/gh-personal") ;;
  "$HOME/.config/gh-work") [ "$TEST_WORK" = true ] ;;
  *) exit 1 ;;
esac
MOCK
chmod +x "$tmp/bin/"*
for work in true false; do
  data=$(jq -c --argjson work "$work" '.work.enable = $work' "$repo_root/tests/fixtures/chezmoi-data.json")
  chezmoi --config /dev/null --config-format toml execute-template --override-data "$data" \
    --file "$repo_root/dot_config/mise/conf.d/00-base.toml.tmpl" >"$tmp/base.toml"
  chezmoi --config /dev/null --config-format toml execute-template --with-stdin \
    '{{ .chezmoi.stdin | fromToml | toJson }}' <"$tmp/base.toml" >"$tmp/base.json"
  # Personal profiles require oMLX; work profiles must not require it.
  rm -f "$tmp/bin/omlx"
  if [ "$work" = false ]; then
    printf '#!/bin/sh\nexit 0\n' >"$tmp/bin/omlx"
    chmod +x "$tmp/bin/omlx"
  fi
  for task in dotfiles:health:check gh:auth:status:all; do
    jq -er --arg task "$task" '.tasks[$task].run' "$tmp/base.json" >"$tmp/task.sh"
    : >"$tmp/gh.log"
    env -i HOME="$tmp/home" PATH="$tmp/bin:/usr/bin:/bin" TEST_WORK="$work" TEST_GH_LOG="$tmp/gh.log" \
      GH_TOKEN=fixture GITHUB_TOKEN=fixture bash "$tmp/task.sh"
    printf '%s\n' "$tmp/home/.config/gh-personal" >"$tmp/expected.log"
    if [ "$work" = true ]; then
      printf '%s\n' "$tmp/home/.config/gh-work" >>"$tmp/expected.log"
    fi
    cmp "$tmp/expected.log" "$tmp/gh.log"
  done
  if [ "$work" = false ]; then
    rm "$tmp/bin/omlx"
    jq -er '.tasks."dotfiles:health:check".run' "$tmp/base.json" >"$tmp/task.sh"
    if env -i HOME="$tmp/home" PATH="$tmp/bin:/usr/bin:/bin" \
      bash "$tmp/task.sh" >"$tmp/missing-omlx.log" 2>&1; then
      echo 'FAIL: personal health check accepted missing oMLX' >&2
      exit 1
    fi
    grep -q 'omlx not found' "$tmp/missing-omlx.log"
  fi
done
printf 'Profile diagnostics passed.\n'
