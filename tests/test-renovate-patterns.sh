#!/usr/bin/env bash
# Ensure README phrases that Renovate regex managers rewrite still exist.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readme="$repo_root/README.md"

patterns=(
  'TUIOS `[0-9]+\.[0-9]+\.[0-9]+`'
  'Worktrunk v[0-9]+\.[0-9]+\.[0-9]+ Pi source'
  'macOS uses the `[0-9]+\.[0-9]+\.[0-9]+` GitHub release through mise'
  'Herdr `[0-9]+\.[0-9]+\.[0-9]+` on macOS'
)

status=0
for pattern in "${patterns[@]}"; do
  if ! grep -Eq -- "$pattern" "$readme"; then
    printf 'FAIL: README no longer matches Renovate pattern: %s\n' "$pattern" >&2
    status=1
  fi
done
[[ $status -eq 0 ]] && echo "Renovate README patterns match."
exit "$status"
