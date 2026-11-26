# Git, GitHub, SSH, and signing setup

## Generate SSH Keys for Laptop

Chezmoi manages the SSH configuration. It does not store private keys or passphrases in this repository.

```bash
# Generate locally
ssh-keygen -t ed25519 -a 100 -C "<personal-email>" -f ~/.ssh/<personal-ssh-key>

# macOS: UseKeychain in the managed SSH config uses iCloud Keychain.
ssh-add --apple-use-keychain ~/.ssh/<personal-ssh-key>

# Add the public key to GitHub or similar.
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

After applying chezmoi, initialize the personal gh profile on both personal and work machines. Work machines also need the work profile:

```bash
mise run gh:auth:login:personal
mise run gh:auth:login:work     # work machines only
mise run gh:auth:status:all
```

These tasks use the profile paths from local Chezmoi data, defaulting to `~/.config/gh-personal` and `~/.config/gh-work`. Login and status tasks ignore inherited `GH_TOKEN` and `GITHUB_TOKEN` values so they use the selected profile's stored credentials.

Then use `GH_CONFIG_DIR` explicitly in the current shell/session when you need a profile. Clear inherited tokens first so gh uses that profile's stored credentials:

```bash
unset GH_TOKEN GITHUB_TOKEN
export GH_CONFIG_DIR="$HOME/.config/gh-personal"
# or, on work machines
export GH_CONFIG_DIR="$HOME/.config/gh-work"
```

For normal `gh` usage, no PAT needs to be stored in this git repo.
Use interactive `gh auth login` for both personal and work profiles.
Use PAT only for tools that explicitly require it (for example `mcp-server-github` or CI automation via `GH_TOKEN`).

On personal machines (`work.enable = false`), Git credential helpers, shell token loading, and health checks use the personal profile at `~/.config/gh-personal` by default, not standard `~/.config/gh`. Shell token loading respects an explicit `GH_CONFIG_DIR` or an existing token.

### Migrate an existing personal login

If you authenticated only in standard `~/.config/gh`, authenticate the managed personal profile after applying the updated dotfiles:

```bash
# Clear session overrides so the next shell loads the managed personal profile.
unset GH_CONFIG_DIR GH_TOKEN GITHUB_TOKEN
mise run gh:auth:login:personal
mise run gh:auth:status:all
exec zsh
```

This leaves the old default profile untouched; do not delete its configuration or copy tokens into Chezmoi data. The login task respects a custom `github.configDir.personal` path. On work machines, also authenticate the work profile before checking all profiles.

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
mise run gh:auth:login:work     # work machines only
mise run gh:auth:status:all
```

