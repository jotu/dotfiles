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

check_templated_bash dot_bashrc.tmpl
check_templated_bash dot_config/shell/aliases.tmpl
check_templated_bash run_onchange_before_install-applications-omarchy.sh.tmpl
check_templated_bash run_onchange_after_sync-pi-plan-mode.sh.tmpl

contains .chezmoiignore '.aerospace.toml'
contains .chezmoiignore 'Library/'
contains .chezmoiignore '.config/mise/config.toml'
contains .chezmoiignore '.bashrc'
contains .chezmoiignore '.zshrc'
contains private_dot_ssh/config.tmpl 'eq .chezmoi.os "darwin"'
contains run_onchange_before_install-packages-darwin.sh.tmpl 'eq .chezmoi.os "darwin"'
contains run_onchange_before_install-applications-omarchy.sh.tmpl 'eq .chezmoi.os "linux"'
contains run_onchange_before_install-applications-omarchy.sh.tmpl 'omarchy install editor zed'
contains run_onchange_before_install-applications-omarchy.sh.tmpl 'omarchy install browser firefox'
contains run_onchange_after_sync-pi-plan-mode.sh.tmpl 'eq .chezmoi.os "darwin"'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'macOS equivalents of tools supplied by Omarchy'
contains dot_config/mise/conf.d/00-base.toml.tmpl 'aqua:cli/cli'
contains dot_config/mise/conf.d/00-opencode.toml.tmpl 'eq .chezmoi.os "darwin"'
contains dot_config/gh-work/hosts.yml.tmpl 'else if and (hasKey . "work")'
contains dot_zshenv.tmpl 'hasKey .github "workUsername"'
not_contains dot_config/shell/aliases.tmpl 'compdef'
contains dot_zsh_aliases.tmpl 'compdef ae=aerospace'

printf 'Platform layout checks passed.\n'
