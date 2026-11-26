# New machine bootstrap

Setup for a new Apple Silicon macOS machine. Return to the [README](../README.md) for daily commands. Mise manages host packages and CLI tools.

The checked-in `bootstrap` helper runs the platform checks and initializes Chezmoi from `git@github.com:jotu/dotfiles.git` by default (`mise exec -- chezmoi init ...`). It deliberately stops before applying files. Set `DOTFILES_REPO_URL` to use a different repository. Run it from a checked-out copy after the machine has GitHub access.

## macOS

The macOS setup targets Apple Silicon and uses standalone Mise with its Homebrew-compatible package backend. The baseline does not require real Homebrew; the personal oMLX setup does. Install Mise first:

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
mise install
```

Mise installs the declared macOS formulae and casks into `/opt/homebrew`. Keep those declarations under Mise ownership: use Mise to upgrade them rather than running a general `brew upgrade`.

### Personal local-model setup

Work profiles skip this section. On personal machines, install [Homebrew](https://brew.sh/) using its reviewed installation instructions before continuing. Homebrew and Mise share `/opt/homebrew`; review the installer's proposed changes and preserve existing packages. Do not rerun the installer on a machine that already has Homebrew. Confirm `command -v brew` succeeds in the current shell.

Mise's package bootstrap excludes oMLX because Mise cannot evaluate its tap formula. Homebrew owns oMLX and any dependencies it installs; use the targeted oMLX upgrade procedure below, not a general Homebrew upgrade of Mise-owned packages.

```bash
mise run omlx:install                  # personal profile only; builds from source
mise run omlx:model:install            # qwen3.5-9b-4bit by default
mise run omlx:start
```

Run the installer before the model and server tasks. The personal macOS Pi configuration registers the oMLX endpoint at `http://127.0.0.1:8000/v1` and adds the pinned local models to its cycling scope. See [oMLX and Mise](#omlx-and-mise) and [Local model: when to use it](pi.md#local-model-when-to-use-it).

Keep the packages updated with Mise:

```bash
mise exec -- mise bootstrap packages upgrade
mise up
```

## oMLX and Mise

The oMLX tap formula uses Homebrew's `MacOS.version` API. Mise does not expose that API while evaluating third-party tap formulae. On Mise `2026.9.12` and again on `2026.11.2`, `mise bootstrap packages apply --dry-run` with the `jundot/omlx` tap and `brew:jundot/omlx/omlx` declared fails with `uninitialized constant Omlx::MacOS` (`Formula/omlx.rb:23`). The accompanying API metadata `404` is expected for this tap; it is not the root cause.

The oMLX tap and package declaration stay out of `[bootstrap.packages]`. The `omlx:install` task runs `brew tap jundot/omlx` and `brew install jundot/omlx/omlx`, pinning the tap to a commit; the formula pins its release tarball by SHA-256. It never runs automatically, and `mise upgrade` does not update oMLX. To upgrade, review the new formula, change `tap_commit` in the task, run `chezmoi apply`, then run `mise run omlx:install` and `brew upgrade omlx`. Do not move the install into `[bootstrap.packages]` without first verifying that a newer Mise release evaluates the formula.

## Post-apply checks

Run after `chezmoi apply`:

```bash
git config --show-origin --list
gh auth status --hostname github.com
ssh -T git@github.com
mise run dotfiles:health:check
```

The health check verifies Mise and AeroSpace on both profiles, plus oMLX on personal machines. It checks the personal GitHub profile and, on work machines, the work profile too. Run `mise run gh:auth:login:personal` to authenticate the personal profile; work machines also provide `mise run gh:auth:login:work`. Diagnostics ignore inherited GitHub tokens so they check each profile's stored login.

AeroSpace is installed and configured on macOS by chezmoi. Grant it Accessibility permission in System Settings → Privacy & Security → Accessibility. It starts automatically at login and uses `~/.aerospace.toml`.

