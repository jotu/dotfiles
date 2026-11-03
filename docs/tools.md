# Terminal and developer tools

## Herdr work setup

Herdr is the persistent terminal workspace for local development. Keep one workspace per repository and use separate tabs for focused roles:

- `shell`: Git, Mise, tests, and logs.
- `pi`: planning, exploration, and read-only analysis.
- `lazygit`: optional visual Git history and staging.

Start Herdr from the repository root with the short `hr` alias. It is intentionally manual rather than an automatic shell-startup hook, so Herdr does not nest inside its own shells or restart agents unexpectedly:

```bash
hr
# equivalent full command:
herdr
```

Common aliases are kept short and recognizable. Where Omarchy already has a short alias for a safe command, macOS keeps the same shape when the tool exists so muscle memory stays close across platforms:

| Alias | Command | Purpose |
| --- | --- | --- |
| `h` / `hr` | `herdr` | Start Herdr in the current directory |
| `a` | `omarchy-agent --inline` | Start the Omarchy agent when installed |
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

Inside Herdr, use one tab for each role:

```text
shell:    mise run dotfiles:health:check
pi:       pi
```

Herdr preserves the workspace layout but does not automatically restart coding agents after a restart. Use `herdr agent list` to inspect detected Pi sessions. On macOS the repo keeps the custom Catppuccin Herdr theme; on Omarchy/Linux it keeps personal layout preferences but uses Herdr's terminal theme to stay aligned with Omarchy.


## Sofka Kubernetes TUI

Sofka is installed through Mise from its GitHub release artifacts and configured at `~/.config/sofka/config.toml`. The starter profile sets `readonly = true`, disabling mutating actions for the whole session. On macOS it also keeps the Catppuccin Macchiato skin; on Omarchy/Linux it follows the tool's default look instead of forcing a separate theme. Use `sofka` alongside `k9s` for development and personal clusters; keep `k9s` for production until Sofka has signed/notarized artifacts, SBOMs, provenance attestations, compatibility documentation, and a longer production track record.

## superfile terminal file manager

mise installs superfile on both platforms and zoxide on macOS; Omarchy supplies zoxide on Linux. The Chezmoi config enables the zoxide navigation modal; press `z` inside superfile. Chezmoi writes the config to `~/.config/superfile/config.toml` on Linux and `~/Library/Application Support/superfile/config.toml` on macOS. The macOS config selects superfile's built-in Catppuccin Macchiato theme; Linux keeps the default theme to follow Omarchy. Launch it with `sf` or `spf`.

## TUIOS terminal multiplexer

mise installs `tuios` from source with Go on macOS and Omarchy/Linux. Chezmoi configures Catppuccin Macchiato on macOS and follows Omarchy's active theme on Linux. New TUIOS sessions start tiled so split bindings work immediately; press `Ctrl+B`, then `Space` to toggle tiling. Chezmoi also manages the TUIOS zsh completion at `~/.config/zsh/completions/_tuios` and prepends that directory to `fpath` in both zsh profiles. The same zsh setup loads it in ghostty, so no terminal-specific setting applies.

Run `chezmoi apply` to write the config, then `mise install` to install TUIOS. The mise postinstall tasks refresh the Chezmoi-managed completion and install or refresh the Pi integration when the required commands appear on `PATH`. The integration reports Pi's turn state in `tuios` panes and adds a short skill stub under `~/.agents/skills/tuios`. TUIOS owns its generated Pi extension and leaves Pi settings alone. Run `mise run tuios:completion:sync` to refresh the completion manually or `mise run tuios:pi:install` for the Pi integration; check the latter with `tuios integration status` or `tuios doctor agents`. If you install both TUIOS and Herdr integrations, `tuios` reports pane state and Herdr supplies session metadata.

## GitHub pull request dashboard

This setup uses gh-dash as a pinned GitHub CLI extension. On Linux, `gh` is provided by Omarchy; on macOS, Mise manages it. Homebrew is not required for this integration.

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

Chezmoi writes the dashboard configuration to `~/.config/gh-dash/config.yml`. It starts with PR queues for review requests, your PRs, and involved PRs. On macOS the config also keeps the custom Catppuccin-flavored color overrides; on Omarchy/Linux it leaves gh-dash on its default theme. The existing GitHub CLI profiles select authentication:

```bash
GH_CONFIG_DIR="$HOME/.config/gh-personal" gh dash
GH_CONFIG_DIR="$HOME/.config/gh-work" gh dash
```

The shared config intentionally omits `repoPaths`, because this setup has separate machine-dependent personal and work repository roots. Use `gh pr checkout` manually for now; the Hunk + Pi review flow remains unchanged.

On a machine without the managed setup, install `gh` with the platform package manager and then install the same pinned extension directly:

```bash
# macOS: mise use --global gh@latest
# Omarchy: omarchy refresh applications
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
Workspace shortcuts keep the same layout on both platforms, with the platform-native primary modifier:

macOS: cmd-shift-g -> LazyGit
macOS: cmd-p       -> Television
macOS: cmd-shift-f -> Superfile
Linux: ctrl-shift-g -> LazyGit
Linux: ctrl-p       -> Television
Linux: ctrl-shift-f -> Superfile
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

Shell completions are platform-specific. On macOS and Omarchy/Linux Zsh, completions are cached daily in `${XDG_CACHE_HOME:-~/.cache}/zsh_completions.d`. Omarchy/Linux Bash continues to keep Omarchy's stock completion setup and then loads repo-managed Bash completions. Both shells cover commands such as `chezmoi`, `kubectl`, `mise`, `herdr`, `lazygit`, and optional work tools. Pi and Hunk do not currently expose first-party completion entrypoints here, so the profiles add lightweight custom subcommand completion for them.

On Omarchy, install Zed through Omarchy so its desktop integration and theme defaults are configured. The Linux profile uses the Omarchy-aligned `Omazed` dark theme instead of the macOS Catppuccin override:

```bash
omarchy install editor zed
```

On macOS, install Zed manually or through your preferred macOS application workflow if it is not already present.
