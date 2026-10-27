# Worktrunk, Pi, and terminal worktrees

## Recommendation

Give each tool one job: Worktrunk owns Git worktree creation and navigation; Pi runs the coding agent; Herdr or TUIOS owns persistent terminal sessions and reports agent state. Keep one clean primary checkout on the repository's default branch, and create task worktrees through Worktrunk. The multiplexer should open those existing worktrees rather than create a competing set of checkouts.

This keeps Worktrunk's path and base-branch behavior authoritative while allowing either multiplexer to manage panes. Worktrunk's Pi integration reports activity in `wt list`; it neither creates worktrees nor controls Pi's workspace. Pi extensions run within Pi and can register separate lifecycle handlers, so the activity reporter can coexist with a multiplexer integration. [Worktrunk switch](https://worktrunk.dev/switch/), [Pi extension documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

## Where worktrees live and how they get a fresh base

Worktrunk supports a centralized path template and expands a leading `~`. The docs show `~/worktrees/{{ repo }}/{{ branch | sanitize }}`. For repositories with the same local directory name from different remote owners, include the owner as a path component:

```toml
worktree-path = "~/.worktrunk/{{ owner }}/{{ repo }}/{{ branch | sanitize }}"

[merge]
squash = false
rebase = true
```

This keeps checkouts outside repository folders under the hidden `~/.worktrunk` directory. The template exposes `owner` and `repo`; confirm the rendered path for a repository without a remote before standardizing it. The Chezmoi source at `dot_config/worktrunk/config.toml` now sets this path and retains the `s` alias. On macOS, `mise` pins the Worktrunk CLI to v0.81.0; Omarchy continues to manage the Linux package. [Worktrunk configuration](https://worktrunk.dev/config/#worktree-path-template), [merge settings](https://worktrunk.dev/config/#merge)

mise inherits trust for the same config path in linked Git worktrees after the repository's main checkout grants trust. Run `mise trust` there; you do not need to add `~/.worktrunk` to a global trust list. Paranoid mode disables inherited worktree trust, so trust each config explicitly. [mise configuration trust](https://mise.jdx.dev/security.html#configuration-trust)

`wt switch --create <branch>` bases the new branch on the repository's default branch. That selects the local default-branch ref; do not treat it as an automatic fetch. To start from the latest remote `main`, update refs first, for example by fast-forwarding the clean primary checkout with `git pull --ff-only`, or run `git fetch` and create with `--base origin/main`. Later changes to `main` do not automatically update an existing task worktree. [Worktrunk switch](https://worktrunk.dev/switch/#creating-a-branch)

Worktrunk's `wt merge` command squashes and rebases by default. The global config turns off squashing but keeps rebasing, so local integration rebases each task commit onto the refreshed target and fast-forwards without combining commits. `wt merge` integrates locally, not through a PR, and never fetches. For PR work, refresh the target, run `wt step rebase origin/main` on an unpublished branch, then push and create the PR without squashing its commits. Rebase changes commit IDs, so ask before rebasing a branch that someone has already pushed or shared. The user decides whether GitHub later squash-merges the PR. [Worktrunk merge](https://worktrunk.dev/merge/), [Worktrunk rebase step](https://worktrunk.dev/step/#wt-step-rebase)

Use this routine:

```sh
# In the primary checkout, kept clean on the repository's default branch:
git pull --ff-only
wt switch --create feat/my-task
pi
```

The Worktrunk shell integration changes into the new worktree. Keep the primary checkout on `main` as the place to refresh the base; Git allows one worktree per checked-out branch.

## Herdr and TUIOS

Both multiplexers can work with an existing Worktrunk-created checkout, but their create commands have their own storage and base behavior:

- **Herdr** can open an existing checkout with `herdr worktree open --path <path>`. Its native worktree creation root accepts `[worktrees] directory = "~/worktrees"`; new checkouts go below `<directory>/<repo>/<branch-slug>`. Herdr-created branches start from `HEAD` unless you pass `--base`. [Herdr workspaces](https://herdr.dev/docs/workspaces/#worktrees), [Herdr configuration](https://herdr.dev/docs/configuration/#worktrees)
- **TUIOS** creates worktrees under `$XDG_DATA_HOME/tuios/worktrees/<repo>/<branch>` by default. `TUIOS_WORKTREE_DIR` overrides that root. Its `worktree new` command defaults to `HEAD`, and TUIOS does not fetch. TUIOS also recognizes a session that starts manually inside an existing worktree; `tuios new --cwd <path>` can start a session there. [TUIOS worktrees](https://tuios.dev/docs/worktrees)

For this setup, create with `wt` first, then open the current path in Herdr (`herdr worktree open --path "$PWD"`) or start a TUIOS session there (`tuios new --cwd "$PWD"`). Avoid using `herdr worktree create` or `tuios worktree new` as a second default creator unless you also set their roots and explicitly select the intended base. That prevents the managers from creating worktrees in separate locations or from the current task's `HEAD`.

The Herdr and TUIOS Pi integrations report state to their respective terminal managers. The repo already has `mise` tasks for both. You can run both multiplexers during a migration, then choose one for daily use; Worktrunk does not require either one. The default TUIOS worktree path stays outside the repository but inside its XDG data directory; use `TUIOS_WORKTREE_DIR` only if you want TUIOS-created worktrees under a more visible root. Pi's global instructions now tell agents to preserve focused commits when preparing PRs and leave the eventual PR merge strategy to the user.

## Pi and Worktrunk extension ownership

The repository manages `dot_pi/agent/extensions/worktrunk.ts`, which renders to `~/.pi/agent/extensions/worktrunk.ts`. Worktrunk v0.81.0's Pi installer writes to the same target, so keep the Chezmoi-managed file as the sole owner. The managed file now matches the reviewed v0.81.0 Pi extension source; the repo does not run the installer. The source review covered these integration files only, not the full Worktrunk tool. GitHub reports the v0.81.0 commit signature as valid, but that does not constitute a complete security audit. [Worktrunk v0.81.0 Pi installer](https://github.com/max-sixty/worktrunk/blob/v0.81.0/src/commands/config/pi.rs)

The managed extension now sets the waiting marker on Pi's `agent_settled` event. Pi documents that retries, compaction retries, and queued work can start another run after `agent_end`; `agent_settled` fires after automatic processing stops. [Repository extension](../../dot_pi/agent/extensions/worktrunk.ts), [Pi lifecycle events](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md#choose-an-event-by-intent), [Worktrunk v0.81.0 Pi extension](https://github.com/max-sixty/worktrunk/blob/v0.81.0/dev/pi-extension.ts)

The old `pi:worktrunk:install` task in `mise` checked for `omp` but invoked Worktrunk's standard Pi installer. That installer writes to the Chezmoi-owned path and could overwrite the managed extension. This change removes the task and its postinstall entry. The setup uses standard Pi and does not install an OMP integration.

## Suggested choice

Do not switch from Herdr solely to use Worktrunk: Herdr already opens externally created worktrees and can group them with the parent repository. If the TUIOS worktree rail and agent-state workflow appeal to you, pilot it by opening a Worktrunk-created worktree with `tuios new --cwd "$PWD"`. Keep Herdr installed during that trial, then choose one persistent multiplexer after confirming session restore and your everyday flow.

## Sources

- [Worktrunk configuration](https://worktrunk.dev/config/#worktree-path-template)
- [Worktrunk `wt switch`](https://worktrunk.dev/switch/#creating-a-branch)
- [Worktrunk merge](https://worktrunk.dev/merge/)
- [Worktrunk v0.81.0 Pi extension source](https://github.com/max-sixty/worktrunk/blob/v0.81.0/dev/pi-extension.ts)
- [Worktrunk v0.81.0 Pi installer](https://github.com/max-sixty/worktrunk/blob/v0.81.0/src/commands/config/pi.rs)
- [Pi extension guide](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- [Herdr workspaces](https://herdr.dev/docs/workspaces/#worktrees)
- [Herdr configuration](https://herdr.dev/docs/configuration/#worktrees)
- [TUIOS worktrees](https://tuios.dev/docs/worktrees)
- [TUIOS agent integrations](https://tuios.dev/docs/agents)
