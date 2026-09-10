# AGENT.md

Chezmoi dotfiles maintainer guide for secure, portable, low-risk changes.

---

## Purpose

- Ensure secure, consistent, and portable changes to dotfiles managed by Chezmoi on macOS and Omarchy/Linux.
- Standardize how prompts, templates, and private files are used.
- Offer checklists and patterns to prevent misconfigurations and secret leaks.
- Follow Tidy First principles together with CUPID design principles for joyful, maintainable coding.

---

## Repository Overview

- Dotfiles are applied via chezmoi, with templates suffixed `.tmpl`.
- Machine-specific user data is maintained in external private ChezMoi configuration and exposed to templates through `.data`.
- Sensitive or machine-specific files reside under `private_*` paths.
- Common templates:
  - `dot_gitconfig.tmpl` and `dot_gitconfig.work.tmpl` use `.data` identity fields.
  - `private_dot_ssh/config.tmpl` uses `.data` SSH key identity fields.
  - `dot_config/starship.toml` currently static; may be templated to reflect `.data`.
- CI includes OpenSSF Scorecard for governance.

---

## System Prompt

You are an expert dotfiles engineer maintaining a Chezmoi-managed macOS and Omarchy/Linux repository. Follow these principles:

1. Security-first
   - Never embed secrets, private keys, or tokens in the repo.
   - Use OS-native secret stores (e.g., Keychain) and private templates for sensitive paths.
2. Chezmoi best practices
   - Use `.tmpl` for any file that depends on `.data`.
   - Keep external private data documentation updated when introducing new `.data` keys.
   - Keep machine-specific content under `private_*`.
3. Portability and resilience
   - Assume tools may not exist; guard shell initialization with command checks.
   - Prefer relative, cross-machine-compatible paths.
4. Clarity and minimalism
   - Make small, explicit changes.
   - Document intent at the top of new files.
5. Operability
   - Provide preview/testing steps (e.g., `chezmoi apply --preview`).
   - Avoid long-running commands and watchers in instructions.

---

## Developer Prompt

- Use Vale for writing and reviews:
  - Follow the repository’s Vale configuration (`.vale.ini`) and styles under `.github/styles/`.
  - Respect the custom vocabulary (Vocab: Base) — domain terms like "dotfiles", "chezmoi", "macOS", "OpenSSF", tool/language names, etc., are allowed and should not be altered unless inconsistent.
  - Avoid weasel words and maintain professional tone in documentation and commit messages.

- Use `.data` fields from the external private configuration instead of hardcoding values.
- When adding new dynamic config:
  - Create a `*.tmpl` and document the corresponding required values in the external private configuration.
- When editing shell init:
  - Preserve Omarchy's Bash initialization on Linux.
  - Keep macOS Zsh behavior stable.
  - Guard commands (brew, starship, mise, thefuck) with existence checks.
- For Git:
  - Respect `includeIf` and work/personal separation.
  - Ensure signing keys and emails come from `.data`.
- For Starship:
  - If behavior depends on `.data`, convert to a template and toggle modules accordingly.
- Documentation:
  - Keep README updated for initial setup and secrets guidance.

---

## Recommended `.data` Keys

Ensure the external private configuration defines or normalizes the following keys (extend as needed):

- Identity:
  - `name`
  - `editor`
- Git:
  - `personal.git.email`
  - `personal.git.signingKey`
  - `work.enable`
  - `work.git.email` (conditional)
  - `work.git.signingKey` (conditional)
- SSH:
  - `personal.ssh.identityFile`
  - `work.ssh.organization.identityFile` (conditional)
- Prompt/CLI:
  - `starship.enable_kubernetes`
  - `dev.langs` (e.g., `["nodejs","python","golang"]`)
  - `aws.profile`
  - `shell.show_sudo`
  - `shell.show_docker_context`
- Tooling:
  - `github.username`

---

## File Conventions

- Template files: `*.tmpl`
  - Use `.data` for dynamic values and conditionals.
  - Include a brief header comment explaining intent.
- Private files: `private_*`
  - Store machine-specific/secret-adjacent config here.
  - Never embed secrets; reference identity file names or key fingerprints only.
- Static config:
  - Use non-templated files where content is universally the same.
  - Consider templating when behavior should adapt to `.data`.
- Ignore policies:
  - Keep non-home-targeted documentation out of apply scope (e.g., add `AGENT.md` to `.chezmoiignore` if undesired in `$HOME`).

---

## Security Guidance

- Documentation quality:
  - Ensure Markdown follows Vale rules and consistent vocabulary (for example: "dotfiles", "chezmoi", "macOS", "SSH", "GPG").
  - Use inclusive language and avoid vague phrasing where feasible.

- Secrets handling:
  - Use Keychain or other secret stores rather than keeping secrets in repo.
  - Document retrieval/usage, not values.
- SSH/GPG:
  - Reference key filenames or fingerprints via `.data`.
  - Provide README instructions for generating and rotating keys.
- CI:
  - Keep GitHub Actions pinned to SHAs and review updates periodically.

---

## Shell Init Best Practices

- On Omarchy/Linux, source Omarchy's user-safe Bash environment and defaults before loading shared aliases.
- On macOS, preserve the existing Zsh initialization and Homebrew integration.
- Guard optional tools:
  - `if command -v brew >/dev/null; then ... fi`
  - `if command -v starship >/dev/null; then eval "$(starship init zsh)"; fi`
  - `if command -v mise >/dev/null; then eval "$(mise activate zsh --shims)"; fi`
  - `if command -v thefuck >/dev/null; then eval "$(thefuck --alias fuck)"; fi`
- Keep PATH updates predictable and prepend only when necessary.
- Load completions conditionally to avoid startup failures.

---

## Starship Template Recommendations

If templating `dot_config/starship.toml`:

- Toggle modules via `.data`, e.g.:
  - Kubernetes: disable when `! .starship.enable_kubernetes`
  - AWS: disable when `! .aws.profile`
  - Language modules: enable/disable based on membership in `.dev.langs`
- Keep performance-friendly defaults and ensure format lines remain readable.

---

## Review Checklist

Before committing changes:

- Secrets: No secrets or private key material embedded.
- Templates: Dynamic content is in `*.tmpl`; static content is not templated.
- `.data` keys: All referenced keys exist in the external private configuration.
- Portability: Shell init guards exist; no hard-coded machine paths.
- Docs: Comments explain file purpose; README mentions any new flows.
- CI: Workflows are pinned and unmodified unless intentionally updated.
- Vale: Documentation and messages pass Vale checks; allowed vocabulary (dotfiles, chezmoi, macOS, etc.) is used consistently.

---

## Usage and Testing

- First-time setup:
  - On Omarchy, use the preinstalled Mise and Omarchy-provisioned GitHub tooling, then run `mise use --global chezmoi@latest`.
  - On macOS, install Homebrew and Mise first, then run `mise use --global chezmoi@latest`.
  - `chezmoi init <repo-url>`
  - Configure the external private data required to populate `.data`.
- Dry-run changes:
  - `chezmoi apply --preview`
- Inspect data:
  - `chezmoi data` to verify keys and values.
- Key management:
  - Follow README instructions for SSH/GPG generation and rotation.
  - Store tokens/credentials in Keychain or appropriate secret stores.

---

## Maintenance Notes

- Update the external private data configuration whenever new `.data` needs arise.
- Validate tool versions in `mise.toml` and adjust as necessary.
- Consider templating `starship.toml` if `.data` should influence prompt.
- Review and update pinned GitHub Actions SHAs periodically.

---

By adhering to this AGENT.md, changes remain secure, maintainable, and aligned with Chezmoi, macOS, and Omarchy best practices.
