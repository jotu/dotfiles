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
chezmoi apply --preview
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
| `work-openai` | `openai/gpt-5.4` | `openai/gpt-5.4-mini-fast` |
| `work-copilot` | `github-copilot/gpt-5.3-codex` | `github-copilot/gemini-3-flash-preview` |
| `home-copilot` | `github-copilot/gpt-5.3-codex` | `github-copilot/gemini-3-flash-preview` |

Role-tier routing defaults (verified):

- `work-openai`: flagship reasoning `openai/gpt-5.5`, coding-default `openai/gpt-5.4`, helper-cheap `openai/gpt-5.4-mini-fast`.
- `work-copilot` and `home-copilot`: flagship reasoning `github-copilot/claude-opus-4.6`, coding-default `github-copilot/gpt-5.3-codex`, helper-cheap `github-copilot/gemini-3-flash-preview`.

Work profile routing notes:

- `work-openai` keeps `build`/`builder` on `openai/gpt-5.4` for routine coding work such as Go and Java implementation.
- `work-openai` promotes `platform-engineer` and `observability-engineer` to `openai/gpt-5.5` for Helm, Kubernetes, Grafana, alerts, and dashboard-heavy reasoning.
- Use `openai/gpt-5.4` for mechanical dashboard JSON edits or straightforward Helm follow-through once the plan is clear.

Selection rule (required):

- Always pick models by role tier, not one "best" model for everything.
- When updating model defaults, include both decisions together:
  1. **Model selection** (`model`, `small_model`, and flagship recommendation)
  2. **Profile intent** (`work-openai`, `work-copilot`, `home-copilot`) and which roles each profile is expected to serve.
- Before adopting defaults for any profile, confirm the chosen models pass live verification on the active auth path.

Preference note:

- For Copilot-backed workflows, prefer `github-copilot/claude-opus-4.6` as the default flagship reasoning route.
- Treat Gemini models as preferred for UI, visual, and multimodal-oriented work rather than the default general flagship route.

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
