# Chezmoi repository guide

Maintain portable, secure dotfiles for macOS and Omarchy/Linux. Keep changes small, explicit, and reversible.

## Project context

- For implementation and structural cleanup, follow `docs/working-agreement-tidy-cupid.md`.
- For issues and specs, use `.scratch/<feature-slug>/` and read `docs/agents/issue-tracker.md`; use `docs/agents/triage-labels.md` for labels.
- For domain exploration or changes to domain language, read `docs/agents/domain.md` and `GLOSSARY.md`.
- For configuration data, use `docs/data-keys.md` as the key inventory and run `mise run test:data-keys` after changes. For new required keys, document setup and upgrade steps for existing machines, or provide a backward-compatible default.

## Security and Chezmoi

- Never commit secrets, private keys, tokens, or machine-specific identity values. Keep machine-specific values in the external Chezmoi configuration and reference them through `.data`; use OS-native secret stores for secrets.
- Use Chezmoi's `private_*` prefix for sensitive or machine-specific destination files to restrict permissions; it does not make repository content confidential.
- Use `.tmpl` for files whose contents depend on platform or `.data`; keep static configuration non-templated. Explain intent at the top of new templates.
- Keep non-home-targeted documentation out of the Chezmoi apply scope, for example with `.chezmoiignore`.
- Get approval before applying outside the assigned worktree. Preview only the intended targets, without exposing private data, and preserve unrelated destination changes.

## Platform and configuration

- When changing shell initialization, preserve Omarchy's user-safe Bash initialization and macOS Zsh behavior. Guard optional tools, keep PATH changes predictable, and prefer cross-machine-compatible paths over hard-coded user paths.
- Keep Git work/personal `includeIf` separation; source identities and signing keys from `.data`.
- Keep initial setup and secrets guidance in `README.md` and platform-specific setup in the relevant `docs/` pages.
- Keep GitHub Actions pinned to commit SHAs and review updates periodically.

## Verification

- Run relevant tests after changes; use `mise run test` for the full offline suite when practical.
- Run `mise run test:vale:changed` for changed Markdown and follow `.vale.ini` and the Base vocabulary.
- Check platform rendering when changing templates. Never print private configuration or secret values during validation.
- Review the diff for scope, portability, secrets, and Tidy First/CUPID before committing.
