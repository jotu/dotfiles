#!/usr/bin/env bash
# Check oMLX profile boundaries without a configured home or network access.
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
for profile in 'darwin false' 'darwin true' 'linux false' 'linux true'; do
  set -- $profile
  os="$1" work="$2"
  data=$(jq -c --arg os "$os" --argjson work "$work" --arg src "$repo_root" \
    '. + {chezmoi: {os: $os, arch: "arm64", sourceDir: $src}} | .work.enable = $work' \
    "$repo_root/tests/fixtures/chezmoi-data.json")
  render() { chezmoi --config /dev/null --config-format toml execute-template --source "$repo_root" --override-data "$data" --file "$1"; }
  render "$repo_root/dot_config/mise/conf.d/00-base.toml.tmpl" >"$tmp_dir/base.toml"
  chezmoi --config /dev/null --config-format toml execute-template --with-stdin \
    '{{ .chezmoi.stdin | fromToml | toJson }}' <"$tmp_dir/base.toml" >"$tmp_dir/base.json"
  render "$repo_root/.chezmoitemplates/pi-settings.json.tmpl" >"$tmp_dir/settings.json"
  printf '%s' '{"customKey":"keep","providers":{"example":{"baseUrl":"http://127.0.0.1:1234"},"omlx":{"models":[{"id":"old-local"}]}}}' |
    chezmoi --config /dev/null --config-format toml execute-template --source "$repo_root" --with-stdin --override-data "$data" \
      --file "$repo_root/dot_pi/agent/modify_private_models.json" >"$tmp_dir/models.json"
  jq -e '.customKey == "keep" and .providers.example.baseUrl == "http://127.0.0.1:1234"' "$tmp_dir/models.json" >/dev/null
  printf '' | chezmoi --config /dev/null --config-format toml execute-template --source "$repo_root" --with-stdin --override-data "$data" \
    --file "$repo_root/dot_pi/agent/modify_private_models.json" >"$tmp_dir/fresh-models.json"
  if [[ "$work" == true ]]; then
    jq -e '.providers == {}' "$tmp_dir/fresh-models.json" >/dev/null
  else
    jq -e '.providers.omlx.models | length == 3' "$tmp_dir/fresh-models.json" >/dev/null
  fi
  render "$repo_root/.chezmoiignore" >"$tmp_dir/ignore"
  if [[ "$os" == darwin ]]; then
    jq -e '.tasks | has("omlx:model:install") and has("omlx:start") and has("omlx:restart")' "$tmp_dir/base.json" >/dev/null
    ! grep -Fxq '.pi/agent/models.json' "$tmp_dir/ignore"
    if [[ "$work" == true ]]; then
      jq -e '(.tasks | has("omlx:install") | not) and (.tasks."omlx:model:install".usage | contains("qwen3-14b-4bit"))' "$tmp_dir/base.json" >/dev/null
      jq -e '.providers | has("omlx") | not' "$tmp_dir/models.json" >/dev/null
      jq -e '[.enabledModels[] | select(startswith("omlx/"))] | length == 0' "$tmp_dir/settings.json" >/dev/null
    else
      jq -e '(.tasks | has("omlx:install")) and (.tasks."omlx:model:install".usage | contains("qwen3.5-9b-4bit"))' "$tmp_dir/base.json" >/dev/null
      jq -e '[.providers.omlx.models[].id] == ["qwen3.5-9b-4bit", "qwen3.5-4b-4bit", "gpt-oss-20b-mxfp4-q4"]' "$tmp_dir/models.json" >/dev/null
      jq -e '[.enabledModels[] | select(startswith("omlx/"))] == ["omlx/qwen3.5-9b-4bit", "omlx/qwen3.5-4b-4bit", "omlx/gpt-oss-20b-mxfp4-q4"]' "$tmp_dir/settings.json" >/dev/null
    fi
  else
    jq -e '.tasks | (has("omlx:install") or has("omlx:model:install") or has("omlx:start") or has("omlx:restart")) | not' "$tmp_dir/base.json" >/dev/null
    grep -Fxq '.pi/agent/models.json' "$tmp_dir/ignore"
    jq -e '[.enabledModels[] | select(startswith("omlx/"))] | length == 0' "$tmp_dir/settings.json" >/dev/null
  fi
done

# Applying a work profile must keep unrelated providers and private file mode.
data=$(jq -c --arg src "$repo_root" \
  '. + {chezmoi: {os: "darwin", arch: "arm64", sourceDir: $src}} | .work.enable = true' \
  "$repo_root/tests/fixtures/chezmoi-data.json")
mkdir -p "$tmp_dir/destination/.pi/agent"
printf '\357\273\277' >"$tmp_dir/destination/.pi/agent/models.json"
printf '%s\n' '{ // Pi accepts a BOM and JSON comments.' '"providers":{"example":{"apiKey":"test-only-placeholder"},"omlx":{"models":[]}}}' >>"$tmp_dir/destination/.pi/agent/models.json"
chmod 600 "$tmp_dir/destination/.pi/agent/models.json"
chezmoi --config /dev/null --config-format toml --source "$repo_root" --destination "$tmp_dir/destination" \
  --persistent-state "$tmp_dir/chezmoi-state" --cache "$tmp_dir/cache" --override-data "$data" apply "$tmp_dir/destination/.pi/agent/models.json"
target="$tmp_dir/destination/.pi/agent/models.json"
if stat -f '%Lp' "$target" >/dev/null 2>&1; then
  mode=$(stat -f '%Lp' "$target")
else
  mode=$(stat -c '%a' "$target")
fi
[[ "$mode" == 600 ]]
jq -e '.providers.example.apiKey == "test-only-placeholder" and (.providers | has("omlx") | not)' \
  "$tmp_dir/destination/.pi/agent/models.json" >/dev/null
printf 'oMLX profile boundaries passed.\n'
