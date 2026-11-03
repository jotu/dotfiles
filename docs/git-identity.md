# Git, GitHub, SSH, and signing setup

## Generate SSH Keys for Laptop

Chezmoi manages the SSH configuration and, on Omarchy/Linux, the shared user-level SSH-agent service. It does not store private keys or passphrases in this repository.

```bash
# Generate locally
ssh-keygen -t ed25519 -a 100 -C "<personal-email>" -f ~/.ssh/<personal-ssh-key>

# Omarchy/Linux: the agent socket is configured by the managed Zsh setup.
# Load the key manually when needed; AddKeysToAgent also loads it on first use.
sar
ssh-add ~/.ssh/<personal-ssh-key>

# macOS: UseKeychain in the managed SSH config uses iCloud Keychain.
ssh-add --apple-use-keychain ~/.ssh/<personal-ssh-key>

# Add the public key to GitHub or similar.
# Linux:
wl-copy < ~/.ssh/<personal-ssh-key>.pub
# macOS:
pbcopy < ~/.ssh/<personal-ssh-key>.pub
```

On Omarchy, the managed `ssh-agent.service` uses `$XDG_RUNTIME_DIR/ssh-agent.sock`, so all terminals share one agent. `sar` is a manual preload/recovery command, not a second per-terminal agent.

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

Keep MCP credentials in the operating system’s secret store or configure them
through the MCP client’s native secret mechanism. Do not place GitHub tokens in
Chezmoi data or rendered editor settings.

## Personal/Work GH and Git Setup

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
GH_CONFIG_DIR="~/.config/gh-personal" gh auth login --hostname github.com --git-protocol https
GH_CONFIG_DIR="~/.config/gh-work" gh auth login --hostname github.com --git-protocol ssh

GH_CONFIG_DIR="~/.config/gh-personal" gh auth status --hostname github.com
GH_CONFIG_DIR="~/.config/gh-work" gh auth status --hostname github.com
```

Then use `GH_CONFIG_DIR` explicitly in the current shell/session when you need a profile:

```bash
export GH_CONFIG_DIR="~/.config/gh-personal"
# or
export GH_CONFIG_DIR="~/.config/gh-work"
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


## Quick GH Login Tasks

```bash
mise run gh:auth:login:personal
mise run gh:auth:login:work
mise run gh:auth:status:all
```

