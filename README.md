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

Switch OpenCode profile quickly:

```bash
mise run opencode:profile:copilot
mise run opencode:profile:openai
mise run opencode:profile:current
```
