#!/usr/bin/env bash
# Validate repository file boundaries without applying the dotfiles.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

contains() {
  local file="$1"
  local text="$2"
  grep -Fq -- "$text" "$repo_root/$file" || fail "$file does not contain: $text"
}

not_contains() {
  local file="$1"
  local text="$2"
  ! grep -Fq -- "$text" "$repo_root/$file" || fail "$file unexpectedly contains: $text"
}

absent() {
  [ ! -e "$repo_root/$1" ] || fail "$1 should be removed"
}

# These scripts are repository tooling and must remain executable shell.
bash -n "$repo_root/bootstrap"
bash -n "$repo_root/tests/test-platform-layout.sh"
bash -n "$repo_root/tests/test-pi-skills.sh"
not_contains bootstrap 'omarchy_ai_commands='
contains bootstrap 'This macOS bootstrap supports Apple Silicon only.'
contains bootstrap 'curl -fsSL https://mise.run | sh'
contains bootstrap 'mise bootstrap packages apply --dry-run'
not_contains bootstrap 'omarchy refresh applications'

# Chezmoi templates are checked with template-control lines removed and inline
# template expressions replaced by a harmless shell word. Full rendering tests
# should run on a host with Chezmoi and private machine data configured.
check_templated_bash() {
  local source="$1"
  local rendered
  rendered=$(mktemp)
  trap 'rm -f "$rendered"' RETURN
  sed -E \
    '/^[[:space:]]*\{\{[-]?[^}]*\}\}[[:space:]]*$/d; s/\{\{[-]?[^}]*\}\}/test/g' \
    "$repo_root/$source" >"$rendered"
  bash -n "$rendered" || fail "$source is not valid Bash after template controls are removed"
  rm -f "$rendered"
  trap - RETURN
}

check_templated_zsh() {
  local source="$1"
  local rendered
  if ! command -v zsh >/dev/null 2>&1; then
    return 0
  fi
  rendered=$(mktemp)
  trap 'rm -f "$rendered"' RETURN
  sed -E \
    '/^[[:space:]]*\{\{[-]?[^}]*\}\}[[:space:]]*$/d; s/\{\{[-]?[^}]*\}\}/test/g' \
    "$repo_root/$source" >"$rendered"
  zsh -n "$rendered" || fail "$source is not valid Zsh after template controls are removed"
  rm -f "$rendered"
  trap - RETURN
}

absent dot_bashrc.tmpl
absent dot_config/bash/completions.bash.tmpl
check_templated_bash dot_config/shell/aliases.tmpl
absent run_onchange_before_install-applications-omarchy.sh.tmpl
check_templated_bash run_onchange_after_sync-pi-subagent.sh.tmpl
check_templated_zsh dot_zshenv.tmpl
check_templated_zsh dot_zshrc.tmpl
check_templated_zsh dot_config/zsh/aliases.zsh.tmpl
check_templated_zsh dot_config/zsh/completions.zsh.tmpl
check_templated_zsh dot_config/zsh/daily.zsh.tmpl

contains .chezmoiignore 'renovate.json'
not_contains .chezmoiignore '.zshrc'
not_contains bootstrap 'omarchy pkg add zsh'
absent dot_config/bash/completions.bash.tmpl
not_contains dot_zshrc.tmpl 'eq .chezmoi.os "linux"'
not_contains dot_zshrc.tmpl '/usr/share/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh'
contains dot_zshrc.tmpl '$BREW_HOME/share/zsh-autosuggestions/zsh-autosuggestions.zsh'
not_contains dot_zshrc.tmpl '/usr/share/zsh/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh'
contains dot_zshrc.tmpl '$BREW_HOME/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh'
not_contains dot_zshrc.tmpl 'voxtype'
contains dot_aerospace.toml "if.app-id = 'com.apple.MobileSMS'"
contains dot_aerospace.toml "if.app-id = 'org.whispersystems.signal-desktop'"
absent dot_config/voxtype/config.toml.tmpl
not_contains dot_aerospace.toml 'voxtype'
contains dot_config/mise/conf.d/00-base.toml.tmpl '[bootstrap.packages]'
not_contains dot_config/mise/conf.d/00-base.toml.tmpl '"jundot/omlx" = "https://github.com/jundot/omlx"'
not_contains dot_config/mise/conf.d/00-base.toml.tmpl '"brew:jundot/omlx/omlx" = "latest"'
contains dot_config/mise/conf.d/00-base.toml.tmpl '[tasks."omlx:model:install"]'
contains dot_config/mise/conf.d/00-base.toml.tmpl '[tasks."omlx:start"]'
contains dot_config/mise/conf.d/00-base.toml.tmpl '[tasks."omlx:restart"]'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'model_repo="mlx-community/Qwen3.5-9B-4bit"'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'model_repo="mlx-community/Qwen3.5-4B-4bit"'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'model_repo="mlx-community/gpt-oss-20b-MXFP4-Q4"'
contains dot_config/mise/conf.d/00-base.toml.tmpl '"$hf" download "$model_repo"'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'omlx start'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'revision_file="$model_dir/.omlx-revision"'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'oMLX is intentionally not managed here'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'usage = '"'"'arg "[model]" default="qwen3.5-9b-4bit"'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'for command_name in mise aerospace omlx'
contains dot_config/mise/conf.d/00-base.toml.tmpl '[tasks."omlx:install"]'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'brew install "$tap/omlx"'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'tap_commit="2165e75726ba83d9651dbaced61c97728da77bba"'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'HOMEBREW_NO_AUTO_UPDATE=1'
contains dot_omlx/modify_private_settings.json 'memory_guard_tier" "aggressive"'
contains .chezmoiignore '.omlx/'
not_contains .chezmoiignore '.pi/agent/models.json'
contains .chezmoiignore 'MISSION.md'
contains .chezmoiignore 'RESOURCES.md'
contains .chezmoiignore 'NOTES.md'
contains .chezmoiignore 'GLOSSARY.md'
contains .chezmoiignore 'assets/'
contains .chezmoiignore 'lessons/'
contains .chezmoiignore 'learning-records/'
contains .chezmoiignore 'reference/'
contains .chezmoitemplates/pi-models.json.tmpl 'qwen3.5-9b-4bit'
contains .chezmoitemplates/pi-models.json.tmpl 'qwen3.5-4b-4bit'
contains .chezmoitemplates/pi-models.json.tmpl 'gpt-oss-20b-mxfp4-q4'
contains .chezmoitemplates/pi-models.json.tmpl 'http://127.0.0.1:8000/v1'
contains dot_config/mise/conf.d/00-base.toml.tmpl '"brew:curl" = "latest"'
contains dot_config/mise/conf.d/00-base.toml.tmpl '"brew:thefuck" = "latest"'
not_contains dot_config/mise/conf.d/00-base.toml.tmpl '"pipx:thefuck"'
absent run_onchange_after_fix-thefuck-compat-darwin.sh.tmpl
contains dot_config/mise/conf.d/00-base.toml.tmpl 'superfile = "latest"'
contains dot_config/mise/conf.d/00-base.toml.tmpl '"aqua:ajeetdsouza/zoxide" = "latest"'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'ruby = "3"'
contains dot_config/mise/conf.d/00-base.toml.tmpl '"brew-cask:nikitabobko/tap/aerospace" = "latest"'
contains dot_config/mise/conf.d/00-base.toml.tmpl '"brew-cask:signal" = "latest"'
contains dot_config/mise/conf.d/00-base.toml.tmpl '"brew-cask:discord" = "latest"'
absent dot_config/systemd/user/ssh-agent.service.tmpl
not_contains dot_config/mise/conf.d/00-base.toml.tmpl 'voxtype'
[ ! -e "$repo_root/run_onchange_before_install-packages-darwin.sh.tmpl" ] || fail 'the Darwin package script should be removed'
not_contains dot_zshenv.tmpl 'amd64'
not_contains private_dot_gnupg/gpg-agent.conf.tmpl 'amd64'
not_contains dot_config/mise/tasks/proton/cli/executable_install 'Darwin:x86_64'
bash -n "$repo_root/dot_config/mise/tasks/proton/cli/executable_install"
bash -n "$repo_root/dot_config/mise/tasks/proton/cli/executable_update"
contains dot_config/mise/tasks/proton/cli/executable_install 'version="2.3.3"'
contains dot_config/mise/tasks/proton/cli/executable_install 'expected_sha256='
contains dot_config/mise/tasks/proton/cli/executable_install 'curl --fail --silent --show-error'
contains dot_config/mise/tasks/proton/cli/executable_update 'pass-cli update "$@"'
absent run_after_enable-ssh-agent.sh.tmpl
contains dot_config/television/cable/alias.toml.tmpl 'requirements = ["zsh"]'
contains dot_config/television/cable/recent-files.toml.tmpl 'shell = "zsh"'
not_contains dot_config/television/cable/alias.toml.tmpl 'bash -ic'
contains dot_config/shell/aliases.tmpl 'command -v nvim'
not_contains private_dot_ssh/config.tmpl 'eq .chezmoi.os "darwin"'
not_contains dot_config/mise/conf.d/00-base.toml.tmpl 'brew "mise"'
not_contains bootstrap 'omarchy install'
contains run_onchange_after_sync-pi-subagent.sh.tmpl 'command -v pi >/dev/null 2>&1'
not_contains dot_config/mise/conf.d/00-base.toml.tmpl 'Omarchy'
contains dot_config/mise/conf.d/00-base.toml.tmpl '"github:max-sixty/worktrunk" = "0.82.0"'
not_contains dot_config/mise/conf.d/00-base.toml.tmpl 'go:github.com/Gaurav-Gosain/tuios/cmd/tuios'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'aqua:cli/cli'
not_contains bootstrap 'omarchy pkg add worktrunk'
contains dot_zshrc.tmpl 'wt config shell init zsh'
contains dot_zshrc.tmpl 'wt config shell init zsh'
contains dot_config/worktrunk/config.toml.tmpl 'worktree-path = "~/.worktrunk/{{ `{{ owner }}/{{ repo }}/{{ branch | sanitize }}` }}"'
contains dot_config/worktrunk/config.toml.tmpl '[merge]'
contains dot_config/worktrunk/config.toml.tmpl 'squash = true'
contains dot_config/worktrunk/config.toml.tmpl 'rebase = true'
contains dot_config/worktrunk/config.toml.tmpl '[aliases]'
contains dot_config/worktrunk/config.toml.tmpl 's = "wt switch {{ `{{ args }}` }}"'
not_contains dot_config/mise/conf.d/00-base.toml.tmpl 'pi:worktrunk:install'
not_contains dot_config/mise/conf.d/00-base.toml.tmpl 'wt config plugins pi install --yes'
contains dot_pi/agent/extensions/worktrunk.ts 'agent_start'
contains dot_pi/agent/extensions/worktrunk.ts 'agent_settled'
contains dot_pi/agent/extensions/worktrunk.ts 'session_shutdown'
not_contains dot_pi/agent/extensions/worktrunk.ts 'pi.on("agent_end"'
not_contains dot_config/mise/conf.d/00-base.toml.tmpl '[tasks."pi:plan-mode:sync"]'
absent dot_config/mise/scripts/executable_install-pi-plan-mode
contains dot_config/mise/conf.d/00-base.toml.tmpl '[tasks."pi:subagent:sync"]'
contains dot_config/mise/conf.d/00-base.toml.tmpl '[tasks."pi:matt:skills:install"]'
not_contains dot_config/mise/conf.d/00-base.toml.tmpl '[tasks."herdr:pi:install"]'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'install-pi-subagent'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'pi:matt:skills:install'
contains dot_config/mise/scripts/executable_manage-matt-pi-skills.tmpl 'MISE_INSTALLED_TOOLS'
contains dot_config/mise/scripts/executable_install-pi-subagent 'MISE_TOOL_INSTALL_PATH'
contains dot_config/mise/scripts/executable_install-pi-subagent 'command -v pi'
for skill in grill-me grill-with-docs grilling; do
  not_contains .chezmoiremove ".pi/agent/skills/$skill"
done
contains dot_pi/agent/AGENTS.md '/skill:grill-with-docs'
contains dot_pi/agent/AGENTS.md 'Preserve focused commits on the branch'
contains dot_pi/agent/AGENTS.md 'direct integration into unprotected `main`'
contains docs/pi.md 'mise run pi:matt:skills:update'
not_contains docs/pi.md 'mise run pi:worktrunk:install'
contains docs/pi.md 'This setup uses standard Pi only.'
contains docs/platform-ownership.md 'mise also trusts the same config path in that repository'
contains dot_config/mise/scripts/executable_manage-matt-pi-skills.tmpl 'skills/engineering and skills/productivity'
contains dot_pi/agent/agents/scout.md 'name: scout'
contains dot_pi/agent/prompts/implement-and-review.md 'subagent tool'
not_contains dot_config/mise/conf.d/00-base.toml.tmpl 'pi:addy:skills:install'
not_contains dot_config/mise/conf.d/00-base.toml.tmpl 'pi:addy:skills:update'
# Rex defaults remain unchanged until the user adds a specific customization.
[ -f "$repo_root/dot_config/rex/init.lua" ] || fail 'missing Rex Lua configuration'
if grep -Evq '^[[:space:]]*(--.*)?$' "$repo_root/dot_config/rex/init.lua" ||
  grep -Eq '^[[:space:]]*--\[' "$repo_root/dot_config/rex/init.lua"; then
  fail 'Rex baseline should contain only line comments and blank lines'
fi
# Rex status is built into current Pi; leave old installed copies for explicit review.
absent dot_pi/agent/extensions/rex-agent-state.ts
not_contains .chezmoiremove '.pi/agent/extensions/rex-agent-state.ts'
not_contains dot_pi/agent/AGENTS.md 'rex-agent-state.ts'
contains docs/pi.md 'rex skill status'
contains docs/pi.md 'PI_PROGRAM_STATUS'
absent dot_pi/agent/extensions/joyful-workflow.ts
for skill in joyful-code-review joyful-implementation joyful-planning joyful-principles joyful-verification joyful-workflow; do
  absent "dot_pi/agent/skills/$skill"
done
not_contains dot_pi/agent/AGENTS.md 'Joyful'
not_contains dot_pi/agent/prompts/review.md.tmpl 'joyful'
not_contains README.md 'Joyful'
contains dot_pi/agent/prompts/review.md.tmpl '/skill:code-review'
contains dot_pi/agent/prompts/review.md.tmpl '/skill:go-code-review'
contains dot_pi/agent/AGENTS.md '/skill:go-code-review'
contains dot_pi/agent/skills/go-code-review/SKILL.md 'name: go-code-review'
contains dot_pi/agent/skills/go-code-review/SKILL.md 'Standards and Spec'
contains dot_pi/agent/AGENTS.md 'Default to the Matt workflow'
for skill in api-and-interface-design frontend-ui-engineering observability-and-instrumentation security-and-hardening browser-testing-with-devtools ci-cd-and-automation code-simplification deprecation-and-migration documentation-and-adrs doubt-driven-development performance-optimization shipping-and-launch source-driven-development; do
  not_contains dot_pi/agent/skills/using-agent-skills/SKILL.md "$skill"
done
for agent in security-auditor test-engineer web-performance-auditor; do
  [ -f "$repo_root/dot_pi/agent/agents/$agent.md" ] || fail "missing retained specialist agent: $agent"
done
contains GLOSSARY.md '**Pi skill**'
contains GLOSSARY.md '**Specialist agent**'
not_contains dot_config/mise/conf.d/00-base.toml.tmpl 'eq .chezmoi.os "darwin"'
contains dot_config/gh-work/hosts.yml.tmpl 'else if and (hasKey . "work")'
contains dot_zshrc.tmpl 'hasKey .github "workUsername"'
contains dot_zshrc.tmpl 'export GITHUB_TOKEN='
contains dot_zshrc.tmpl 'gh-work'
not_contains dot_zshenv.tmpl 'export MISE_GITHUB_TOKEN='
not_contains dot_config/shell/aliases.tmpl 'compdef'
not_contains dot_config/zsh/completions.zsh.tmpl 'source "$HOME/.config/zsh/completions/_tuios"'
contains dot_config/zsh/aliases.zsh.tmpl 'compdef ae=aerospace'

# Relative Markdown links in the README and docs must resolve to existing files.
while IFS= read -r -d '' doc; do
  doc_dir="$(dirname "$doc")"
  while IFS= read -r link; do
    target="${link%%#*}"
    case "$target" in '' | http*://* | mailto:*) continue ;; esac
    [ -e "$doc_dir/$target" ] || fail "${doc#"$repo_root"/} links to missing file: $link"
  done < <(grep -oE '\]\([^)]+\)' "$doc" | sed -E 's/^\]\((.*)\)$/\1/')
done < <(find "$repo_root/README.md" "$repo_root/docs" -name '*.md' -not -path '*/research/*' -print0)

printf 'Platform layout checks passed.\n'
