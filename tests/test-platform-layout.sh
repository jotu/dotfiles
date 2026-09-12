#!/usr/bin/env bash
# Validate the cross-platform file boundaries without applying the dotfiles.
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

# These scripts are repository tooling and must remain executable shell.
bash -n "$repo_root/bootstrap"
bash -n "$repo_root/tests/test-platform-layout.sh"
contains bootstrap 'omarchy_ai_commands=(codex claude crush gemini gh copilot opencode pi omp hunk)'
contains bootstrap 'omarchy refresh applications'

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

check_templated_bash dot_bashrc.tmpl
check_templated_bash dot_bash_completions.tmpl
check_templated_bash dot_config/shell/aliases.tmpl
check_templated_bash run_onchange_before_install-applications-omarchy.sh.tmpl
check_templated_bash run_onchange_after_sync-pi-plan-mode.sh.tmpl
check_templated_zsh dot_zshenv.tmpl
check_templated_zsh dot_zshrc.tmpl
check_templated_zsh dot_zsh_aliases.tmpl
check_templated_zsh dot_zsh_completions.tmpl
check_templated_zsh dot_zsh_daily.tmpl

contains .chezmoiignore '.aerospace.toml'
contains .chezmoiignore 'Library/'
contains .chezmoiignore '.config/mise/config.toml'
contains .chezmoiignore '.bashrc'
not_contains .chezmoiignore '.zshrc'
contains bootstrap 'omarchy pkg add zsh'
contains dot_bashrc.tmpl 'source "$HOME/.bash_completions"'
contains dot_zshrc.tmpl 'eq .chezmoi.os "linux"'
contains dot_zshrc.tmpl 'else if eq .chezmoi.os "darwin"'
contains dot_zshrc.tmpl '/usr/share/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh'
contains dot_zshrc.tmpl '$BREW_HOME/share/zsh-autosuggestions/zsh-autosuggestions.zsh'
contains dot_zshrc.tmpl '/usr/share/zsh/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh'
contains dot_zshrc.tmpl '$BREW_HOME/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh'
contains dot_zshrc.tmpl 'command -v voxtype >/dev/null 2>&1'
contains dot_zshrc.tmpl 'voxtype daemon >/dev/null 2>&1 &!'
contains dot_config/voxtype/config.toml.tmpl 'key = "RIGHTALT"'
contains dot_config/voxtype/config.toml.tmpl 'mode = "push_to_talk"'
contains run_onchange_before_install-packages-darwin.sh.tmpl 'brew "zsh-autosuggestions"'
contains dot_config/mise/conf.d/00-base.toml.tmpl '"github:peteonrails/voxtype" = "latest"'
contains dot_config/mise/conf.d/00-base.toml.tmpl '[tasks."voxtype:setup"]'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'voxtype setup --download --model base.en'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'for command_name in brew mise aerospace voxtype'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'voxtype setup check'
contains run_onchange_before_install-packages-darwin.sh.tmpl 'brew "zsh-syntax-highlighting"'
contains run_onchange_before_install-applications-omarchy.sh.tmpl 'omarchy pkg add zsh zsh-autosuggestions zsh-syntax-highlighting'
contains dot_config/television/cable/alias.toml.tmpl 'requirements = ["zsh"]'
contains dot_config/television/cable/recent-files.toml.tmpl 'shell = "zsh"'
not_contains dot_config/television/cable/alias.toml.tmpl 'bash -ic'
contains dot_config/shell/aliases.tmpl 'command -v nvim'
contains private_dot_ssh/config.tmpl 'eq .chezmoi.os "darwin"'
contains run_onchange_before_install-packages-darwin.sh.tmpl 'eq .chezmoi.os "darwin"'
contains run_onchange_before_install-applications-omarchy.sh.tmpl 'eq .chezmoi.os "linux"'
contains run_onchange_before_install-applications-omarchy.sh.tmpl 'omarchy install editor zed'
contains run_onchange_before_install-applications-omarchy.sh.tmpl 'omarchy install browser firefox'
contains run_onchange_after_sync-pi-plan-mode.sh.tmpl 'command -v pi >/dev/null 2>&1'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'macOS equivalents of tools supplied by Omarchy'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'aqua:cli/cli'
contains dot_config/mise/conf.d/00-opencode.toml.tmpl '[tasks."pi:plan-mode:sync"]'
contains dot_config/mise/conf.d/00-opencode.toml.tmpl 'eq .chezmoi.os "darwin"'
contains dot_config/gh-work/hosts.yml.tmpl 'else if and (hasKey . "work")'
contains dot_zshenv.tmpl 'hasKey .github "workUsername"'
not_contains dot_config/shell/aliases.tmpl 'compdef'
contains dot_zsh_aliases.tmpl 'compdef ae=aerospace'

printf 'Platform layout checks passed.\n'
