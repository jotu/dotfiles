#!/usr/bin/env bash
# Verify rendered Git helpers select profiles without inherited token overrides.
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
mkdir -p "$tmp_dir/bin"

cat >"$tmp_dir/bin/gh" <<'EOF'
#!/usr/bin/env bash
set -eu
[ "$*" = 'auth git-credential get' ]
if [ "$WORK_ENABLED" = true ]; then
  [ -z "${GH_TOKEN+x}" ] || exit 1
  [ -z "${GITHUB_TOKEN+x}" ] || exit 1
else
  [ "$GH_TOKEN" = fixture ] || exit 1
  [ "$GITHUB_TOKEN" = fixture ] || exit 1
fi
[ "$GH_CONFIG_DIR" = "$EXPECTED_PROFILE" ]
printf 'username=fixture\npassword=fixture\n'
EOF
chmod +x "$tmp_dir/bin/gh"

for enabled in true false; do
  override="{\"work\":{\"enable\":$enabled},\"github\":{\"configDir\":{\"personal\":\"$tmp_dir/personal\",\"work\":\"$tmp_dir/work\"}}}"
  for source in dot_gitconfig.tmpl dot_gitconfig.personal.tmpl dot_gitconfig.work.tmpl; do
    output="$tmp_dir/$source-$enabled"
    chezmoi execute-template --override-data "$override" --file "$repo_root/$source" >"$output"
  done
  for profile in default personal work; do
    if [ "$profile" != default ] && [ "$enabled" = false ]; then continue; fi
    config="$tmp_dir/dot_gitconfig.tmpl-$enabled"
    args=(-c include.path=/dev/null)
    if [ "$profile" = default ]; then
      expected=personal
      [ "$enabled" = false ] || expected=work
    else
      expected="$profile"
      args=(-c "include.path=$tmp_dir/dot_gitconfig.$profile.tmpl-$enabled")
    fi
    # Exclude host/system config and use synthetic token values only.
    for host in github.com gist.github.com; do
    printf 'protocol=https\nhost=%s\npath=example/repo.git\n\n' "$host" |
      env GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$config" GIT_TERMINAL_PROMPT=0 \
        GH_TOKEN=fixture GITHUB_TOKEN=fixture WORK_ENABLED="$enabled" EXPECTED_PROFILE="$tmp_dir/$expected" \
        PATH="$tmp_dir/bin:$PATH" \
        git -C "$tmp_dir" "${args[@]}" credential fill >/dev/null
    done
  done
done
printf 'Git credential profile checks passed.\n'
