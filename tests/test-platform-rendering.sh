#!/usr/bin/env bash
# Render the platform-specific templates and validate their structured output.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

for command_name in chezmoi python3 yq; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf 'ERROR: %s is required for platform rendering checks.\n' "$command_name" >&2
    exit 1
  }
done

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

render() {
  local os="$1" source="$2" output="$3"
  chezmoi execute-template \
    --override-data "{\"chezmoi\":{\"os\":\"$os\",\"arch\":\"arm64\"}}" \
    --file "$repo_root/$source" >"$output"
}

validate_toml() {
  python3 - "$1" <<'PY'
import sys
import tomllib

with open(sys.argv[1], "rb") as file:
    tomllib.load(file)
PY
}

validate_json() {
  python3 - "$1" <<'PY'
import json
import sys

with open(sys.argv[1]) as file:
    json.load(file)
PY
}

toml_sources=(
  dot_config/mise/conf.d/00-base.toml.tmpl
  dot_config/mise/conf.d/00-opencode.toml.tmpl
  dot_config/herdr/config.toml.tmpl
  dot_config/hunk/config.toml.tmpl
  dot_config/sofka/config.toml.tmpl
  dot_config/starship.toml.tmpl
  dot_config/television/cable/alias.toml.tmpl
  dot_config/television/cable/recent-files.toml.tmpl
  dot_config/television/config.toml.tmpl
)
json_sources=(
  dot_config/opencode/opencode.json.tmpl
  dot_pi/agent/settings.json.tmpl
)

for os in linux darwin; do
  zsh_output="$tmp_dir/$os.zshrc"
  render "$os" dot_zshrc.tmpl "$zsh_output"
  zsh -n "$zsh_output"

  base_output="$tmp_dir/$os-base.toml"
  render "$os" dot_config/mise/conf.d/00-base.toml.tmpl "$base_output"
  validate_toml "$base_output"
  python3 - "$base_output" "$os" <<'PY'
import sys
import tomllib

with open(sys.argv[1], "rb") as file:
    tools = tomllib.load(file)["tools"]
os = sys.argv[2]

if os == "linux":
    assert "gh" not in tools
    assert "hunk" not in tools
    assert "herdr" not in tools
else:
    assert "aqua:cli/cli" in tools
    assert "hunk" in tools
    assert "herdr" in tools
PY

  for source in "${toml_sources[@]}"; do
    output="$tmp_dir/$os-$(basename "$source")"
    render "$os" "$source" "$output"
    validate_toml "$output"
  done

  for source in "${json_sources[@]}"; do
    output="$tmp_dir/$os-$(basename "$source")"
    render "$os" "$source" "$output"
    validate_json "$output"
  done

  yaml_output="$tmp_dir/$os-gh-dash.yml"
  render "$os" dot_config/gh-dash/config.yml.tmpl "$yaml_output"
  yq eval '.' "$yaml_output" >/dev/null
done

printf 'Linux and macOS platform templates rendered and validated.\n'
