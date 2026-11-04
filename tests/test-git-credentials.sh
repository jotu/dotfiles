#!/usr/bin/env bash
# Verify real includeIf routing, home expansion, and token/cache isolation with fake credentials.
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir=$(mktemp -d)
tmp_dir=$(cd "$tmp_dir" && pwd -P)
trap 'rm -rf "$tmp_dir"' EXIT
fixture_home="$tmp_dir/home with spaces"
mkdir -p "$tmp_dir/bin" "$fixture_home"

cat >"$tmp_dir/bin/gh" <<'EOF'
#!/usr/bin/env bash
set -eu
[ "$*" = 'auth git-credential get' ]
[ -z "${GH_TOKEN+x}" ] || exit 1
[ -z "${GITHUB_TOKEN+x}" ] || exit 1
if [ "$GH_CONFIG_DIR" != "$EXPECTED_PROFILE" ]; then
  printf 'Wrong profile path: got <%s>, expected <%s>\n' "$GH_CONFIG_DIR" "$EXPECTED_PROFILE" >&2
  exit 1
fi
printf 'username=fixture\npassword=fixture\n'
EOF
chmod +x "$tmp_dir/bin/gh"
# A stale cached account must not win before the selected profile helper.
cat >"$tmp_dir/system" <<'EOF'
[credential]
    helper = "!f() { printf 'username=cached\\npassword=cached\\n'; }; f"
EOF

for directory in default personal-repos/example work-repos/example dotfiles; do
  git init --quiet "$tmp_dir/$directory"
done

for path_style in absolute home; do
  if [ "$path_style" = absolute ]; then
    config_root="$tmp_dir/profile configs"
    expected_root="$config_root"
  else
    # Pass a literal tilde to the template to test the default path convention.
    # shellcheck disable=SC2088
    config_root='~/.config'
    expected_root="$fixture_home/.config"
  fi
  for enabled in true false; do
    override="{\"name\":\"Test User\",\"chezmoi\":{\"sourceDir\":\"$tmp_dir/dotfiles\"},\"work\":{\"enable\":$enabled,\"git\":{\"rootDir\":\"$tmp_dir/work-repos\",\"email\":\"work@example.com\",\"signingKey\":\"WORKKEY\"}},\"personal\":{\"git\":{\"rootDir\":\"$tmp_dir/personal-repos\",\"email\":\"me@example.com\",\"signingKey\":\"MYKEY\"}},\"github\":{\"configDir\":{\"personal\":\"$config_root/gh-personal\",\"work\":\"$config_root/gh-work\"}}}"
    for suffix in '' .personal .work; do
      chezmoi execute-template --override-data "$override" \
        --file "$repo_root/dot_gitconfig$suffix.tmpl" >"$fixture_home/.gitconfig$suffix"
    done
    # No command-line profile overrides: exercise the same includeIf order as git push.
    for directory in default personal-repos/example work-repos/example dotfiles; do
      expected=personal
      if [ "$enabled" = true ]; then
        case "$directory" in default|work-repos/*) expected=work ;; esac
      fi
      for host in github.com gist.github.com; do
        printf 'protocol=https\nhost=%s\npath=example/repo.git\n\n' "$host" |
          env HOME="$fixture_home" GIT_CONFIG_NOSYSTEM=0 GIT_CONFIG_SYSTEM="$tmp_dir/system" \
            GIT_CONFIG_GLOBAL="$fixture_home/.gitconfig" GIT_TERMINAL_PROMPT=0 \
            GH_TOKEN=fixture GITHUB_TOKEN=fixture EXPECTED_PROFILE="$expected_root/gh-$expected" \
            PATH="$tmp_dir/bin:$PATH" \
            git -C "$tmp_dir/$directory" credential fill | grep -qx 'username=fixture'
      done
    done
  done
done
# When run in a task worktree, verify its real Git metadata routes via the primary checkout.
common_dir=$(git -C "$repo_root" rev-parse --path-format=absolute --git-common-dir)
git_dir=$(git -C "$repo_root" rev-parse --path-format=absolute --git-dir)
if [ "$git_dir" != "$common_dir" ]; then
  primary_root=$(dirname "$common_dir")
  for owner in personal work source; do
    personal_root="$tmp_dir/personal-repos"
    work_root="$tmp_dir/work-repos"
    source_root="$tmp_dir/dotfiles"
    case "$owner" in
      personal) personal_root="$primary_root" ;;
      work) work_root="$primary_root" ;;
      source) source_root="$primary_root" ;;
    esac
    override="{\"name\":\"Test User\",\"chezmoi\":{\"sourceDir\":\"$source_root\"},\"work\":{\"enable\":true,\"git\":{\"rootDir\":\"$work_root\",\"email\":\"work@example.com\",\"signingKey\":\"WORKKEY\"}},\"personal\":{\"git\":{\"rootDir\":\"$personal_root\",\"email\":\"me@example.com\",\"signingKey\":\"MYKEY\"}},\"github\":{\"configDir\":{\"personal\":\"~/.config/gh-personal\",\"work\":\"~/.config/gh-work\"}}}"
    for suffix in '' .personal .work; do
      chezmoi execute-template --override-data "$override" \
        --file "$repo_root/dot_gitconfig$suffix.tmpl" >"$fixture_home/.gitconfig$suffix"
    done
    expected=personal
    [ "$owner" != work ] || expected=work
    printf 'protocol=https\nhost=github.com\npath=example/repo.git\n\n' |
      env HOME="$fixture_home" GIT_CONFIG_NOSYSTEM=0 GIT_CONFIG_SYSTEM="$tmp_dir/system" \
        GIT_CONFIG_GLOBAL="$fixture_home/.gitconfig" GIT_TERMINAL_PROMPT=0 \
        GH_TOKEN=fixture GITHUB_TOKEN=fixture EXPECTED_PROFILE="$fixture_home/.config/gh-$expected" \
        PATH="$tmp_dir/bin:$PATH" \
        git -C "$repo_root" credential fill | grep -qx 'username=fixture'
  done
  printf 'Linked worktree credential checks passed.\n'
fi
printf 'Git credential profile checks passed.\n'
