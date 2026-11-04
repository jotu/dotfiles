<div align="center">

[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/jotu/dotfiles/badge)](https://scorecard.dev/viewer/?uri=github.com/jotu/dotfiles)

</div>

# Dotfiles

Chezmoi-managed dotfiles for Omarchy/Linux and Apple Silicon macOS. Everything except sensitive, machine-specific data lives here, so a new computer can be set up and kept in sync.

## Daily commands

```bash
# apply changes safely
chezmoi apply --dry-run
chezmoi apply

# quick health checks
mise run dotfiles:health:check
mise run gh:auth:status:all
```

## Documentation

| Topic | Page |
| --- | --- |
| Set up a new machine and verify it | [docs/bootstrap.md](docs/bootstrap.md) |
| Platform ownership, Worktrunk, Mise conventions, machine data | [docs/platform-ownership.md](docs/platform-ownership.md) |
| Pi plan mode, skills, subagents, safety model, Hunk review | [docs/pi.md](docs/pi.md) |
| Herdr, TUIOS, Sofka, superfile, gh-dash, Zed, aliases | [docs/tools.md](docs/tools.md) |
| Git identity, GitHub profiles, SSH and signing setup | [docs/git-identity.md](docs/git-identity.md) |
| Every Chezmoi data key that templates read | [docs/data-keys.md](docs/data-keys.md) |
| Atuin history migration (one-off runbook) | [docs/runbooks/atuin-history-migration.md](docs/runbooks/atuin-history-migration.md) |
| Working agreement: Tidy First and CUPID | [docs/working-agreement-tidy-cupid.md](docs/working-agreement-tidy-cupid.md) |
| Agent rules and repository conventions | [AGENTS.md](AGENTS.md), [GLOSSARY.md](GLOSSARY.md) |

## Platform profiles

- **Omarchy/Linux:** Omarchy owns the operating system, base packages, desktop applications, and its provisioned tools. Chezmoi adds user configuration and Mise installs the rest.
- **macOS:** Mise manages packages through its Homebrew-compatible backend, along with CLI tools and runtimes.

Tool versions are pinned in `dot_config/mise/conf.d/00-base.toml.tmpl` and `mise.toml`; Renovate proposes updates.

## Checks before committing

Install the Git hooks once per checkout. They run the same Mise tasks as CI:

```bash
mise run hk:install
```

`pre-commit` renders the templates, checks the data-key docs, and checks the platform layout. `pre-push` runs the full offline suite and the Vale check. Run them manually with:

```bash
mise run test            # everything CI runs, except the Vale diff
mise run test:vale:changed
```

The offline tests use fixture data from `tests/fixtures/chezmoi-data.json`, not your local Chezmoi config. `test:platform:render` still needs Chezmoi, yq, and configured local data. See [docs/platform-ownership.md](docs/platform-ownership.md) for what each check covers.

## Privacy boundary

Machine-specific data lives in `~/.config/chezmoi/chezmoi.toml`, outside this repository. Never commit secrets or private keys. Keep repository context local; do not copy notes from this repository to external long-term memory unless asked.
