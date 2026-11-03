# Atuin history migration

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

