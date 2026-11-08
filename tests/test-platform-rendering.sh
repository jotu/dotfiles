#!/usr/bin/env bash
# Render the platform-specific templates and validate their structured output.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

for command_name in chezmoi yq; do
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

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

validate_toml() { yq -p toml -o json '.' "$1" >/dev/null; }
validate_json() { yq -p json -o json '.' "$1" >/dev/null; }

# Assert a yq expression is true for a TOML or JSON file: check_expr <format> <file> <expr> <message>
check_expr() {
  local format="$1" file="$2" expr="$3" message="$4"
  [[ "$(yq -p "$format" -o json "$expr" "$file")" == true ]] || fail "$message ($expr)"
}
check_toml() { check_expr toml "$@"; }
check_json() { check_expr json "$@"; }

toml_sources=(
  dot_config/voxtype/config.toml.tmpl
  dot_config/mise/conf.d/00-base.toml.tmpl
  dot_config/herdr/config.toml.tmpl
  dot_config/hunk/config.toml.tmpl
  dot_config/sofka/config.toml.tmpl
  dot_config/starship.toml.tmpl
  dot_config/television/cable/alias.toml.tmpl
  dot_config/television/cable/recent-files.toml.tmpl
  dot_config/television/config.toml.tmpl
)
json_sources=(
  .chezmoitemplates/pi-settings.json.tmpl
  dot_pi/agent/models.json
)

for os in linux darwin; do
  zsh_output="$tmp_dir/$os.zshrc"
  render "$os" dot_zshrc.tmpl "$zsh_output"
  zsh -n "$zsh_output"
  grep -Fq 'fpath=("$HOME/.config/zsh/completions" $fpath)' "$zsh_output"

  base_output="$tmp_dir/$os-base.toml"
  render "$os" dot_config/mise/conf.d/00-base.toml.tmpl "$base_output"
  validate_toml "$base_output"
  check_toml "$base_output" '.tools.superfile == "latest"' 'superfile pinned'
  for task in tuios:pi:install tuios:completion:sync; do
    check_toml "$base_output" ".tasks.\"$task\" != null" "task $task exists"
    check_toml "$base_output" "[.hooks.postinstall[] | select(.task == \"$task\")] | length > 0" "hook $task exists"
    yq -p toml -oy ".tasks.\"$task\".run" "$base_output" | bash -n
  done
  check_toml "$base_output" '.tools."npm:opencode-ai" == null' 'opencode not managed'
  check_toml "$base_output" '.settings.npm.package_manager == "npm"' 'npm package manager'
  if [[ "$os" == linux ]]; then
    check_toml "$base_output" '(.tasks | has("omlx:model:install")) == false' 'no omlx install on linux'
    check_toml "$base_output" '(.tasks | has("omlx:start")) == false' 'no omlx start on linux'
    check_toml "$base_output" '(.tasks | has("omlx:restart")) == false' 'no omlx restart on linux'
    check_toml "$base_output" '(.bootstrap.packages // {} | length) == 0' 'no bootstrap packages on linux'
    for tool in gh hunk herdr github:max-sixty/worktrunk aqua:ajeetdsouza/zoxide npm:@openai/codex npm:@earendil-works/pi-coding-agent; do
      check_toml "$base_output" ".tools.\"$tool\" == null" "linux must not install $tool"
    done
  else
    check_toml "$base_output" '(.tasks | has("omlx:model:install"))' 'omlx install on darwin'
    check_toml "$base_output" '(.tasks | has("omlx:start"))' 'omlx start on darwin'
    check_toml "$base_output" '(.tasks | has("omlx:restart"))' 'omlx restart on darwin'
    for tool in aqua:cli/cli hunk herdr github:max-sixty/worktrunk aqua:ajeetdsouza/zoxide; do
      check_toml "$base_output" ".tools.\"$tool\" != null" "darwin installs $tool"
    done
    check_toml "$base_output" '.tools."npm:@openai/codex" == "latest"' 'codex latest'
    pi='.tools."npm:@earendil-works/pi-coding-agent"'
    check_toml "$base_output" "$pi.version == \"latest\"" 'pi latest'
    check_toml "$base_output" "$pi.postinstall | contains(\"install-pi-plan-mode\")" 'pi plan-mode postinstall'
    check_toml "$base_output" "$pi.postinstall | contains(\"install-pi-subagent\")" 'pi subagent postinstall'
    check_toml "$base_output" '.bootstrap.brew.taps | has("jundot/omlx") | not' 'omlx tap absent'
    check_toml "$base_output" '.bootstrap.packages."brew:jundot/omlx/omlx" == null' 'omlx package absent'
    check_toml "$base_output" '.bootstrap.packages."brew:curl" == "latest"' 'brew curl'
    check_toml "$base_output" '.bootstrap.packages."brew-cask:nikitabobko/tap/aerospace" == "latest"' 'aerospace cask'
    check_toml "$base_output" '.bootstrap.packages."brew-cask:signal" == "latest"' 'signal cask'
    check_toml "$base_output" '.bootstrap.packages."brew-cask:discord" == "latest"' 'discord cask'
    check_toml "$base_output" '.tools.ruby == "3"' 'ruby 3'
  fi

  java_output="$tmp_dir/$os-java.toml"
  render "$os" dot_config/mise/conf.d/00-java.toml.tmpl "$java_output"
  validate_toml "$java_output"
  check_toml "$java_output" '.tools.java == "temurin-25"' 'Mise-managed Temurin LTS JDK'
  check_toml "$java_output" '.bootstrap.packages."brew-cask:temurin" == null' 'no Homebrew Temurin cask'
  if [[ "$os" == darwin ]]; then
    check_toml "$java_output" '.bootstrap.packages."brew:maven" == "latest"' 'Maven formula'
  else
    check_toml "$java_output" '(.bootstrap.packages // {} | length) == 0' 'no Java bootstrap packages on linux'
  fi

  completion_output="$tmp_dir/$os-tuios-completion"
  render "$os" dot_config/zsh/completions/_tuios.tmpl "$completion_output"
  zsh -n "$completion_output"
  if command -v tuios >/dev/null 2>&1; then
    grep -Fq '#compdef tuios' "$completion_output"
  else
    grep -Fq 'tuios:completion:sync' "$completion_output"
  fi

  sofka_output="$tmp_dir/$os-sofka.toml"
  render "$os" dot_config/sofka/config.toml.tmpl "$sofka_output"
  check_toml "$sofka_output" '.readonly == false' 'sofka allows mutating actions'

  tuios_output="$tmp_dir/$os-tuios.toml"
  render "$os" dot_config/tuios/config.toml.tmpl "$tuios_output"
  validate_toml "$tuios_output"
  if [[ "$os" == linux ]]; then expected_theme=omarchy; else expected_theme=catppuccin_macchiato; fi
  check_toml "$tuios_output" ".appearance.theme == \"$expected_theme\"" 'tuios theme'
  check_toml "$tuios_output" '.startup.tiled == true' 'tuios tiled'

  if [[ "$os" == linux ]]; then
    superfile_source=dot_config/superfile/config.toml.tmpl
  else
    superfile_source='private_Library/private_Application Support/superfile/config.toml.tmpl'
  fi
  superfile_output="$tmp_dir/$os-superfile.toml"
  render "$os" "$superfile_source" "$superfile_output"
  validate_toml "$superfile_output"
  check_toml "$superfile_output" '.zoxide_support == true' 'superfile zoxide'
  check_toml "$superfile_output" '.ignore_missing_fields == true' 'superfile ignore_missing_fields'
  if [[ "$os" == darwin ]]; then
    check_toml "$superfile_output" '.theme == "catppuccin-macchiato"' 'superfile theme'
  else
    check_toml "$superfile_output" 'has("theme") | not' 'superfile no theme on linux'
  fi

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

for work_enabled in true false; do
  settings_output="$tmp_dir/settings-work-$work_enabled.json"
  chezmoi execute-template \
    --override-data "{\"chezmoi\":{\"os\":\"linux\",\"arch\":\"arm64\"},\"work\":{\"enable\":$work_enabled}}" \
    --file "$repo_root/.chezmoitemplates/pi-settings.json.tmpl" >"$settings_output"
  validate_json "$settings_output"
  if [[ "$work_enabled" == true ]]; then
    check_json "$settings_output" '.defaultProvider == "openai-codex"' 'work provider'
    check_json "$settings_output" '.defaultModel == "gpt-6.1-terra"' 'work model'
    check_json "$settings_output" '.defaultThinkingLevel == "medium"' 'work thinking level'
    check_json "$settings_output" '.enabledModels[0] == "openai-codex/gpt-6.1-terra" and (.enabledModels | length) == 1' 'work model scope'
  else
    check_json "$settings_output" '.defaultProvider == "github-copilot"' 'personal provider'
    check_json "$settings_output" '.defaultModel == "claude-sonnet-5.5"' 'personal model'
    check_json "$settings_output" '.defaultThinkingLevel == "medium"' 'personal thinking level'
  fi
  check_json "$settings_output" '[.packages[].source] | contains(["npm:pi-mcp-adapter@3.2.0"])' 'mcp adapter'
  check_json "$settings_output" "([.packages[].source] | contains([\"npm:pi-chatgpt-limit@0.3.1\"])) == $work_enabled" 'chatgpt-limit follows work.enable'
done

# Personal macOS profiles can select the local oMLX models; no other profile can.
for profile in "darwin false" "darwin true" "linux false"; do
  set -- $profile
  settings_output="$tmp_dir/settings-$1-$2.json"
  chezmoi execute-template \
    --override-data "{\"chezmoi\":{\"os\":\"$1\",\"arch\":\"arm64\"},\"work\":{\"enable\":$2}}" \
    --file "$repo_root/.chezmoitemplates/pi-settings.json.tmpl" >"$settings_output"
  validate_json "$settings_output"
  expected_local=false
  [[ "$1 $2" == "darwin false" ]] && expected_local=true
  check_json "$settings_output" "([.enabledModels[] | select(test(\"^omlx/\"))] | length > 0) == $expected_local" "local models scoped for $1 work=$2"
done

# The oMLX install task exists only on personal macOS profiles.
for profile in "darwin false" "darwin true" "linux false"; do
  set -- $profile
  base_output="$tmp_dir/base-omlx-$1-$2.toml"
  chezmoi execute-template \
    --override-data "{\"chezmoi\":{\"os\":\"$1\",\"arch\":\"arm64\"},\"work\":{\"enable\":$2,\"git\":{}},\"personal\":{\"git\":{}}}" \
    --file "$repo_root/dot_config/mise/conf.d/00-base.toml.tmpl" >"$base_output"
  expected_task=false
  [[ "$1 $2" == "darwin false" ]] && expected_task=true
  check_toml "$base_output" "(.tasks | has(\"omlx:install\")) == $expected_task" "omlx:install task for $1 work=$2"
  if [[ "$expected_task" == true ]]; then
    yq -p toml -r '.tasks."omlx:install".run' "$base_output" >"$tmp_dir/omlx-install.sh"
    bash -n "$tmp_dir/omlx-install.sh" || fail "omlx:install script syntax"
  fi
done

# The settings modify template must keep Pi-owned keys and let managed keys win.
modify_template="$repo_root/dot_pi/agent/modify_settings.json"
modify_data='{"chezmoi":{"os":"linux","arch":"arm64"},"work":{"enable":false}}'
merged_output="$tmp_dir/settings-merged.json"
printf '{"lastChangelogVersion":"9.9.9","defaultProjectTrust":"always","compaction":{"enabled":false}}' |
  chezmoi execute-template --source "$repo_root" --with-stdin --override-data "$modify_data" \
    --file "$modify_template" >"$merged_output"
validate_json "$merged_output"
fresh_output="$tmp_dir/settings-fresh.json"
printf '' | chezmoi execute-template --source "$repo_root" --with-stdin --override-data "$modify_data" \
  --file "$modify_template" >"$fresh_output"
validate_json "$fresh_output"
check_json "$merged_output" '.lastChangelogVersion == "9.9.9"' 'Pi-owned keys must survive'
check_json "$merged_output" '.defaultProjectTrust == "ask"' 'managed keys must win'
check_json "$merged_output" '.compaction.enabled == true' 'managed nested keys must win'
check_json "$fresh_output" 'has("lastChangelogVersion") | not' 'fresh installs contain only managed keys'
check_json "$fresh_output" '.defaultProvider == "github-copilot"' 'fresh default provider'

printf 'Linux and macOS platform templates rendered and validated.\n'
