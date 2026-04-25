<div align="center">

[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Project Status](https://img.shields.io/badge/status-alpha-orange)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/jotu/dotfiles/badge)](https://scorecard.dev/viewer/?uri=github.com/jotu/dotfiles)
[![GitHub stars](https://img.shields.io/github/stars/jotu/dotfiles.svg?style=social&label=Star)](https://github.com/jotu/dotfiles)

</div>

# README

Everything except sensitive information to setup a new computer and keep it in sync.

# Git

## Generate ssh keys for laptop

```bash
    # Generate
    ssh-keygen -t ed25519 -C "<personal-email>" -f ~/.ssh/<personal-ssh-key>
    # Add to ssh agent
    eval "$(ssh-agent -s)"
    ssh-add ~/.ssh/<personal-ssh-key>
    # Add to GitHub or similar
    pbcopy < ~/.ssh/<personal-ssh-key>.pub
```

## Generate gpg key for laptop

```bash
    # Generate
    gpg --gen-key
    # Find new key
    gpg --list-keys
    # Get info
    gpg --armor --export <GeneratedKey>
    # Add to GitHub or similar
```

## Delete old gpg key for laptop

```bash
    gpg --delete-secret-key <OLD_KEY>
    gpg --delete-key <OLD_KEY>
```

## Add co pilot mcp secret

security add-generic-password -a "$(whoami)" \
 -s "mcp-server-github" \
 -w "<YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>"

## Personal/work gh and git setup

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

## Quick gh login tasks

```bash
mise run gh:auth:login:personal
mise run gh:auth:login:work
mise run gh:auth:status:all
```

## OpenCode profile defaults

- Work machines (`work.enable = true`) default to OpenAI/Codex profile.
- Personal machines (`work.enable = false`) default to GitHub Copilot profile.
- Both profiles are available on both machines; you can switch any time.
- Upstream docs use `oh-my-opencode` naming, and this repo manages the runtime basename `~/.config/opencode/oh-my-opencode.json` directly.
- For OpenAI/Codex routing, treat provider catalog entries as available options, not guaranteed-compatible defaults. Any active `model` or `small_model` route must be compatible with the account/auth path in use.
- In practice, ChatGPT-backed Codex accounts should use active routes that are known to work for that auth flow. In this repo, keep `openai/gpt-5.3-codex` as the active OpenCode route in `opencode.json`, use `openai/gpt-5.4` for the active `oh-my-opencode` work agent/category routes, and treat `openai/gpt-5.3-codex-spark`, `openai/gpt-5.1-codex-mini`, and `openai/codex-mini-latest` as catalog entries rather than active defaults for this auth path.

Switch OpenCode profile quickly:

```bash
mise run opencode:profile:copilot
mise run opencode:profile:openai
mise run opencode:profile:current
```

OpenCode config maintenance note:

- Shared runtime-critical sections live in `.chezmoitemplates/opencode/`:
  - `permission.json.tmpl`
  - `plugins-openai.json.tmpl`
  - `plugins-copilot.json.tmpl`
- These shared fragments are included by:
  - `dot_config/opencode/opencode.json.tmpl`
  - `dot_config/opencode/profiles/opencode.openai.json.tmpl`
  - `dot_config/opencode/profiles/opencode.copilot.json.tmpl`
- `oh-my-opencode` templates in this repo track the current upstream schema from `code-yeongyu/oh-my-opencode` and render the `oh-my-opencode.json` basename locally.
- The managed work/OpenAI runtime template includes the expected `_migrations` metadata for the current GPT-5.4 routing so runtime-generated migration metadata does not immediately reintroduce chezmoi drift.
- Keep only genuinely shared blocks there. Provider catalogs, model routes, and other profile-specific behavior should stay in the owning template.
- When changing OpenCode config templates, always run `mise run opencode:models:validate` so chezmoi renders the templates before JSON validation.

### OpenCode skills catalog policy

Use `~/.agents/skills` as the canonical runtime custom-skills catalog (agent-agnostic and shared).

- Keep `~/.config/opencode` for runtime config, profiles, commands, and `AGENTS.md`.
- Do not store active custom skills in `~/.config/opencode/skill` or `~/.config/opencode/skills`; keep those out of the active search path to prevent precedence drift.
- Do not treat `~/.agents/skills` as a fully repo-owned tree; unmanaged local skills, Company skills, and team-provided skills may coexist there.
- In this repo, manage only explicitly selected skills via `dot_agents/skills/<skill-name>/SKILL.md`. Ownership is per managed skill path only, so chezmoi materializes just those selected files under `~/.agents/skills/...` without claiming or cleaning unmanaged siblings in the catalog.

Quick validation:

```bash
chezmoi source-path ~/.agents/skills/<skill-name>/SKILL.md
chezmoi source-path ~/.config/opencode/opencode.json
```

If `chezmoi source-path` says a skill file is "not managed", that is acceptable for local-only skills you want to keep outside this repo.

Example:

```bash
chezmoi source-path ~/.agents/skills/some-company-or-team-skill/SKILL.md
# -> not managed
```

### OpenCode commands catalog policy

Use `~/.config/opencode/commands` as the canonical runtime commands location.

- Keep active commands in `~/.config/opencode/commands` only.
- Do not use alternate active command paths for OpenCode (for example `~/.config/opencode/command`), because parallel locations create precedence drift and make runtime behavior harder to reason about.
- Manage the intended command set through this repo under `dot_config/opencode/commands/*.md.tmpl`, so `chezmoi apply` reproduces the same command catalog.
- Local-only experimental commands are fine, but they should be intentionally unmanaged and understood as non-reproducible.

Quick validation:

```bash
chezmoi source-path ~/.config/opencode/commands/brainstorm.md
chezmoi source-path ~/.config/opencode/commands/write-plan.md
```

## Zed workflow shortcuts

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
