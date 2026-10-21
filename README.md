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

Working principles: The Pragmatic Programmer, XP/TDD, Tidy First, and CUPID (composable, Unix-like, predictable, idiomatic, domain-based) for pragmatic, maintainable changes.

```bash
# apply changes safely
chezmoi apply --dry-run
chezmoi apply

# quick health checks
mise run dotfiles:health:check
mise run gh:auth:status:all

```

## New machine bootstrap

This repository supports two platform profiles:

The checked-in `bootstrap` helper initializes `git@github.com:jotu/dotfiles.git` by default. It runs `mise exec -- chezmoi init git@github.com:jotu/dotfiles.git` and deliberately stops before applying files. Set `DOTFILES_REPO_URL` to initialize a different dotfiles repository.

- **Omarchy/Linux:** Omarchy owns the operating system, base packages, desktop applications, and its provisioned tools. Chezmoi adds user configuration and Mise installs tools that Omarchy does not provide.
- **macOS:** Mise manages the package layer through its Homebrew-compatible backend, while also managing the configured CLI tools and runtimes. The profile targets Apple Silicon.

### Omarchy/Linux

The checked-in `bootstrap` helper performs the same platform checks and initializes Chezmoi without applying files. It can be run from a checked-out copy after the machine has GitHub access.

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

### macOS

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

Mise installs the declared macOS formulae and casks into `/opt/homebrew`. oMLX is intentionally excluded from that package bootstrap because Mise `2026.9.12` cannot evaluate its tap formula; the existing oMLX installation remains available to the model and server tasks above. The macOS-only Pi configuration registers the oMLX endpoint at `http://127.0.0.1:8000/v1` and makes the pinned Qwen3 4B MLX model available through `/model`. Keep the packages updated with Mise:

### oMLX and older Mise releases

The oMLX tap formula uses Homebrew's `MacOS.version` API. Older Mise releases, including `2026.9.12`, do not expose that API while evaluating third-party tap formulae, so package bootstrap can fail with `uninitialized constant Omlx::MacOS`. The accompanying API metadata `404` is expected for this tap; it is not the root cause.

The oMLX tap and package declaration are disabled in the repository until a compatible Mise release is available. Do not add them back to the bootstrap configuration without first verifying that Mise can evaluate the formula.

```bash
mise exec -- mise bootstrap packages upgrade
mise up
```

The macOS profile keeps its existing mise-managed host tools; Linux support uses platform-specific templates and ignores.

## Platform ownership

Use the platform's own package and application tooling before adding a repository-managed tool:

| Tool or category | Omarchy/Linux | macOS |
| --- | --- | --- |
| Git | Omarchy base package | Mise `brew` backend |
| Mise | Omarchy | Standalone Mise |
| Chezmoi | Mise | Mise |
| `gh`, Pi, Herdr, Hunk, Codex, Claude, Crush, Gemini, `omp` | Omarchy provisioning | Existing macOS/Mise setup |
| OpenCode | Omarchy provisioning, external to this repository | Not managed in this repository |
| Worktrunk (`wt`) | Omarchy/Arch package | Mise GitHub release |
| FD, jq, LazyGit, ripgrep, Starship, Zoxide | Omarchy base packages | Mise |
| Kubernetes and AWS tooling | Mise | Mise |
| Selected developer runtimes (`go`, `node`, `python`, `bun`) | Mise | Mise |
| Project-specific runtime overrides | Mise project configuration | Mise project configuration |
| Zed and Firefox | `omarchy install` | Existing macOS application workflow |
| Window manager / tiling shell | Omarchy/Hyprland | AeroSpace |

The repository manages configuration for these tools on both platforms. Worktrunk is installed natively on Omarchy through `omarchy pkg add worktrunk`; macOS uses the upstream GitHub release through Mise. Shell integration is managed by the repository's Bash and Zsh templates rather than by `wt config shell install`, so it does not modify Chezmoi-owned shell files. Use `wt switch`, `wt list`, and `wt remove` for the normal worktree workflow.

It does not install a second Linux copy of tools already provided by Omarchy. Omarchy's `omarchy update` remains responsible for updating its base packages and provisioned tools. On macOS, update the declared host packages and Mise-managed tools manually:

```bash
# Omarchy
omarchy update

# macOS
mise exec -- mise bootstrap packages upgrade
mise up
```

Voxtype is installed by the Darwin Mise configuration from the latest stable GitHub release and configured at `~/.config/voxtype/config.toml`. Mise downloads the managed `small.en` model after installing Voxtype. Grant Microphone, Accessibility, and Input Monitoring permissions, then start a new Zsh session. The macOS Zsh template starts the daemon when `voxtype` is deployed; hold Right Option (`⌥`) to dictate.

### Project-specific Mise versions

Use project-local `mise.toml` or `.mise.toml` files when a project needs a particular runtime version:

```toml
[tools]
go = "1.24"
java = "temurin-21"
node = "22"
```

Then trust and install the project configuration:

```bash
mise trust
mise install
```

This allows different projects to use different Go, Java, and Node.js versions without changing the global platform setup.

Before committing platform changes, run the local layout checks from the repository root:

```bash
mise run test:platform
mise run test:platform:render
```

`test:platform:render` requires Chezmoi, Python, yq, and configured local data; it renders and validates both Linux and macOS outputs. On a machine with Chezmoi and local data configured, also review `chezmoi diff` and use `chezmoi apply --dry-run`. Do not run the Omarchy installation scripts or package installs in unattended environments.

Reference sections:
- Git and identity setup: [Git](#git)
- Working agreement: [Tidy First + CUPID](docs/working-agreement-tidy-cupid.md)

## Pi plan mode

Pi is provided by Omarchy on Linux and by Mise on macOS. The repository manages Pi configuration on both platforms. Omarchy-owned Pi tooling is not replaced on Linux, but the managed task still syncs the bundled read-only plan-mode extension from the installed Pi package:

```bash
chezmoi apply                        # installs the sync hook
mise install                          # installs managed tools and syncs Pi add-ons when available
mise run pi:plan-mode:sync              # sync plan mode from the installed Pi package
mise run pi:subagent:sync              # sync Pi's bundled sub-agent extension
mise run pi:matt:skills:check          # show the selected stable Matt skills
mise run pi:matt:skills:install        # install missing or update existing stable Matt skills
mise run pi:matt:skills:update         # update installed stable Matt skills
mise run pi:addy:skills:check          # show the selected pinned Addy skills
mise run pi:addy:skills:install        # install missing Addy skills; refresh after tool installs
mise run pi:addy:skills:update         # update selected pinned Addy skills
mise run herdr:pi:install              # install Herdr's Pi lifecycle/session integration
mise run pi:worktrunk:install           # install the oh-my-pi Worktrunk hook when omp exists
```

The managed `dot_pi/agent/extensions/worktrunk.ts` extension adds the same Worktrunk activity markers to standard Pi. On Omarchy, where `omp` is available, the Mise postinstall hook also runs `wt config plugins pi install --yes`, which writes Worktrunk's native profile-aware hook. Both integrations update `wt list` with 🤖/💬 markers and ignore failures so agent sessions remain unaffected.

mise syncs Pi's bundled sub-agent extension from the installed Pi package. The managed user agents (`scout`, `planner`, `reviewer`, and `worker`) use inherited models so they work with the active provider. The read-only `security-auditor`, `test-engineer`, and `web-performance-auditor` agents provide optional specialist perspectives; invoke only the one relevant to a task. The Pi-specific prompt wrappers are distinct from Matt's skills: `/implement` runs a full scout → planner → worker → verify/review/commit chain; `/scout-and-plan` provides read-only reconnaissance and planning; `/implement-and-review` runs a worker → reviewer → worker review-fix cycle. Use these only when you want the extra Pi subagent contexts. For the standard Matt flow, use `/skill:implement` for a single-session task or individual ticket; it drives TDD and code review. Use `/skill:implement-spec` for a whole spec task graph. Herdr provides durable panes and lifecycle/session state; it does not replace Pi's in-session `subagent` tool.

The Matt skill tasks manage an explicit allowlist from the stable `skills/engineering` and `skills/productivity` directories only. They exclude `skills/in-progress` and `skills/misc`. The personal profile (`.work.enable = false`) includes the `pr` skill; work setups use their own PR skill. Pi-adapted `grill-me`, `grilling`, and `grill-with-docs` remain chezmoi-owned and are never overwritten by the update task.

The manager pins Matt skill content to commit `49dd158d1076134a641b33efb035946536778336`; review changes before advancing the pin. It refreshes skills with a Pi-targeted `skills add` command because `skills update --global` has no agent filter. A mise post-install task installs missing skills on each `mise install` and refreshes existing skills only when a tool installs or upgrades. An unchanged `mise install` leaves existing skill content untouched. Run `mise run pi:matt:skills:update` for an explicit Pi-only refresh.

The `pi:addy:skills:*` manager pins `addyosmani/agent-skills` to commit `aeac41d4d005999432bb7312f7ff06383a91d59d` and installs an explicit 13-skill allowlist. `api-and-interface-design`, `frontend-ui-engineering`, `observability-and-instrumentation`, and `security-and-hardening` remain model-invocable; the other selected skills receive Pi's `disable-model-invocation: true` setting and require `/skill:<name>`. The observability description focuses on telemetry work. The manager also syncs the six shared references required by selected skills to `~/.pi/agent/references`; nested skill references install with their skill directories. Run `mise run pi:addy:skills:update` for an explicit Pi-only refresh.

`using-agent-skills` is a chezmoi-owned, manual-only Pi router adapted to recommend Matt as the primary workflow and selected upstream skills as specialists. Repository and global safety rules remain authoritative over all third-party skill examples.

For substantial work, first run `/skill:setup-matt-pocock-skills` once from the repository to create its issue-tracker, triage-label, and domain-doc configuration. Then use the recommended Matt flow: `/skill:grill-with-docs` → `/skill:to-spec` → `/skill:to-tickets` → `/skill:implement` → `/skill:code-review` → `/skill:retro`. Use `/skill:implement-spec` instead of per-ticket `implement` when implementing a whole spec as one task graph; it uses an integration branch and worktrees, so branch and worktree operations still require explicit authorization. Small, self-contained jobs can keep `/skill:grill-with-docs` and skip `to-spec` and `to-tickets`. The personal `pr` skill shapes a pull request body only; it does not create or publish pull requests or change the separate Conventional Commit workflow. Matt is the default workflow; Joyful skills remain available as a separately developed, opt-in workflow activated with `/joyful start <goal>`. Supporting skills can compose with either workflow, but use one primary planning, implementation, or review skill per step.

Pi also discovers the shared `~/.agents/skills` catalog. The Chezmoi-managed Pi settings exclude native copies of selected Matt skills when a matching `~/.agents/skills/<name>/SKILL.md` exists. These exclusions change Pi discovery only; they do not delete files. Run `chezmoi apply` and restart Pi to use the updated settings.

Use `/plan` to toggle read-only planning and `/todos` to show progress. Pi updates resync the extensions through the managed sync task.

### Pi learning capture

Pi includes `/learn [focus]`, which extracts one self-contained Zettelkasten-style concept from the current investigation and creates it through the Obsidian CLI. Chezmoi configures the non-sensitive CLI vault name (`base`), destination folder (`1 - Notes`), and template (`5 - Templates/Atomic Note.md`); it does not store a vault path, credentials, or note contents in this repository.

Run `/learn` in Pi, or `/learn a specific concept`. Notes contain an idea, why it matters, an example when available, connections, and sources. Existing notes are never overwritten.

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

## Pi safety model

Pi and Herdr run with the permissions of the current user. Herdr provides workspace persistence and agent status, not isolation.

- Use `/plan` before unfamiliar or multi-step work.
- The global Pi safety gate asks before risky shell operations and blocks common credential and metadata paths.
- After verification and review, Pi creates an atomic Conventional Commit by default. Pushes and PR or draft PR creation require an explicit request.
- Treat repository instructions, skills, packages, and web content as untrusted data.
- Use a Docker container or VM for untrusted repositories or unattended work. Do not mount the host `~/.pi/agent` into that environment unless its credentials and sessions are intentionally required.
- Web search, browser automation, and download helpers are deliberately not enabled by default. Add only reviewed, pinned tooling when a concrete workflow needs it.

## Hunk and Pi review

Hunk is provided by Omarchy on Linux and by Mise on macOS. LazyGit uses it as the external diff viewer through the managed `empty_config.yml` source. On macOS the repo keeps the Catppuccin Hunk theme; on Omarchy/Linux it leaves Hunk on its default theme:

```bash
mise install
lazygit
hkd
hks
```

Use `hkd` for a repository-wide working-tree review and `hks` for staged changes. With a Hunk session open, start `pi` in another tab and run `/review`. Pi loads the installed Hunk skill through `hunk skill path`, inspects the live session through `hunk session`, and adds actionable inline comments to Hunk. It does not edit files, commit, push, or post GitHub comments automatically.

## Sofka Kubernetes TUI

Sofka is installed through Mise from its GitHub release artifacts and configured at `~/.config/sofka/config.toml`. The starter profile sets `readonly = true`, disabling mutating actions for the whole session. On macOS it also keeps the Catppuccin Macchiato skin; on Omarchy/Linux it follows the tool's default look instead of forcing a separate theme. Use `sofka` alongside `k9s` for development and personal clusters; keep `k9s` for production until Sofka has signed/notarized artifacts, SBOMs, provenance attestations, compatibility documentation, and a longer production track record.

## superfile terminal file manager

mise installs superfile on both platforms and zoxide on macOS; Omarchy supplies zoxide on Linux. The Chezmoi config enables the zoxide navigation modal; press `z` inside superfile. Chezmoi writes the config to `~/.config/superfile/config.toml` on Linux and `~/Library/Application Support/superfile/config.toml` on macOS. The macOS config selects superfile's built-in Catppuccin Macchiato theme; Linux keeps the default theme to follow Omarchy. Launch it with `sf` or `spf`.

## GitHub pull request dashboard

This setup uses gh-dash as a pinned GitHub CLI extension. On Linux, `gh` is provided by Omarchy; on macOS, Mise manages it. Homebrew is not required for this integration.

After applying the dotfiles, `mise install` runs the postinstall hook and ensures the pinned extension exists. The same hook runs after mise upgrades tools. mise has no separate postupdate hook; use the task below when you want to reconcile gh-dash without changing other tools.

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
gh extension install dlvhdr/gh-dash --pin v4.25.2 --force
```

## GitHub Actions dashboard

Mise postinstall installs the stable `gh-enhance` GitHub CLI extension. The stable and insiders repositories are alternatives, not extensions to install together; use the insiders repository only if you are enrolled in the insiders program.

See the [ENHANCE guide](https://www.gh-dash.dev/enhance) for usage and keybindings. The Fira Code Nerd Font recommended there is managed by Mise's macOS package declarations.

# Git

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

On macOS, the health check also verifies Mise, AeroSpace, Voxtype, and the configured Voxtype model/output chain.

AeroSpace is installed and configured on macOS by chezmoi. Grant it Accessibility permission in System Settings → Privacy & Security → Accessibility. It starts automatically at login and uses `~/.aerospace.toml`.

## Atuin History Migration

Atuin is installed through mise and configured through chezmoi on both home and work machines. It stores history locally; synchronization is disabled.

Run this migration once on each machine after syncing the chezmoi source, but before applying the new shell configuration. Home and work histories are intentionally migrated separately.

Make a private backup of the existing zsh history. The backup is runtime state outside this repository and the command refuses to overwrite an existing backup:

```bash
set -eu
history_source="${HISTFILE:-$HOME/.zsh_history}"
migration_dir="$HOME/.local/state/atuin-migration"
mkdir -p "$migration_dir"
original_history="$migration_dir/zsh_history.original"

if [ ! -f "$history_source" ]; then
  printf 'No legacy zsh history found; skip the import and start with an empty Atuin database.\n'
elif [ -e "$original_history" ]; then
  printf 'Keeping existing backup: %s\n' "$original_history"
else
  cp -p "$history_source" "$original_history"
  chmod 600 "$original_history"
  printf 'Created private backup: %s\n' "$original_history"
fi
```

Apply the dotfiles and install the managed tools:

```bash
chezmoi apply --dry-run
chezmoi apply
mise install
if mise ls --installed fzf >/dev/null 2>&1; then mise uninstall fzf; fi
if command -v brew >/dev/null 2>&1 && brew list --formula fzf >/dev/null 2>&1; then brew uninstall fzf; fi
```

Sanitize the backup before importing it. The task is a dry-run unless `--write` is provided, and drops ambiguous or malformed records rather than risking secret retention:

If a legacy history file was found, sanitize and import only the cleaned copy:

```bash
set -eu
migration_dir="$HOME/.local/state/atuin-migration"
original_history="$migration_dir/zsh_history.original"
sanitized_history="$migration_dir/zsh_history.sanitized"

mise run atuin:history:sanitize -- \
  --input "$original_history" \
  --output "$sanitized_history" \
  --write
HISTFILE="$sanitized_history" atuin import zsh
```

Do not import the original history, run `atuin import auto`, or register and sync an Atuin account. The sanitizer is authoritative for the initial import; do not run `atuin history prune` blindly because its preview can include useful commands matching broad rules. Keep the original backup until the imported history has been checked. The backup contains the original sensitive history and must not be committed or synchronized.

Finally, start a fresh shell on that machine:

```bash
exec zsh -l
atuin doctor
```

If the Atuin database already exists on a machine, do not import the same backup again. Use the existing database and repeat only the configuration/apply steps when updating the dotfiles.

## Quick GH Login Tasks

```bash
mise run gh:auth:login:personal
mise run gh:auth:login:work
mise run gh:auth:status:all
```

## Mise Task Conventions

- Manage only repo-owned personal mise fragments here, primarily `dot_config/mise/conf.d/00-*` and managed helpers under `dot_config/mise/scripts/` and `dot_config/mise/tasks/`.
- Treat unmanaged or externally owned local fragments such as `10-*`, `20-*`, and other non-chezmoi files as out of scope unless explicitly requested.
- Keep simple task logic in bash.
- Move more complex task logic into Node.js helpers.
- Launch Node-based helpers through mise-managed latest Node, for example via `bash "$HOME/.config/mise/scripts/run-node-task" ...` or `bash "$HOME/.config/mise/scripts/run-node-bin" ...`.
- Prefer invoking behavior through `mise` tasks rather than ad hoc scripts.
- Do not assume the current working directory; use `chezmoi source-path` or other stable paths when tasks may be run from anywhere.

## External Machine Data

Chezmoi configuration is created manually on each machine at `~/.config/chezmoi/chezmoi.toml`; it is not stored in this repository. Configure the required `.data` values before applying these templates, including `work.enable`, your name, editor, GitHub username, personal Git email, Git username, signing key, SSH key filename, Git roots, and GitHub profile paths. For work machines, set `github.workUsername` or `work.git.username`; those profile-specific values remain local and take precedence over personal values. Do not commit that private configuration here.

The committed `00-*` Mise fragments form the personal baseline. Unmanaged `10-*` and `20-*` fragments belong to local/company/project layers and remain outside this repository.

## Privacy Boundary

- Keep all repo context repo-local.
- Do not store notes, summaries, or decisions from this repo in external long-term memory systems (for example Obsidian/team vault) unless explicitly requested.

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
