# Platform ownership and Mise conventions

## Platform ownership

This repository targets Apple Silicon macOS. Mise manages host packages, developer tools, runtimes, and Worktrunk; AeroSpace manages window tiling. Project-specific runtime overrides belong in project Mise configuration. Worktrunk places task checkouts under `~/.worktrunk/<owner>/<repo>/<branch-slug>`, outside the repository.

Removing the source does not remove all installed Herdr and TUIOS files. Git worktrees must remain untouched.

Keep the primary checkout clean on the default (`main`) branch, and run `git pull --ff-only` there before `wt switch --create <branch>`. Worktrunk uses the default branch's local ref and does not fetch; existing task worktrees do not advance automatically when `main` changes.

After you trust the `mise` config in a repository's main checkout with `mise trust`, mise also trusts the same config path in that repository's Git worktrees; no blanket trust for `~/.worktrunk` is needed. Paranoid mode disables inherited worktree trust, so trust each config explicitly in that mode.

The global Worktrunk config sets `merge.squash = true` and `merge.rebase = true`, matching Worktrunk's default local integration: `wt merge` rebases task commits onto the local target, squashes them into one commit, then fast-forwards. Refresh the target first and use `wt merge` only for an unshared branch; a needed rebase rewrites commit IDs.

Worktrunk's `[commit.generation]` runs Pi headless (no tools, extensions, skills, or context files, thinking off) to write commit and squash messages. The template `dot_config/worktrunk/config.toml.tmpl` selects the model by profile: `github-copilot/claude-haiku-4.5` for personal use and `openai-codex/gpt-6-luna` when `work.enable` is set. Hosted generation can send change content to a remote service; Pi's `--offline` does not disable inference requests. Get task-scoped approval before a hosted request, or use a reviewed local/manual message. A `template-append` fragment requests Conventional Commit subjects. Check the resulting message with `git log -1` before pushing.

For a PR, fetch the target and run `wt step rebase origin/main` in the unshared task worktree before the first push. Keep the task branch's commits separate and do not use `wt merge` to prepare the PR: that command integrates into local `main` and removes the task worktree by default. GitHub's eventual PR merge strategy remains the user's choice. For repositories where you intentionally push directly to an unprotected `main`, refresh `main` and use `wt merge` to rebase and squash locally into one commit before fast-forwarding. Review the result, then push `main` separately when requested; `wt merge` does not push. Pass `--no-remove` if you want to keep the task worktree afterward.

Shell integration is managed by the repository's Zsh templates rather than by `wt config shell install`, so it does not modify Chezmoi-owned shell files. Use `wt switch`, `wt list`, and `wt remove` for the normal worktree workflow.

Update the declared host packages and Mise-managed tools manually:

```bash
mise exec -- mise bootstrap packages upgrade
mise up
```

## Project-specific Mise versions

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
mise run test:vale:baseline
mise run test:vale:changed
```

`test:platform:render` requires Chezmoi, yq, and configured local data; it renders and validates macOS outputs. `test:vale:changed` reports new vale findings in changed Markdown without blocking on the existing baseline. On a machine with Chezmoi and local data configured, also review `chezmoi diff` and use `chezmoi apply --dry-run`.

Reference sections:
- Git and identity setup: [Git, GitHub, SSH, and signing setup](git-identity.md)
- Working agreement: [Tidy First + CUPID](working-agreement-tidy-cupid.md)


## Mise Task Conventions

- Manage only repo-owned personal mise fragments here, primarily `dot_config/mise/conf.d/00-*` and managed helpers under `dot_config/mise/scripts/` and `dot_config/mise/tasks/`.
- Treat unmanaged or externally owned local fragments such as `10-*`, `20-*`, and other non-chezmoi files as out of scope unless explicitly requested.
- Keep short task logic in bash.
- Move more complex task logic into Node.js helpers.
- Launch Node-based helpers through mise-managed latest Node, for example via `bash "$HOME/.config/mise/scripts/run-node-task" ...` or `bash "$HOME/.config/mise/scripts/run-node-bin" ...`.
- Prefer invoking behavior through `mise` tasks rather than ad hoc scripts.
- Do not assume the current working directory; use `chezmoi source-path` or other stable paths when tasks may be run from anywhere.


## External Machine Data

Chezmoi configuration is created manually on each machine at `~/.config/chezmoi/chezmoi.toml`; it is not stored in this repository. Configure the required `.data` values (listed in [data-keys.md](data-keys.md)) before applying these templates, including `work.enable`, your name, editor, GitHub username, personal Git email, Git username, signing key, SSH key filename, Git roots, and GitHub profile paths. For work machines, set `github.workUsername` or `work.git.username`; those profile-specific values remain local and take precedence over personal values. Do not commit that private configuration here.

The committed `00-*` Mise fragments form the personal baseline. Unmanaged `10-*` and `20-*` fragments belong to local/company/project layers and remain outside this repository.

## Privacy Boundary

- Keep all repo context repo-local.
- Do not store notes, summaries, or decisions from this repo in external long-term memory systems (for example Obsidian/team vault) unless explicitly requested.

