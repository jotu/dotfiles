#!/usr/bin/env bash
# Fail on Vale findings newly introduced in changed Markdown files.
#
# Usage: vale-new-findings.sh <base-ref | ->
# Exit codes: 0 no new findings, 1 new findings, 2 tool failure.
set -euo pipefail

temp_root=""
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

# Print alerts in $2 (JSON array) that exceed the baseline in $1 (JSON array).
# Alerts match by rule, severity, message, and match text, so moved lines do not count.
new_findings() {
  jq -c --argjson baseline "$1" '
    def fp: [.Check, .Severity, .Message, .Match] | tojson;
    ($baseline | map(fp) | group_by(.) | map({(.[0]): length}) | add // {}) as $remaining
    | reduce .[] as $alert ({remaining: $remaining, out: []};
        ($alert | fp) as $key
        | if (.remaining[$key] // 0) > 0
          then .remaining[$key] -= 1
          else .out += [$alert] end)
    | .out' <<<"$2"
}

is_markdown() { case "$1" in *.[mM][dD]) return 0 ;; *) return 1 ;; esac; }

# Print "current<TAB>previous" per changed Markdown file; previous is empty when new.
changed_markdown() {
  local base="$1" status previous current
  local -a fields=()
  if [[ "$base" == "-" ]]; then
    while IFS= read -r -d '' current; do
      is_markdown "$current" && printf '%s\t\n' "$current"
    done < <(git -C "$repo_root" ls-files --cached --others --exclude-standard -z -- '*.md')
    return
  fi

  while IFS= read -r -d '' status; do
    fields+=("$status")
  done < <(git -C "$repo_root" diff --name-status --find-renames -z "$base" -- '*.md')
  local index=0
  while ((index < ${#fields[@]})); do
    status="${fields[index]}"
    index=$((index + 1))
    case "$status" in
      R* | C*)
        previous="${fields[index]}"
        current="${fields[index + 1]}"
        index=$((index + 2))
        ;;
      D*)
        index=$((index + 1))
        continue
        ;;
      A*)
        current="${fields[index]}"
        previous=""
        index=$((index + 1))
        ;;
      *)
        current="${fields[index]}"
        previous="$current"
        index=$((index + 1))
        ;;
    esac
    is_markdown "$current" || continue
    is_markdown "$previous" || previous=""
    printf '%s\t%s\n' "$current" "$previous"
  done
  # Untracked files count as new.
  while IFS= read -r -d '' current; do
    is_markdown "$current" && printf '%s\t\n' "$current"
  done < <(git -C "$repo_root" ls-files --others --exclude-standard -z -- '*.md')
}

vale_rules_changed() {
  local base="$1"
  [[ -n "$(git -C "$repo_root" diff --name-only "$base" -- .vale.ini .vale/styles)" ]] && return 0
  [[ -n "$(git -C "$repo_root" ls-files --others --exclude-standard -- .vale.ini .vale/styles)" ]] && return 0
  return 1
}

# Run Vale on the given paths and print its JSON object (keys are the paths as given).
vale_alerts() {
  [[ $# -gt 0 ]] || { printf '{}\n'; return 0; }
  local output
  output=$(cd "$repo_root" && vale --config="$repo_root/.vale.ini" --output=JSON --no-exit "$@") ||
    { printf 'Vale failed\n' >&2; return 1; }
  jq -e 'type == "object"' >/dev/null <<<"$output" || { printf 'Vale did not return JSON\n' >&2; return 1; }
  printf '%s\n' "$output"
}

report_findings() {
  local path="$1" alerts="$2"
  jq -r --arg path "$path" --arg actions "${GITHUB_ACTIONS:-}" '
    def esc: gsub("%"; "%25") | gsub("\r"; "%0D") | gsub("\n"; "%0A");
    def prop: esc | gsub(":"; "%3A") | gsub(","; "%2C");
    .[] | (.Line // 1) as $line | (.Check // "Vale") as $check | (.Message // "New Vale finding") as $msg
    | if $actions == "true"
      then "::error file=\($path | prop),line=\($line),title=\($check | prop)::\($msg | esc)"
      else "\($path):\($line): \(.Severity // "suggestion") [\($check)] \($msg)" end' <<<"$alerts"
}

check() {
  local base="$1" current previous
  local pair
  local -a pairs=() current_paths=() baseline_paths=()

  if [[ "$base" != "-" ]] && vale_rules_changed "$base"; then
    printf 'Vale configuration changed; run a full Vale review before comparing against the existing baseline.\n' >&2
    return 2
  fi

  while IFS= read -r pair; do
    pairs+=("$pair")
  done < <(changed_markdown "$base")
  if [[ ${#pairs[@]} -eq 0 ]]; then
    printf 'No changed Markdown files to lint.\n'
    return 0
  fi

  temp_root=$(mktemp -d)
  trap 'rm -rf "$temp_root"' EXIT

  for pair in "${pairs[@]}"; do
    current="${pair%%$'\t'*}"
    if [[ -L "$repo_root/$current" ]]; then
      printf 'Refusing to lint symlinked Markdown file: %s\n' "$current" >&2
      return 2
    fi
    current_paths+=("$current")
  done

  local current_json baseline_json
  current_json=$(vale_alerts "${current_paths[@]}") || return 2

  for pair in "${pairs[@]}"; do
    current="${pair%%$'\t'*}"
    previous="${pair#*$'\t'}"
    [[ -n "$previous" && "$base" != "-" ]] || continue
    mkdir -p "$temp_root/$(dirname -- "$previous")"
    git -C "$repo_root" show "$base:$previous" >"$temp_root/$previous"
    baseline_paths+=("$temp_root/$previous")
  done
  baseline_json=$(vale_alerts ${baseline_paths[@]+"${baseline_paths[@]}"}) || return 2

  local found baseline new_alerts status=0
  for pair in "${pairs[@]}"; do
    current="${pair%%$'\t'*}"
    previous="${pair#*$'\t'}"
    found=$(jq -c --arg p "$current" '.[$p] // []' <<<"$current_json")
    baseline='[]'
    if [[ -n "$previous" && "$base" != "-" ]]; then
      baseline=$(jq -c --arg p "$temp_root/$previous" '.[$p] // []' <<<"$baseline_json")
    fi
    new_alerts=$(new_findings "$baseline" "$found")
    if [[ "$new_alerts" != "[]" ]]; then
      report_findings "$current" "$new_alerts"
      status=1
    fi
  done

  if [[ $status -eq 0 ]]; then
    printf 'No new Vale findings in %d changed Markdown file(s).\n' "${#pairs[@]}"
  fi
  return "$status"
}

main() {
  [[ $# -eq 1 ]] || { printf 'usage: %s <base-ref | ->\n' "${0##*/}" >&2; return 2; }
  local base="$1"
  # An all-zero SHA means the push has no previous commit.
  [[ "$base" =~ ^0+$ ]] && base="-"
  command -v vale >/dev/null 2>&1 || { printf 'Vale changed-file check failed: vale is required\n' >&2; return 2; }
  command -v jq >/dev/null 2>&1 || { printf 'Vale changed-file check failed: jq is required\n' >&2; return 2; }
  check "$base"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  rc=0
  main "$@" || rc=$?
  exit "$rc"
fi
