<div align="center">

[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Project Status](https://img.shields.io/badge/status-alpha-orange)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/jotu/dotfiles/badge)](https://scorecard.dev/viewer/?uri=github.com/jotu/dotfiles)
[![GitHub stars](https://img.shields.io/github/stars/jotu/dotfiles.svg?style=social&label=Star)](https://github.com/jotu/dotfiles)

</div>

# README

Everything except sensitive information to setup a new computer and keep it in sync.

## Operator Index

Most-used day-to-day commands:

Working principles: Tidy First + CUPID (composable, Unix philosophy, predictable, idiomatic, domain-based) for lean, maintainable changes.

```bash
# apply changes safely
chezmoi apply --dry-run
chezmoi apply

# quick health checks
mise run dotfiles:health:check
mise run gh:auth:status:all

# OpenCode profile switch + verify
mise run opencode:profile:set:work-openai   # or work-copilot / home-copilot
mise run opencode:profile:current
mise run opencode:profile:validate
```

Reference sections:
- Git and identity setup: [Git](#git)
- OpenCode profiles and model defaults: [OpenCode config defaults](#opencode-config-defaults)
- OpenCode skills catalog policy: [OpenCode skills catalog policy](#opencode-skills-catalog-policy)
- OpenCode commands catalog policy: [OpenCode commands catalog policy](#opencode-commands-catalog-policy)
- Working agreement: [Tidy First + CUPID + Ponytail](docs/working-agreement-tidy-cupid-ponytail.md)

## Pi plan mode

Pi and its official read-only plan-mode extension are installed through mise; the sync script is managed by chezmoi:

```bash
chezmoi apply                        # installs the sync hook
mise install                         # installs Pi and syncs the extension
mise run pi:plan-mode:sync           # sync manually when needed
```

Use `/plan` to toggle read-only planning and `/todos` to show progress. Pi updates resync the extension through mise's postinstall hook.

## Herdr work setup

Herdr is the persistent terminal workspace for local development. Keep one workspace per repository and use separate tabs for focused roles:

- `shell`: Git, Mise, tests, and logs.
- `pi`: planning, exploration, and read-only analysis.
- `opencode`: implementation and review, using the selected work profile.
- `lazygit`: optional visual Git history and staging.

Start Herdr from the repository root, then launch only the agents needed for the task:

```bash
herdr
```

Inside Herdr, use one tab for each role:

```text
shell:    mise run opencode:profile:set:work-openai  # or work-copilot
pi:       pi
opencode: opencode
```

Herdr preserves the workspace layout but does not automatically restart coding agents after a restart. Use `herdr agent list` to inspect detected Pi and OpenCode sessions.

## Pi safety model

Pi and Herdr run with the permissions of the current user. Herdr provides workspace persistence and agent status, not isolation.

- Use `/plan` before unfamiliar or multi-step work.
- The global Pi safety gate asks before risky shell operations and blocks common credential and metadata paths.
- Treat repository instructions, skills, packages, and web content as untrusted data.
- Use a Docker container or VM for untrusted repositories or unattended work. Do not mount the host `~/.pi/agent` into that environment unless its credentials and sessions are intentionally required.
- Web search, browser automation, and download helpers are deliberately not enabled by default. Add only reviewed, pinned tooling when a concrete workflow needs it.

## Hunk and LazyGit review

Hunk is installed through Mise, and LazyGit uses it as the external diff viewer through the managed `empty_config.yml` source:

```bash
mise install
lazygit
hunk diff
```

Open a changed file or diff in LazyGit to review it in Hunk. Use Hunk directly for a repository-wide working-tree review. Keep Hunk viewer-only for now; Pi does not control Hunk sessions or add review comments automatically.

# Git

## Generate SSH Keys for Laptop

```bash
    # Generate
    ssh-keygen -t ed25519 -C "<personal-email>" -f ~/.ssh/<personal-ssh-key>
    # Add to ssh agent
    eval "$(ssh-agent -s)"
    ssh-add ~/.ssh/<personal-ssh-key>
    # Add to GitHub or similar
    pbcopy < ~/.ssh/<personal-ssh-key>.pub
```

## Generate GPG Key for Laptop

```bash
    # Generate
    gpg --gen-key
    # Find new key
    gpg --list-keys
    # Get info
    gpg --armor --export <GeneratedKey>
    # Add to GitHub or similar
```

## Delete Old GPG Key for Laptop

```bash
    gpg --delete-secret-key <OLD_KEY>
    gpg --delete-key <OLD_KEY>
```

## Add Copilot MCP Secret

security add-generic-password -a "$(whoami)" \
 -s "mcp-server-github" \
 -w "<YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>"

## Personal/Work GH and Git Setup

{{- $ghConfigPersonal := "~/.config/gh-personal" -}}
{{- $ghConfigWork := "~/.config/gh-work" -}}
{{- if hasKey .github "configDir" -}}
{{- $ghConfig := get .github "configDir" -}}
{{- if hasKey $ghConfig "personal" -}}{{- $ghConfigPersonal = get $ghConfig "personal" -}}{{- end -}}
{{- if hasKey $ghConfig "work" -}}{{- $ghConfigWork = get $ghConfig "work" -}}{{- end -}}
{{- end }}

This repo is configured so:

- Personal repositories use `https://github.com/...` and authenticate with `gh`.
- Work repositories use SSH to `github.com` and force the work SSH key via `core.sshCommand`.
- Machine defaults are controlled by `work.enable`:
  - `work.enable = true`: work identity is default.
  - `work.enable = false`: personal identity is default.
- Per-path overrides are controlled by local data keys (kept outside this repo):
  - `work.git.rootDir` -> include `~/.gitconfig.work` for work repos.
  - `personal.git.rootDir` -> include `~/.gitconfig.personal` for personal repos.

After applying chezmoi on a work machine, initialize both gh profiles once:

```bash
GH_CONFIG_DIR="{{ $ghConfigPersonal }}" gh auth login --hostname github.com --git-protocol https
GH_CONFIG_DIR="{{ $ghConfigWork }}" gh auth login --hostname github.com --git-protocol ssh

GH_CONFIG_DIR="{{ $ghConfigPersonal }}" gh auth status --hostname github.com
GH_CONFIG_DIR="{{ $ghConfigWork }}" gh auth status --hostname github.com
```

Then use `GH_CONFIG_DIR` explicitly in the current shell/session when you need a profile:

```bash
export GH_CONFIG_DIR="{{ $ghConfigPersonal }}"
# or
export GH_CONFIG_DIR="{{ $ghConfigWork }}"
```

For normal `gh` usage, no PAT needs to be stored in this git repo.
Use interactive `gh auth login` for both personal and work profiles.
Use PAT only for tools that explicitly require it (for example `mcp-server-github` or CI automation via `GH_TOKEN`).

On personal machines (`work.enable = false`), standard `~/.config/gh` is used and personal remains default.

Set `work.git.rootDir` and `personal.git.rootDir` in local chezmoi data so `includeIf` routing applies where you keep each repo type.

Example (local only, do not commit):

```toml
[data.work.git]
rootDir = "~/src/work"

[data.personal.git]
rootDir = "~/src/personal"

[data.github.configDir]
personal = "~/.config/gh-personal"
work = "~/.config/gh-work"
```

## Post-apply checks

Run after `chezmoi apply`:

```bash
git config --show-origin --list
gh auth status --hostname github.com
ssh -T git@github.com
mise run dotfiles:health:check
```

If you use Rectangle on macOS, run the managed post-install setup once after it is installed:

```bash
mise run osx:setup-rectangle
```

Then grant Rectangle Accessibility permission in System Settings when prompted.

## Atuin History Migration

Atuin is installed through mise and configured through chezmoi on both home and work machines. It stores history locally; synchronization is disabled.

Run this migration once on each machine after syncing the chezmoi source, but before applying the new shell configuration. Home and work histories are intentionally migrated separately.

Make a private backup of the existing zsh history. The backup is runtime state outside this repository and the command refuses to overwrite an existing backup:

```bash
set -eu
history_source="${HISTFILE:-$HOME/.zsh_history}"
migration_dir="$HOME/.local/state/atuin-migration"
mkdir -p "$migration_dir"
original_history="$migration_dir/zsh_history.original"

if [ ! -f "$history_source" ]; then
  printf 'No legacy zsh history found; skip the import and start with an empty Atuin database.\n'
elif [ -e "$original_history" ]; then
  printf 'Keeping existing backup: %s\n' "$original_history"
else
  cp -p "$history_source" "$original_history"
  chmod 600 "$original_history"
  printf 'Created private backup: %s\n' "$original_history"
fi
```

Apply the dotfiles and install the managed tools:

```bash
chezmoi apply --dry-run
chezmoi apply
mise install
if mise ls --installed fzf >/dev/null 2>&1; then mise uninstall fzf; fi
if command -v brew >/dev/null 2>&1 && brew list --formula fzf >/dev/null 2>&1; then brew uninstall fzf; fi
```

Sanitize the backup before importing it. The task is a dry-run unless `--write` is provided, and drops ambiguous or malformed records rather than risking secret retention:

If a legacy history file was found, sanitize and import only the cleaned copy:

```bash
set -eu
migration_dir="$HOME/.local/state/atuin-migration"
original_history="$migration_dir/zsh_history.original"
sanitized_history="$migration_dir/zsh_history.sanitized"

mise run atuin:history:sanitize -- \
  --input "$original_history" \
  --output "$sanitized_history" \
  --write
HISTFILE="$sanitized_history" atuin import zsh
```

Do not import the original history, run `atuin import auto`, or register and sync an Atuin account. The sanitizer is authoritative for the initial import; do not run `atuin history prune` blindly because its preview can include useful commands matching broad rules. Keep the original backup until the imported history has been checked. The backup contains the original sensitive history and must not be committed or synchronized.

Finally, start a fresh shell on that machine:

```bash
exec zsh -l
atuin doctor
```

If the Atuin database already exists on a machine, do not import the same backup again. Use the existing database and repeat only the configuration/apply steps when updating the dotfiles.

## Quick GH Login Tasks

```bash
mise run gh:auth:login:personal
mise run gh:auth:login:work
mise run gh:auth:status:all
```

## OpenCode Config Defaults

- Profiles: `work-openai`, `work-copilot`, `home-copilot`.
- Fallback: if `opencode.profile` is unset and `work.enable = true`, use `work-openai`; otherwise use `home-copilot`.

### OpenCode Quick Start

```bash
# pick a profile
mise run opencode:profile:set:work-openai
mise run opencode:profile:set:work-copilot
mise run opencode:profile:set:home-copilot

# inspect active config
mise run opencode:profile:current

# validate template renders
mise run opencode:profile:validate
mise run opencode:models:validate

# preflight before changing model/profile routing
mise run opencode:models:preflight
```

### Profile Defaults

| Profile | model | small_model |
|---|---|---|
| `work-openai` | `openai/gpt-5.6-luna-medium` | `openai/gpt-5.6-luna-low` |
| `work-copilot` | `github-copilot/gpt-5.3-codex-medium` | `github-copilot/gpt-5-mini-low` |
| `home-copilot` | `github-copilot/gpt-5.3-codex-medium` | `github-copilot/gpt-5.4-mini-low` |

Role-tier routing defaults (verified):

- `work-openai`: flagship reasoning `openai/gpt-5.6-luna-xhigh`, coding-default `openai/gpt-5.6-luna-medium`, helper-cheap `openai/gpt-5.6-luna-low`.
- `work-copilot`: flagship reasoning `github-copilot/gpt-5.6-luna`, coding-default `github-copilot/gpt-5.3-codex`, helper-cheap `github-copilot/gpt-5-mini`.
- `home-copilot`: flagship reasoning `github-copilot/gpt-5.6-terra`, coding-default `github-copilot/gpt-5.3-codex`, helper-cheap `github-copilot/gpt-5.4-mini`.

Compaction ground rule:

- Keep automatic compaction enabled with `tail_turns: 10` to avoid long-thread token burn.
- If a session is still growing expensive, compact manually before large prompts or file-heavy tasks.

Work profile routing notes:

- `work-openai` keeps flagship planning, architecture, review, orchestration, workflow, security, and oracle roles on `openai/gpt-5.6-luna-xhigh`.
- `work-openai` keeps `build` on `openai/gpt-5.6-luna-high` and routine coding roles on `openai/gpt-5.6-luna-medium`.
- Use `openai/gpt-5.6-luna-medium` for mechanical dashboard JSON edits or straightforward Helm follow-through once the plan is clear.

Selection rule (required):

- Always pick models by role tier, not one "best" model for everything.
- When updating model defaults, include both decisions together:
  1. **Model selection** (`model`, `small_model`, and flagship recommendation)
  2. **Profile intent** (`work-openai`, `work-copilot`, `home-copilot`) and which roles each profile is expected to serve.
- Before adopting defaults for any profile, confirm the chosen models pass live verification on the active auth path.

OpenCode config maintenance notes:

- Shared runtime-critical sections live in `.chezmoitemplates/opencode/`:
  - `permission.json.tmpl`
  - `plugins-openai.json.tmpl`
  - `plugins-copilot.json.tmpl`
- These shared fragments are included by `dot_config/opencode/opencode.json.tmpl`.
- Keep only genuinely shared blocks there. Provider catalogs, model routes, and other profile-specific behavior should stay in the owning template.
- When changing OpenCode config templates, always run `mise run opencode:models:validate` so chezmoi renders the templates before JSON validation.

### Mise Task Conventions

- Manage only repo-owned personal mise fragments here, primarily `dot_config/mise/conf.d/00-*` and managed helpers under `dot_config/mise/scripts/` and `dot_config/mise/tasks/`.
- Treat unmanaged or externally owned local fragments such as `10-*`, `20-*`, and other non-chezmoi files as out of scope unless explicitly requested.
- Keep simple task logic in bash.
- Move more complex task logic into Node.js helpers.
- Launch Node-based helpers through mise-managed latest Node, for example via `bash "$HOME/.config/mise/scripts/run-node-task" ...` or `bash "$HOME/.config/mise/scripts/run-node-bin" ...`.
- Prefer invoking behavior through `mise` tasks rather than ad hoc scripts.
- Do not assume the current working directory; use `chezmoi source-path` or other stable paths when tasks may be run from anywhere.

### Docs Ownership Map

- `README.md`: operator quick-start and day-1 usage.
- `dot_config/opencode/AGENTS.md.tmpl`: agent routing, role boundaries, verification rules.
- `dot_agents/skills/*/SKILL.md`: deep task workflows and specialized playbooks.

### Privacy Boundary

- Keep all repo context repo-local.
- Do not store notes, summaries, or decisions from this repo in external long-term memory systems (for example Obsidian/team vault) unless explicitly requested.

### OpenCode Skills Catalog Policy

Use `~/.agents/skills` as the canonical runtime custom-skills catalog (agent-agnostic and shared).

- Keep `~/.config/opencode` for runtime config, commands, and `AGENTS.md`.
- Do not store active custom skills in `~/.config/opencode/skill` or `~/.config/opencode/skills`; keep those out of the active search path to prevent precedence drift.
- Do not treat `~/.agents/skills` as a fully repo-owned tree; unmanaged local skills, Company skills, and team-provided skills may coexist there.
- In this repo, manage only explicitly selected skills via `dot_agents/skills/<skill-name>/SKILL.md`.

Quick validation:

```bash
chezmoi source-path ~/.agents/skills/<skill-name>/SKILL.md
chezmoi source-path ~/.config/opencode/opencode.json
```

If `chezmoi source-path` says a skill file is "not managed", that is expected for local-only or external team skills.

Example:

```bash
chezmoi source-path ~/.agents/skills/some-company-or-team-skill/SKILL.md
# -> not managed
```

### OpenCode Commands Catalog Policy

Use `~/.config/opencode/commands` as the canonical runtime commands location.

- Keep active commands in `~/.config/opencode/commands` only.
- Do not use alternate active command paths (for example `~/.config/opencode/command`) to avoid precedence drift.
- Manage the intended command set through this repo under `dot_config/opencode/commands/*.md.tmpl`, so `chezmoi apply` reproduces the same command catalog.
- Local-only experimental commands are fine, but they should be intentionally unmanaged and understood as non-reproducible.

Quick validation:

```bash
chezmoi source-path ~/.config/opencode/commands/brainstorm.md
chezmoi source-path ~/.config/opencode/commands/write-plan.md
```

## Zed Workflow Shortcuts

Managed Zed tasks are available for a non-vim workflow:

```bash
LazyGit
Television
Superfile
```

Managed Zed files:

- `~/.config/zed/private_settings.json`
- `~/.config/zed/keymap.json`
- `~/.config/zed/tasks.json`

Default keybindings:

```text
cmd-shift-g -> LazyGit
cmd-p       -> Television
cmd-shift-f -> Superfile
```

Quick verify after apply:

```bash
git config --get core.excludesfile
mise install
which lazygit
which tv
which spf
```

Optional: set Zed MCP GitHub token via local chezmoi data (do not commit):

```toml
[data.github]
mcpServerGithubToken = "<github_pat_for_mcp_server_github>"
```

Shell completions are cached daily in `${XDG_CACHE_HOME:-~/.cache}/zsh_completions.d`.

Install Zed manually from zed.dev if it is not already present.
