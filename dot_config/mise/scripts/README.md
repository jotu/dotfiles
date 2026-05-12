# Managed mise script helpers

These helpers support repo-managed personal mise tasks.

## Scope

- Keep this directory for managed helper scripts used by repo-owned personal `00-*` mise fragments.
- Do not use it to absorb logic from unmanaged local `10-*`/`20-*` fragments unless explicitly requested.

## Helpers

### `run-node-task`

Use for Node.js script files:

```bash
bash "$HOME/.config/mise/scripts/run-node-task" "$HOME/.config/mise/scripts/some-helper.mjs" arg1 arg2
```

Behavior:

- runs via `mise exec node@latest -- node ...`
- use when the target is a `.mjs` or other Node script file

### `run-node-bin`

Use for Node-based CLIs and package binaries:

```bash
bash "$HOME/.config/mise/scripts/run-node-bin" npx @techdocs/cli generate -v
```

Behavior:

- runs via `mise exec node@latest -- ...`
- use when the target is a command such as `npx`

## Conventions

- keep simple task logic in bash
- move more complex task logic into Node.js helpers
- invoke behavior through mise tasks
- avoid assuming the current working directory; prefer stable paths such as `chezmoi source-path` when needed
