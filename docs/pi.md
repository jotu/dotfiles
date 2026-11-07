# Pi setup

Pi configuration, skills, subagents, and safety. Chezmoi manages these files on both platforms.

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
mise run pi:addy:skills:remove         # remove the previously managed Addy skills on this machine
mise run herdr:pi:install              # install Herdr's Pi lifecycle/session integration
mise run tuios:pi:install              # install or refresh TUIOS's Pi integration
```

The Chezmoi-managed `dot_pi/agent/extensions/worktrunk.ts` extension matches the reviewed Worktrunk Pi source for the pinned Worktrunk release and tracks activity for standard Pi, showing 🤖 while an agent runs and 💬 after it settles. It clears the marker at session shutdown and keeps Pi running if `wt` fails. Chezmoi owns `~/.pi/agent/extensions/worktrunk.ts`; do not run `wt config plugins pi install`, which manages that same path and could replace the pinned source. Update the managed extension only after reviewing a versioned Worktrunk release. This setup uses standard Pi only.

Herdr and TUIOS own their Pi extensions, `~/.pi/agent/extensions/herdr-agent-state.ts` and `tuios-agent-state.ts`. Each extension does nothing outside its own multiplexer and reports only session state over a local socket or the `tuios agent-hook` command. Because `herdr:pi:install` and `tuios:pi:install` write this code into Pi, mise pins the reviewed releases: Herdr on macOS (Omarchy provides Herdr on Linux) and TUIOS; the versions live in `dot_config/mise/conf.d/00-base.toml.tmpl`. Before you change a pin, review the release's Pi extension: Herdr's `src/integration/assets/pi/` or the TUIOS `internal/integration/assets/pi/` directory. The Pi safety gate lets agents read these files for review but blocks edits.

The Chezmoi-managed `dot_pi/agent/extensions/smart-zone.ts` shows Pi's active context usage in a widget above the editor in both personal and work profiles. It labels usage below 125,000 tokens `SMART ZONE`, from 125,000 through 150,000 `FOCUS DRIFT`, and above 150,000 `REFOCUS`, with a `/compact` or `/new` nudge. These heuristic thresholds do not represent model context limits; Matt Pocock describes a gradual decline that commonly starts around 125,000–150,000 tokens on frontier models ([Smart zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)). The widget shows pending usage when Pi has no estimate, including after compaction, and does not compact automatically. Provider-quota packages remain conditional on `.work.enable`. Run `mise run test:pi:smart-zone` to verify its thresholds and session updates.

mise syncs Pi's bundled sub-agent extension from the installed Pi package. The managed user agents (`scout`, `planner`, `reviewer`, and `worker`) use inherited models so they work with the active provider. The read-only `security-auditor`, `test-engineer`, and `web-performance-auditor` agents provide optional specialist perspectives; invoke only the one relevant to a task. The Pi-specific prompt wrappers provide separate subagent chains: `/implement` runs a full scout → planner → worker → verify/review/commit chain; `/scout-and-plan` provides read-only reconnaissance and planning; `/implement-and-review` runs a worker → reviewer → worker review-fix cycle. Use these only when you want the extra Pi subagent contexts. For the standard Matt flow, use `/skill:implement` for a single-session task or individual ticket; it drives TDD and code review. Use `/skill:implement-spec` for a whole spec task graph. Herdr provides durable panes and lifecycle/session state; it does not replace Pi's in-session `subagent` tool.

The Matt skill tasks manage an explicit allowlist from the stable `skills/engineering` and `skills/productivity` directories only. They exclude `skills/in-progress` and `skills/misc`. The personal profile (`.work.enable = false`) includes the `pr` skill; work setups use their own PR skill.

The manager pins Matt skill content to commit `49dd158d1076134a641b33efb035946536778336`; review changes before advancing the pin. It refreshes skills with a Pi-targeted `skills add` command because `skills update --global` has no agent filter. A mise post-install task installs missing skills on each `mise install` and refreshes existing skills only when a tool installs or upgrades. An unchanged `mise install` leaves existing skill content untouched. Run `mise run pi:matt:skills:update` for an explicit Pi-only refresh.

`pi:addy:skills:remove` handles one-time cleanup on machines with the prior 13-skill installation. Run it explicitly on each such machine; `mise install` never calls it. The task uses the pinned skills CLI offline, removes only allowlisted skills whose recorded source matches the managed upstream repository, and removes shared references only when their ownership marker matches the managed revision. It leaves forked or unverified skills, unknown markers, symlinked reference files, and unrelated references untouched.

The manual-only `using-agent-skills` router sends requests through Matt's workflow. See [GLOSSARY.md](../GLOSSARY.md) for the distinction between Pi skills and specialist agents. Repository and global safety rules remain authoritative over all third-party skill examples.

Keep the Matt route lightweight: use `/skill:grill-with-docs` for unresolved design or domain decisions and `/plan` for unfamiliar or multi-step work. Use `/skill:implement` for code changes; it coordinates TDD and review where appropriate. Invoke `/skill:tdd` directly for focused test-first work and `/skill:code-review` for review-only tasks. Small, self-contained jobs can skip specs and tickets. Use `/skill:setup-matt-pocock-skills` once only in repositories that already use the tracker workflow; in those repositories, `/skill:to-spec` and `/skill:to-tickets` can shape larger tasks. Use `/skill:implement-spec` for an entire spec task graph; it uses an integration branch and worktrees. Route all Git-worktree lifecycle operations through Worktrunk (`wt`), which uses Git worktrees under the hood; creating task-local branches and worktrees needs no extra approval, while switching to another existing workspace or destructive/integrating operations follows the safety gate. The personal `pr` skill shapes a pull request body only; it does not create or publish pull requests or change the separate Conventional Commit workflow. Keep one primary skill per phase and load another only when it adds a distinct benefit.

Pi agents may work autonomously inside their assigned task worktree: reads anywhere, public research, builds, tests, lockfile-based project installs, and local commits do not need extra approval. Explicitly named local Kubernetes contexts and loopback database/LocalStack targets also pass the best-effort safety gate. The gate blocks recognized credential and secret access. Its heuristics may allow writes in any linked worktree of the session's repository, plain relative recursive deletes there, and `wt merge` without prompting; these allowances do not grant permission. Agent policy still limits writes to the assigned task worktree, restricts recursive deletes to generated outputs the task will rebuild, and permits `wt merge` only on the user's explicit request for direct integration. The gate asks before recognized delivery, remote-access, and most destructive operations; headless runs block actions that would otherwise require confirmation. The current Pi setup does not enforce OS or network isolation. The safety gate uses command heuristics, not isolation, so do not treat it as a hard security boundary.

Pi also discovers the shared `~/.agents/skills` catalog. The Chezmoi-managed Pi settings exclude native copies of selected Matt skills when a matching `~/.agents/skills/<name>/SKILL.md` exists. These exclusions change Pi discovery only; they do not delete files. Run `chezmoi apply` and restart Pi to use the updated settings.

Use `/plan` to toggle read-only planning and `/todos` to show progress. Pi updates resync the extensions through the managed sync task.

## Local model: when to use it

The macOS personal profile registers a local oMLX endpoint (`omlx` provider, `http://127.0.0.1:8000/v1`). Install the models with `mise run omlx:model:install [model]`, which pins a Hugging Face revision for each model, then start the server with `mise run omlx:start`. On the personal macOS profile the model is in Pi's model scope, so select it with `/model` or cycle to it with Ctrl+P. Agents and sub-agents inherit the selected model; nothing pins a local model automatically.

| Model ID | Role | Disk | Context |
|---|---|---|---|
| `qwen3-4b-4bit` | Small default | 2.3 GB | 40,960 |

`qwen3-4b-4bit` is `mlx-community/Qwen3-4B-4bit`. The 12 GB Qwen3.6 35B REAP model did not fit under the dynamic memory ceiling that oMLX enforces (about 6 GB on this laptop) and returned HTTP 507, so the repository no longer ships it. Run one model at a time, and keep the model plus its KV cache under the ceiling. Raise `memory_guard_tier` in oMLX only if you add a larger model.

Good fits:

- Commit messages from small diffs.
- Short summaries and diff explanations.
- Private or offline work.
- Cheap triage sub-tasks.

Poor fits; use a hosted model instead:

- Full PR-Agent reviews: the prompts are long, and a dense 9B model was already too slow for them.
- Long agentic coding sessions.
- Security-sensitive final judgments.

Worktrunk's `[commit.generation]` runs `pi -p --model <provider/model>`, and Pi resolves `omlx/qwen3-4b-4bit` from `models.json`, so the local endpoint can generate commit messages. The Chezmoi template keeps a hosted model as the default. To try the local model, copy the command from `dot_config/worktrunk/config.toml.tmpl` and replace the `--model` value with `omlx/qwen3-4b-4bit` in a local override, not in this repository. The server must be running, and you should read the message before you commit.

## Pi learning capture

Pi includes `/learn [focus]`, which extracts one self-contained Zettelkasten-style concept from the current investigation and creates it through the Obsidian CLI. Chezmoi configures the non-sensitive CLI vault name (`base`), destination folder (`1 - Notes`), and template (`5 - Templates/Atomic Note.md`); it does not store a vault path, credentials, or note contents in this repository.

Run `/learn` in Pi, or `/learn a specific concept`. Notes contain an idea, why it matters, an example when available, connections, and sources. Existing notes are never overwritten.


## Pi safety model

Pi and Herdr run with the permissions of the current user. Herdr provides workspace persistence and agent status, not isolation.

- Use `/plan` before unfamiliar or multi-step work.
- The global Pi safety gate asks before risky shell operations and blocks common credential and metadata paths.
- After verification and review, Pi creates an atomic Conventional Commit by default. Preserve topic-branch commits when preparing a PR; the user chooses the eventual PR merge strategy, including squash merging. Pushes and PR or draft PR creation require an explicit request.
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

