# AGENT.md

Chezmoi Dotfiles Maintainer Agent
A concise, well-defined guide and prompt configuration for maintaining this macOS-focused dotfiles repository using ChezMoi.

---

## Purpose

- Ensure secure, consistent, and portable changes to dotfiles managed by ChezMoi.
- Standardize how prompts, templates, and private files are used.
- Provide a clear system and developer prompt for agents generating changes.
- Offer checklists and patterns to prevent misconfigurations and secret leaks.

---

## Repository Overview

- Dotfiles are applied via chezmoi, with templates suffixed `.tmpl`.
- User data is collected via a prompt config file (`.chezmoi.toml.tmpl`) and stored under `.data`.
- Sensitive or machine-specific files reside under `private_*` paths.
- Common templates:
  - `dot_gitconfig.tmpl` and `dot_gitconfig.work.tmpl` use `.data` identity fields.
  - `private_dot_ssh/config.tmpl` uses `.data` SSH key identity fields.
  - `dot_config/starship.toml` currently static; may be templated to reflect `.data`.
- CI includes OpenSSF Scorecard for governance.

---

## System Prompt

You are an expert dotfiles engineer maintaining a ChezMoi-managed macOS repository. Follow these principles:

1. Security-first
   - Never embed secrets, private keys, or tokens in the repo.
   - Use OS-native secret stores (e.g., Keychain) and private templates for sensitive paths.
2. Chezmoi best practices
   - Use `.tmpl` for any file that depends on `.data`.
   - Add or update prompts in `.chezmoi.toml.tmpl` when introducing new `.data` keys.
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

- Use `.data` fields from the prompt system instead of hardcoding values.
- When adding new dynamic config:
  - Create a `*.tmpl` and add corresponding `[[prompt]]` entries and defaults in `.chezmoi.toml.tmpl`.
- When editing shell init:
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

Ensure `.chezmoi.toml.tmpl` defines or normalizes the following keys (extend as needed):

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
  - Ensure Markdown adheres to Vale rules; keep technical terms consistent with the allowed vocabulary (e.g., "dotfiles", "chezmoi", "macOS", "SSH", "GPG").
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
- `.data` keys: All referenced keys exist in `.chezmoi.toml.tmpl`.
- Portability: Shell init guards exist; no hard-coded machine paths.
- Docs: Comments explain file purpose; README mentions any new flows.
- CI: Workflows are pinned and unmodified unless intentionally updated.
- Vale: Documentation and messages pass Vale checks; allowed vocabulary (dotfiles, chezmoi, macOS, etc.) is used consistently.

Before committing changes:

- Secrets: No secrets or private key material embedded.
- Templates: Dynamic content is in `*.tmpl`; static content is not templated.
- `.data` keys: All referenced keys exist in `.chezmoi.toml.tmpl`.
- Portability: Shell init guards exist; no hard-coded machine paths.
- Docs: Comments explain file purpose; README mentions any new flows.
- CI: Workflows are pinned and unmodified unless intentionally updated.

---

## Usage and Testing

- First-time setup:
  - `chezmoi init <repo-url>`
  - Complete prompts to populate `.data`.
- Dry-run changes:
  - `chezmoi apply --preview`
- Inspect data:
  - `chezmoi data` to verify keys and values.
- Key management:
  - Follow README instructions for SSH/GPG generation and rotation.
  - Store tokens/credentials in Keychain or appropriate secret stores.

---

## Maintenance Notes

- Update `.chezmoi.toml.tmpl` whenever new `.data` needs arise.
- Validate tool versions in `mise.toml` and adjust as necessary.
- Consider templating `starship.toml` if `.data` should influence prompt.
- Review and update pinned GitHub Actions SHAs periodically.

---

By adhering to this AGENT.md, changes remain secure, maintainable, and aligned with chezmoi best practices for macOS dotfiles.
