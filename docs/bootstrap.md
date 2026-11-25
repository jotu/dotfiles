# New machine bootstrap

Setup for a new Apple Silicon macOS machine. Return to the [README](../README.md) for daily commands. Mise manages host packages and CLI tools.

The checked-in `bootstrap` helper runs the platform checks and initializes Chezmoi from `git@github.com:jotu/dotfiles.git` by default (`mise exec -- chezmoi init ...`). It deliberately stops before applying files. Set `DOTFILES_REPO_URL` to use a different repository. Run it from a checked-out copy after the machine has GitHub access.

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
mise run omlx:install                  # personal profile only; builds from source
mise run omlx:model:install            # qwen3.5-9b-4bit (default); pass a model ID to select another
mise run omlx:start
mise install
```

Mise installs the declared macOS formulae and casks into `/opt/homebrew`. oMLX is intentionally excluded from that package bootstrap because Mise cannot yet evaluate its tap formula, so the personal-profile task `mise run omlx:install` installs it with Homebrew instead; work profiles do not get the task. Run it before the model and server tasks. The personal macOS Pi configuration registers the oMLX endpoint at `http://127.0.0.1:8000/v1` and adds the pinned local models to its cycling scope. See [oMLX and Mise](#omlx-and-mise) and [Local model: when to use it](pi.md#local-model-when-to-use-it).

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

On macOS, the health check also verifies Mise, AeroSpace, and oMLX.

AeroSpace is installed and configured on macOS by chezmoi. Grant it Accessibility permission in System Settings → Privacy & Security → Accessibility. It starts automatically at login and uses `~/.aerospace.toml`.

