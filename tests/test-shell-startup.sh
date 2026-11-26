#!/usr/bin/env bash
# Render Zsh configuration and exercise startup without host tools or credentials.
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
command -v zsh >/dev/null || { echo 'SKIP: zsh is unavailable'; exit 0; }
zsh_bin=$(command -v zsh)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/home/.local/bin" "$tmp/tools"
data=$(jq -c '.work.enable = false' "$repo_root/tests/fixtures/chezmoi-data.json")
for file in zshenv zshrc; do
  chezmoi --config /dev/null --config-format toml execute-template --override-data "$data" \
    --file "$repo_root/dot_$file.tmpl" >"$tmp/home/.$file"
done
# Noninteractive children must retain their caller's build environment.
env -i HOME="$tmp/home" ZDOTDIR="$tmp/home" PATH=/usr/bin:/bin \
  LDFLAGS=-L/project/lib CPPFLAGS=-I/project/include \
  "$zsh_bin" -d -c '[[ $LDFLAGS == -L/project/lib && $CPPFLAGS == -I/project/include ]]'
# Keep interactive startup away from installed host plugins and completions.
printf '%s\n' 'export BREW_HOME="$HOME/empty-brew-prefix"' >>"$tmp/home/.zshenv"
# Only activation exposes gh. Never query the host Keychain or real Homebrew.
cat >"$tmp/home/.local/bin/mise" <<'MOCK'
#!/bin/sh
[ "$*" = 'activate zsh' ] || exit 1
printf 'export PATH="%s:/usr/bin:/bin"\n' "$TEST_TOOLS"
MOCK
printf '#!/bin/sh\nexit 1\n' >"$tmp/tools/security"
cp "$tmp/tools/security" "$tmp/home/.local/bin/security"
printf '#!/bin/sh\nexit 0\n' >"$tmp/home/.local/bin/brew"
cat >"$tmp/tools/gh" <<'MOCK'
#!/bin/sh
[ "$*" = 'auth token' ] || exit 1
[ "$GH_CONFIG_DIR" = "$EXPECTED_PROFILE" ] || exit 1
printf 'fixture-token\n'
MOCK
chmod +x "$tmp/home/.local/bin/"* "$tmp/tools/"*
for work in true false; do
  profile=personal
  [ "$work" = false ] || profile=work
  data=$(jq -c --argjson work "$work" '.work.enable = $work' "$repo_root/tests/fixtures/chezmoi-data.json")
  chezmoi --config /dev/null --config-format toml execute-template --override-data "$data" \
    --file "$repo_root/dot_zshrc.tmpl" >"$tmp/home/.zshrc"
  for selection in default configured explicit; do
    expected="$tmp/home/.config/gh-$profile"
    explicit_dir=""
    if [ "$selection" = configured ]; then
      expected="$tmp/home/custom profile"
      data=$(jq -c --arg profile "$profile" '.github.configDir[$profile] = "~/custom profile"' <<<"$data")
    elif [ "$selection" = explicit ]; then
      expected="$tmp/home/explicit profile"
      explicit_dir="$expected"
    fi
    chezmoi --config /dev/null --config-format toml execute-template --override-data "$data" \
      --file "$repo_root/dot_zshrc.tmpl" >"$tmp/home/.zshrc"
    env -i HOME="$tmp/home" ZDOTDIR="$tmp/home" PATH="$tmp/home/.local/bin:/usr/bin:/bin" \
      TEST_TOOLS="$tmp/tools" EXPECTED_PROFILE="$expected" TERM=dumb GH_CONFIG_DIR="$explicit_dir" \
      "$zsh_bin" -d -i -c '[[ ${GITHUB_TOKEN:-} == fixture-token ]]' </dev/null
  done
  for token in GH_TOKEN GITHUB_TOKEN; do
    # A pre-existing token must win without consulting gh or the Keychain.
    env -i HOME="$tmp/home" ZDOTDIR="$tmp/home" PATH="$tmp/home/.local/bin:/usr/bin:/bin" \
      TEST_TOOLS="$tmp/tools" TERM=dumb "$token=inherited-fixture" TEST_TOKEN="$token" \
      "$zsh_bin" -d -i -c '[[ ${(P)TEST_TOKEN} == inherited-fixture ]]' </dev/null
  done
done
printf 'Shell startup passed.\n'
