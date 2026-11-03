# New machine bootstrap

Setup for a new Omarchy/Linux or macOS machine. Return to the [README](../README.md) for daily commands.

This repository supports two platform profiles:

- **Omarchy/Linux:** Omarchy owns the operating system, base packages, desktop applications, and its provisioned tools. Chezmoi adds user configuration and Mise installs tools that Omarchy does not provide.
- **macOS:** Mise manages the package layer through its Homebrew-compatible backend, while also managing the configured CLI tools and runtimes. The profile targets Apple Silicon.

The checked-in `bootstrap` helper runs the platform checks and initializes Chezmoi from `git@github.com:jotu/dotfiles.git` by default (`mise exec -- chezmoi init ...`). It deliberately stops before applying files. Set `DOTFILES_REPO_URL` to use a different repository. Run it from a checked-out copy after the machine has GitHub access.

## Omarchy/Linux

Mise is preinstalled by Omarchy. The bootstrap keeps Bash as its interpreter, installs Zsh when needed, and leaves the login-shell switch for after the dotfiles have been reviewed and applied. Omarchy also provisions the base desktop applications and its AI harnesses and developer agents, including `codex`, `claude`, `crush`, `gemini`, `gh`, OpenCode, Pi, `omp`, Hunk, and Herdr. The repository leaves OpenCode configuration to Omarchy. If one of these wrappers is missing, restore Omarchy's application wrappers before authenticating:

```bash
omarchy refresh applications
gh auth login --hostname github.com --git-protocol ssh
gh auth status
ssh -T git@github.com
```

Install Chezmoi through the existing Mise installation and initialize it from GitHub:

```bash
mise use --global chezmoi@latest
mise exec -- chezmoi init git@github.com:jotu/dotfiles.git
```

Do not apply immediately. Configure local, machine-specific Chezmoi data first, then review the rendered changes. For this personal Omarchy computer, the local Chezmoi config must add the identity values that cannot be committed:

```toml
[data]
name = "Your Name"
editor = "zed"
github.username = "jotu"

[data.personal.git]
email = "personal@example.com"
signingKey = "YOUR_GPG_KEY_ID"
username = "jotu"

[data.personal.ssh]
identityFile = "id_ed25519"
```

Then inspect and apply:

```bash
mise exec -- chezmoi data
mise exec -- chezmoi diff
mise exec -- chezmoi apply
mise install
```

After validating the rendered Zsh setup, make Zsh the default shell for your user. Bash remains installed for scripts and fallback sessions:

```bash
chsh -s "$(command -v zsh)"
exec zsh -l
```

Applying the dotfiles installs the selected desktop applications through Omarchy:

```bash
omarchy install editor zed
omarchy install browser firefox
```

Those commands are intentionally Omarchy-specific. Do not add Zed, Firefox, Herdr, Pi, Hunk, OpenCode, Codex, Claude, Crush, Gemini, `omp`, or `gh` to the repository's Linux Mise fragments. Omarchy's managed wrappers live in `~/.local/bin`; the Linux Zsh profile puts that directory before Mise's shims so Omarchy remains authoritative. Omarchy may maintain global Mise state underneath those wrappers; that state is not the repository's source of ownership.

## macOS

The macOS setup targets Apple Silicon and uses standalone Mise with its Homebrew-compatible package backend. A real Homebrew installation is not required. Install Mise first:

```bash
curl -fsSL https://mise.run | sh
export PATH="$HOME/.local/bin:$PATH"

eval "$(mise activate zsh)"
mise use --global gh@latest
```

Authenticate GitHub using the existing SSH setup or `gh`, then run the checked-in bootstrap helper. The helper installs Chezmoi through Mise and initializes this repository by default; set `DOTFILES_REPO_URL` first when using another repository:

```bash
gh auth login --hostname github.com --git-protocol ssh
bash bootstrap
# Or: DOTFILES_REPO_URL=git@github.com:you/dotfiles.git bash bootstrap
mise exec -- chezmoi edit-config
mise exec -- chezmoi data
mise exec -- chezmoi diff
mise exec -- chezmoi apply
mise install ruby
mise exec -- mise bootstrap packages status
mise exec -- mise bootstrap packages apply --dry-run
mise exec -- mise bootstrap packages apply
mise run omlx:model:install
mise run omlx:start
mise install
```

Mise installs the declared macOS formulae and casks into `/opt/homebrew`. oMLX is intentionally excluded from that package bootstrap because older Mise releases cannot evaluate its tap formula; the existing oMLX installation remains available to the model and server tasks above. The macOS-only Pi configuration registers the oMLX endpoint at `http://127.0.0.1:8000/v1` and makes the pinned Qwen3 4B MLX model available through `/model`. See [oMLX and older Mise releases](#omlx-and-older-mise-releases).

Keep the packages updated with Mise:

```bash
mise exec -- mise bootstrap packages upgrade
mise up
```

The macOS profile keeps its existing mise-managed host tools; Linux support uses platform-specific templates and ignores.

## oMLX and older Mise releases

The oMLX tap formula uses Homebrew's `MacOS.version` API. Older Mise releases, including `2026.9.12`, do not expose that API while evaluating third-party tap formulae, so package bootstrap can fail with `uninitialized constant Omlx::MacOS`. The accompanying API metadata `404` is expected for this tap; it is not the root cause.

The oMLX tap and package declaration are disabled in the repository until a compatible Mise release is available. Do not add them back to the bootstrap configuration without first verifying that Mise can evaluate the formula.

## Post-apply checks

Run after `chezmoi apply`:

```bash
git config --show-origin --list
gh auth status --hostname github.com
ssh -T git@github.com
mise run dotfiles:health:check
```

On macOS, the health check also verifies Mise, AeroSpace, Voxtype, and the configured Voxtype model/output chain.

AeroSpace is installed and configured on macOS by chezmoi. Grant it Accessibility permission in System Settings → Privacy & Security → Accessibility. It starts automatically at login and uses `~/.aerospace.toml`.

