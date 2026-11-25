# Terminal and developer tools

## Shell aliases

Common aliases are kept short and recognizable:

| Alias | Command | Purpose |
| --- | --- | --- |
| `cx` | `claude` | Start Claude with its normal permission mode when installed |
| `cy` | `codex` | Start Codex with its normal approval mode when installed |
| `cm` | `chezmoi` | Manage the dotfiles source |
| `m` / `mup` | `mise` / `MISE_MINIMUM_RELEASE_AGE=0 mise up` | Mise CLI and update |
| `g` | `git` | Git CLI |
| `d` | `docker` | Docker CLI |
| `k` | `kubectl` | Kubernetes CLI |
| `kgp` | `kubectl get pods` | List pods |
| `kgn` | `kubectl get nodes` | List nodes |
| `klf` | `kubectl logs -f` | Follow pod logs |
| `kex` | `kubectl exec -it` | Open an interactive pod command |
| `k9` | `k9s` | Kubernetes terminal UI |
| `s9` | `sofka` | Sofka Kubernetes terminal UI |
| `sf` | `spf` | Superfile terminal file manager |
| `lg` | `lazygit` | Git terminal UI |
| `hkd` | `hunk diff` | Review working-tree changes in Hunk |
| `hks` | `hunk diff --staged` | Review staged changes in Hunk |
| `ghd` | `gh dash` | Open the GitHub PR dashboard |
| `dc` | `docker compose` | Docker Compose commands |
| `t` | `tmux attach || tmux new -s Work` | Attach to or create the Work session when installed |
| `gof` | `gofmt -w` | Format Go files |
| `gol` | `golangci-lint run` | Run Go linting |
| `shc` | `shellcheck` | Check shell scripts |
| `shf` | `shfmt -w` | Format shell scripts |
| `sht` | `shellspec` | Run shell tests |

Aliases for optional tools are defined only when the command is installed. Mise is the macOS bootstrap layer, using its Homebrew-compatible backend for host packages and its native short commands such as `mise i`, `mise r`, and `mise x` for versioned developer tools.

`sar` and `avr` are shell functions because SSH-agent and AWS Vault environment changes must persist in the current shell.

## Command correction

Chezmoi declares `thefuck` as a Homebrew package in Mise's package bootstrap. After applying the dotfiles, install or reconcile that package with `mise bootstrap packages apply brew:thefuck`; this does not run a general `mise install`. The shell loads the `fuck` alias on first use.

If an older Mise-managed Python installation shadows the Homebrew executable, inspect it with `mise ls --installed` and `command -v thefuck`. After verifying `/opt/homebrew/bin/thefuck --version`, remove the old `pipx:thefuck` version with `mise uninstall pipx:thefuck@<version>`, then restart the shell and check `thefuck --version`. Preserve the older installation if another project still needs it.

## Sofka Kubernetes TUI

Sofka is installed through Mise from its GitHub release artifacts and configured at `~/.config/sofka/config.toml`. The profile sets `readonly = false`, enabling mutating actions subject to the current Kubernetes context's permissions. The profile uses the Catppuccin Macchiato skin. Use `sofka` alongside `k9s` for development and personal clusters; keep `k9s` for production until Sofka has signed/notarized artifacts, SBOMs, provenance attestations, compatibility documentation, and a longer production track record.

## superfile terminal file manager

Mise installs superfile and zoxide. The Chezmoi config enables the zoxide navigation modal; press `z` inside superfile. The config lives at `~/Library/Application Support/superfile/config.toml` and selects the built-in Catppuccin Macchiato theme. Launch it with `sf` or `spf`.

## GitHub pull request dashboard

This setup uses gh-dash as a pinned GitHub CLI extension. Mise manages `gh`. Homebrew is not required for this integration.

After applying the dotfiles, `mise install` runs the postinstall hook and ensures the pinned extension exists. The same hook runs after mise upgrades tools. mise has no separate post-update hook; use the task below when you want to reconcile gh-dash without changing other tools.

To reconcile gh-dash independently:

```bash
mise run gh:dash:install
# alias: ghdi
```

Launch the dashboard with:

```bash
ghd
# equivalent: gh dash
```

For a selected PR, gh-dash provides built-in preview, diff, comment, and review actions. Its `c` action adds a general PR comment; it does not create a line-specific code suggestion.

Chezmoi writes the dashboard configuration to `~/.config/gh-dash/config.yml`. It starts with PR queues for review requests, your PRs, and involved PRs. The config also keeps the custom Catppuccin-flavored color overrides. The existing GitHub CLI profiles select authentication:

```bash
GH_CONFIG_DIR="$HOME/.config/gh-personal" gh dash
GH_CONFIG_DIR="$HOME/.config/gh-work" gh dash
```

The shared config intentionally omits `repoPaths`, because this setup has separate machine-dependent personal and work repository roots. Use `gh pr checkout` manually for now; the Hunk + Pi review flow remains unchanged.

On a machine without the managed setup, install `gh` with the platform package manager and then install the same pinned extension directly:

```bash
# macOS: mise use --global gh@latest
# <version>: the dlvhdr/gh-dash pin in dot_config/mise/conf.d/00-base.toml.tmpl
gh extension install dlvhdr/gh-dash --pin <version> --force
```

## GitHub Actions dashboard

Mise postinstall installs the stable `gh-enhance` GitHub CLI extension. The stable and insiders repositories are alternatives, not extensions to install together; use the insiders repository only if you are enrolled in the insiders program.

See the [ENHANCE guide](https://www.gh-dash.dev/enhance) for usage and keybindings. The Fira Code Nerd Font recommended there is managed by Mise's macOS package declarations.


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
macOS: cmd-shift-g -> LazyGit
macOS: cmd-p       -> Television
macOS: cmd-shift-f -> Superfile
```

Quick verify after apply:

```bash
git config --get core.excludesfile
mise install
command -v lazygit
command -v tv
command -v spf
```

Zed’s managed MCP configuration intentionally leaves the GitHub token unset.
Configure MCP authentication through Zed or the MCP server’s native secret-store
integration instead of adding a token to local Chezmoi data.

Zsh completions are cached daily in `${XDG_CACHE_HOME:-~/.cache}/zsh_completions.d`. They cover commands such as `chezmoi`, `kubectl`, `mise`, `lazygit`, and optional work tools. Pi and Hunk use lightweight custom subcommand completion.

Install Zed manually or through your preferred macOS application workflow if it is not already present.
