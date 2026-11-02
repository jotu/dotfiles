#!/usr/bin/env bash
# Tests for baseline-aware Vale diagnostics.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=tests/vale-new-findings.sh
source "$repo_root/tests/vale-new-findings.sh"

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

alert() { # check severity message match line
  jq -cn --arg c "${1:-Vale.Terms}" --arg s "${2:-error}" --arg m "${3:-Use the preferred term.}" \
    --arg t "${4:-term}" --argjson l "${5:-1}" \
    '{Check: $c, Severity: $s, Message: $m, Match: $t, Line: $l}'
}

assert_eq() { [[ "$1" == "$2" ]] || fail "$3: expected $2, got $1"; }

# An existing finding is ignored when its line moves.
result=$(new_findings "[$(alert '' '' '' '' 10)]" "[$(alert '' '' '' '' 42)]")
assert_eq "$result" '[]' 'moved finding'

# An additional duplicate finding is reported.
result=$(new_findings "[$(alert)]" "[$(alert '' '' '' '' 3),$(alert '' '' '' '' 8)]")
assert_eq "$result" "[$(alert '' '' '' '' 8)]" 'duplicate finding'

# A new rule or message is reported.
extra=$(alert write-good.E-Prime suggestion "Avoid 'is'." is 1)
result=$(new_findings "[$(alert)]" "[$(alert),$extra]")
assert_eq "$result" "[$extra]" 'new rule'

printf 'Vale baseline comparison checks passed.\n'
