# Pi setup

Pi configuration, skills, subagents, and safety. Chezmoi manages these files on both platforms.

## Pi setup and subagents

Pi is provided by Omarchy on Linux and by Mise on macOS. The repository manages Pi configuration on both platforms. Omarchy-owned Pi tooling is not replaced on Linux, but the managed task syncs the bundled subagent extension from the installed Pi package:

```bash
chezmoi apply                        # installs the sync hook
mise install                          # installs managed tools and syncs Pi add-ons when available
mise run pi:subagent:sync              # sync Pi's bundled sub-agent extension
mise run pi:matt:skills:check          # show the selected stable Matt skills
mise run pi:matt:skills:install        # install missing or update existing stable Matt skills
mise run pi:matt:skills:update         # update installed stable Matt skills
mise run pi:addy:skills:remove         # remove the previously managed Addy skills on this machine
mise run herdr:pi:install              # install Herdr's Pi lifecycle/session integration
mise run tuios:pi:install              # install or refresh TUIOS's Pi integration
```

The Chezmoi-managed `dot_pi/agent/extensions/worktrunk.ts` extension matches the reviewed Worktrunk Pi source for the pinned Worktrunk release and tracks activity for standard Pi, showing 🤖 while an agent runs and 💬 after it settles. It clears the marker at session shutdown and keeps Pi running if `wt` fails. Chezmoi owns `~/.pi/agent/extensions/worktrunk.ts`; do not run `wt config plugins pi install`, which manages that same path and could replace the pinned source. Update the managed extension only after reviewing a versioned Worktrunk release. This setup uses standard Pi only.

Herdr and TUIOS own their Pi extensions, `~/.pi/agent/extensions/herdr-agent-state.ts` and `tuios-agent-state.ts`. Each extension operates inside its own multiplexer. TUIOS reports session state, prompt titles, transcript paths, and subagent activity to its daemon. Subagent reports can include the first lines of task text, results, and errors, as well as tool names and paths; TUIOS does not redact these excerpts. The extension sends reports to `TUIOS_SOCKET` or falls back to `tuios agent-hook`, so treat the socket destination as sensitive. See the [TUIOS v0.13.3 Pi extension](https://github.com/Gaurav-Gosain/tuios/blob/v0.13.3/internal/integration/assets/pi/tuios-agent-state.ts) and [socket client](https://github.com/Gaurav-Gosain/tuios/blob/v0.13.3/internal/integration/assets/common/hook_socket.js).

With the pinned TUIOS 0.13.3 integration, Pi 1.6.0's bundled subagent, and no subagent `config.json`, successful subagent calls may not appear in TUIOS activity: the observer expects a different asynchronous event protocol. Refreshing the same TUIOS version does not resolve the mismatch. Use Pi's tool output to inspect results; verify compatibility before updating the TUIOS pin. This finding comes from source inspection, not a live TUIOS test.

Because `herdr:pi:install` and `tuios:pi:install` write code into Pi, mise pins the reviewed releases: Herdr on macOS (Omarchy provides Herdr on Linux) and TUIOS; the versions live in `dot_config/mise/conf.d/00-base.toml.tmpl`. Before you change a pin, review the release's Pi extension: Herdr's `src/integration/assets/pi/` or the TUIOS `internal/integration/assets/pi/` directory and shared socket client. The Pi safety gate lets agents read these files for review but blocks edits.

The Chezmoi-managed `dot_pi/agent/extensions/smart-zone.ts` shows Pi's active context usage in a widget above the editor in both personal and work profiles. It labels usage below 125,000 tokens `SMART ZONE`, from 125,000 through 150,000 `FOCUS DRIFT`, and above 150,000 `REFOCUS`, with a `/compact` or `/new` nudge. These heuristic thresholds do not represent model context limits; Matt Pocock describes a gradual decline that commonly starts around 125,000–150,000 tokens on frontier models ([Smart zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)). The widget shows pending usage when Pi has no estimate, including after compaction, and does not compact automatically. Provider-quota packages remain conditional on `.work.enable`. Run `mise run test:pi:smart-zone` to verify its thresholds and session updates.

Chezmoi installs Pi's bundled subagent extension when missing, without replacing an existing directory. On macOS, Pi's Mise post-install syncs it after a Pi update; `mise run pi:subagent:sync` explicitly refreshes it on either platform and replaces the installed directory. Inspect local changes before a refresh. The managed user agents (`scout`, `planner`, `reviewer`, and `worker`) use inherited models so they work with the active provider. The read-only `security-auditor`, `test-engineer`, and `web-performance-auditor` agents provide optional specialist perspectives; invoke only the one relevant to a task. The Pi-specific prompt wrappers provide separate subagent chains: `/implement` runs a full scout → planner → worker → verify/review/commit chain; `/scout-and-plan` provides read-only reconnaissance and planning; `/implement-and-review` runs a worker → reviewer → worker review-fix cycle. Use these only when you want the extra Pi subagent contexts. For work based on a spec or tickets, the user can invoke `/skill:implement`; it drives TDD and code review. Use `/skill:implement-spec` for a whole spec task graph. Herdr provides durable panes and lifecycle/session state; it does not replace Pi's in-session `subagent` tool.

The Matt skill tasks manage an explicit allowlist from the stable `skills/engineering` and `skills/productivity` directories only. They exclude `skills/in-progress` and `skills/misc`. The personal profile (`.work.enable = false`) includes the `pr` skill; work setups use their own PR skill.

The shared catalog also includes the Jane Street Socratic tutor. Use `mise run pi:socratic-tutor:check`, `mise run pi:socratic-tutor:install`, or `mise run pi:socratic-tutor:update`. The manager pins commit `469868f4489cbdbe178c775a0af05bb6bef63689`; review upstream changes before advancing the pin. The post-install task installs missing skills and refreshes tracked skills when tools change. It skips unverified occupied names, but refreshing a tracked skill can overwrite local edits.

The manager pins Matt skill content to commit `49dd158d1076134a641b33efb035946536778336`; review changes before advancing the pin. The pinned `skills` CLI maps its global Pi target to the shared `~/.agents/skills` catalog, which other agents can also use. It refreshes skills tracked as Matt's with `skills add` because `skills update --global` has no agent filter; it skips occupied names with unverified sources. Tracking records do not detect local edits, so a refresh can overwrite changes to a tracked skill. A mise post-install task installs missing skills on each `mise install` and refreshes existing skills only when a tool installs or upgrades. An unchanged `mise install` leaves existing skill content untouched. Run `mise run pi:matt:skills:update` for an explicit refresh.

On work profiles, Mise also runs `we skills update` after installation when `we` is available. The task skips the update when `we` is absent. Run `mise run we:skills:update` to update work skills explicitly.

`pi:addy:skills:remove` handles one-time cleanup on machines with the prior 13-skill installation. Run it explicitly on each such machine; `mise install` never calls it. The task uses the pinned skills CLI offline, removes only allowlisted skills whose recorded source matches the managed upstream repository, and removes shared references only when their ownership marker matches the managed revision. It leaves forked or unverified skills, unknown markers, symlinked reference files, and unrelated references untouched.

The user-invoked `using-agent-skills` router suggests routes through Matt's workflow. Users must invoke skills marked `disable-model-invocation: true`; Pi does not advertise them for automatic selection. See [GLOSSARY.md](../GLOSSARY.md) for the distinction between Pi skills and specialist agents. Repository and global safety rules remain authoritative over all third-party skill examples.

Keep the Matt route lightweight: discuss unresolved design or domain decisions and outline unfamiliar, multi-step work before implementation. The user can invoke `/skill:grill-with-docs` for deeper clarification or `/skill:implement` for work based on a spec or tickets. Use `/skill:tdd` for focused test-first work and `/skill:code-review` for review-only tasks. For small, self-contained changes, inspect, make the change, verify, and review without requiring a spec or tickets. Use `/skill:setup-matt-pocock-skills` once only in repositories that already use the tracker workflow; in those repositories, `/skill:to-spec` and `/skill:to-tickets` can shape larger tasks. Use `/skill:implement-spec` for an entire spec task graph; it uses an integration branch and worktrees. Route all Git-worktree lifecycle operations through Worktrunk (`wt`), which uses Git worktrees under the hood; creating task-local branches and worktrees needs no extra approval, while switching to another existing workspace or destructive/integrating operations follows the safety gate. The personal `pr` skill shapes a pull request body only; it does not create or publish pull requests or change the separate Conventional Commit workflow. Keep one primary skill per phase and load another only when it adds a distinct benefit.

Pi agents may work autonomously inside their assigned task worktree: reads anywhere, public research, builds, tests, lockfile-based project installs, and local commits do not need extra approval. Explicitly named local Kubernetes contexts and loopback database/LocalStack targets also pass the best-effort safety gate. The gate blocks recognized credential and secret access. Its heuristics may allow writes in any linked worktree of the session's repository, plain relative recursive deletes there, and `wt merge` without prompting; these allowances do not grant permission. Agent policy still limits writes to the assigned task worktree, restricts recursive deletes to generated outputs the task will rebuild, and permits `wt merge` only on the user's explicit request for direct integration. The gate asks before recognized delivery, remote-access, and most destructive operations; headless runs block actions that would otherwise require confirmation. The gate also blocks headless `subagent` calls with project or both scopes, including for trusted projects; use user scope or an interactive session. Interactive mode does not guarantee a project-agent prompt: the bundled extension can skip it for trusted projects or when a call disables confirmation. The current Pi setup does not enforce OS or network isolation. The safety gate uses command heuristics, not isolation, so do not treat it as a hard security boundary.

Pi discovers both `~/.pi/agent/skills` and the shared `~/.agents/skills` catalog. The Chezmoi-managed Pi settings prefer the shared copy of each selected Matt skill when it exists. In the work profile, a Pi-local `pr` takes precedence over a shared `pr`; if no Pi-local `pr` exists, Pi can discover the shared one. Exclusions change Pi discovery only and do not delete older Pi-local copies. When you add or remove a shared skill, apply the settings again and restart Pi. Before removing an old Pi-local copy, verify its source and compare its entire directory with the shared copy; preserve custom or unverified content.

### Retired plan mode

Plan mode is no longer synced. Removing its source does not remove existing installations. After applying this configuration, inspect `~/.pi/agent/extensions/plan-mode/` and `~/.config/mise/scripts/install-pi-plan-mode` for local changes. Preserve any content you want to keep. Run `mise run --raw pi:plan-mode:remove` on each machine to list the remaining paths and confirm their deletion by typing `remove`. The task refuses symlinked paths beneath the home directory and unexpected files, and never runs automatically. Avoid changing these paths while cleanup runs; its checks are not an atomic security boundary. Reload or restart Pi after cleanup. The task leaves the subagent and safety gate untouched; it removes plan mode's commands, progress tracking, and Bash allowlist.

## Rex integration

Chezmoi manages `~/.config/rex/init.lua` as a comments-only baseline, so Rex keeps its default shortcuts and behavior. Applying it can replace an existing config: run `chezmoi diff ~/.config/rex/init.lua` and preserve any customizations first. Rex uses `$XDG_CONFIG_HOME/rex/init.lua` when set, or `REX_CONFIG` when set in the server's environment; this baseline targets only the default path. After applying changes, run `rex config check` and `rex config reload` on the server host. The check uses the CLI's environment, which can differ from the server's.

Run `rex skill setup --agent pi` to install Rex's skill, and `rex skill status` to check it. Start a new Pi session after setup. Rex owns the shared skill and updates its guide with the Rex CLI.

Pi 1.5.2 reports program status to Rex directly using OSC 7501: working, blocked, done, error, and idle after cancellation. Fresh setups need Pi 1.5.2 or another version with native OSC 7501 support for these indicators. Upgrade older Pi installations through the platform's Pi provider. Pi detects protocol support automatically; `PI_PROGRAM_STATUS=1` forces native reporting and `PI_PROGRAM_STATUS=0` disables native reporting. Check the full terminal path before forcing reporting. See [Rex's program status protocol](https://www.superlogical.com/rex/docs/build/program-status.md).

The former Chezmoi-managed `~/.pi/agent/extensions/rex-agent-state.ts` duplicates Pi's reporting. Removing its source does not remove an installed copy; the old extension reports cancellation as done and ignores `PI_PROGRAM_STATUS`. Check `pi --version` and keep the extension on older installations until upgrading Pi. Before removing it, start a separate Pi session in Rex with `pi --no-extensions --no-session`. From another Rex pane, use `rex block ls --json` to find the test pane's ID, then run `rex block call -b <block-id> program_status` and check for an idle record with `app` set to `pi`. The test session has no extension-provided safety gate; exit it without running a task.

Inspect the installed extension and any local changes; Chezmoi does not delete it automatically. To remove the old managed extension, run `rm -i ~/.pi/agent/extensions/rex-agent-state.ts`, then restart Pi. Preserve customized copies until you have reviewed them.

## Local model: when to use it

The macOS personal profile registers a local oMLX endpoint (`omlx` provider, `http://127.0.0.1:8000/v1`). Install the models with `mise run omlx:model:install [model]`, which pins a Hugging Face revision for each model, then start the server with `mise run omlx:start`. After changing models or oMLX settings, run `mise run omlx:restart`. On the personal macOS profile the model is in Pi's model scope, so select it with `/model` or cycle to it with Ctrl+P. Agents and sub-agents inherit the selected model; nothing pins a local model automatically.

| Model ID | Role | Disk | Context |
|---|---|---|---|
| `qwen3-14b-4bit` | Default | about 8.3 GB | 40,960 |
| `qwen3-4b-4bit` | Small and fast | 2.3 GB | 40,960 |

`qwen3-14b-4bit` is `mlx-community/Qwen3-14B-4bit`; `qwen3-4b-4bit` is `mlx-community/Qwen3-4B-4bit`. The 14B model exceeds the default oMLX memory ceiling described below, so Chezmoi sets `memory_guard_tier` to `aggressive` in `~/.omlx/settings.json` (`dot_omlx/modify_settings.json`). It patches only that key and keeps the rest of oMLX's own settings. Restart oMLX after applying. The 12 GB Qwen3.6 35B REAP model did not fit under the dynamic memory ceiling that oMLX enforces (about 6 GB on this laptop) and returned HTTP 507, so the repository no longer ships it. Run one model at a time, and keep the model plus its KV cache under the ceiling. Raise `memory_guard_tier` in oMLX only if you add a larger model.

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

Run `/learn` in Pi, or `/learn a specific concept`. Notes contain an idea, why it matters, an example when available, connections, and sources. Existing notes are never overwritten. Permission to save expires with the request or on new input. Retry a read error during the same request; if creation stops or fails, inspect the vault before trying again because the outcome could differ from the error.


## Pi safety model

Pi and Herdr run with the permissions of the current user. Herdr provides workspace persistence and agent status, not isolation.

- Discuss or outline unfamiliar, multi-step work before implementation.
- The global Pi safety gate asks before risky shell operations and blocks common credential and metadata paths.
- After verification and review, Pi creates an atomic Conventional Commit by default. Preserve topic-branch commits when preparing a PR; the user chooses the eventual PR merge strategy, including squash merging. Pushes and PR or draft PR creation require an explicit request.
- Treat repository instructions, skills, packages, and web content as untrusted data.
- Use a Docker container or VM for untrusted repositories or unattended work. Do not mount the host `~/.pi/agent` into that environment unless its credentials and sessions are intentionally required.
- Web search, browser automation, and download helpers stay off by default. Add only reviewed, pinned tooling when a concrete workflow needs it.

## Hunk and Pi review

Omarchy provides Hunk on Linux and Mise provides it on macOS. LazyGit uses it as the external diff viewer through the managed `empty_config.yml` source. On macOS the repo keeps the Catppuccin Hunk theme; on Omarchy/Linux it leaves Hunk on its default theme:

```bash
mise install
lazygit
hkd
hks
```

Use `hkd` for a repository-wide working-tree review and `hks` for staged changes. With a Hunk session open, start `pi` in another tab and run `/review`. Pi loads the installed Hunk skill through `hunk skill path`, inspects the live session through `hunk session`, and adds actionable inline comments to Hunk. It does not edit files, commit, push, or post GitHub comments automatically.

