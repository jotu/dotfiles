#!/usr/bin/env bash
# Exercise selected Addy skill reconciliation without touching global Pi skills.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
manager="$repo_root/dot_config/mise/scripts/executable_manage-addy-pi-skills"
router="$repo_root/dot_pi/agent/skills/using-agent-skills/SKILL.md"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$tmp_dir/bin" "$tmp_dir/home/.pi/agent/skills"
grep -Fq 'disable-model-invocation: true' "$router"
: >"$tmp_dir/bin/pi"
chmod +x "$tmp_dir/bin/pi"

cat >"$tmp_dir/bin/npx" <<'EOF_NPX'
#!/usr/bin/env bash
set -euo pipefail
if [[ " $* " == *" list --global --agent pi --json "* ]]; then
  printf '%s\n' "${FAKE_SKILLS_JSON:-[]}"
  exit 0
fi
printf '%s\n' "$*" >>"$FAKE_LOG"
source_repo=''
collect_skills=false
for arg in "$@"; do
  if [ "$arg" = add ]; then
    continue
  fi
  if [ -z "$source_repo" ] && [[ "$arg" == https://github.com/* ]]; then
    source_repo="$arg"
    continue
  fi
  if [ "$arg" = --skill ]; then
    collect_skills=true
    continue
  fi
  if [[ "$arg" == --* ]]; then
    collect_skills=false
    continue
  fi
  if [ "$collect_skills" = true ]; then
    mkdir -p "$HOME/.pi/agent/skills/$arg"
    printf '%s\n' '---' "name: $arg" 'description: Fake test skill.' '---' >"$HOME/.pi/agent/skills/$arg/SKILL.md"
    case "$arg" in
      security-and-hardening)
        mkdir -p "$HOME/.pi/agent/skills/$arg/references"
        : >"$HOME/.pi/agent/skills/$arg/references/hardening-patterns.md"
        ;;
      performance-optimization)
        mkdir -p "$HOME/.pi/agent/skills/$arg/references"
        : >"$HOME/.pi/agent/skills/$arg/references/optimization-patterns.md"
        ;;
    esac
  fi
done
EOF_NPX
chmod +x "$tmp_dir/bin/npx"

cat >"$tmp_dir/bin/curl" <<'EOF_CURL'
#!/usr/bin/env bash
set -euo pipefail
output=''
url=''
while (($#)); do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
[ -n "$output" ] || { printf 'missing output path\n' >&2; exit 2; }
printf 'fixture for %s\n' "$url" >"$output"
printf '%s\n' "$url" >>"$FAKE_CURL_LOG"
EOF_CURL
chmod +x "$tmp_dir/bin/curl"

run_manager() {
	local mode="$1" mise_tools="$2" skills_json="$3" home="${4:-$tmp_dir/home}"
	FAKE_LOG="$tmp_dir/skills.log" \
		FAKE_CURL_LOG="$tmp_dir/curl.log" \
		FAKE_SKILLS_JSON="$skills_json" \
		PATH="$tmp_dir/bin:$PATH" \
		HOME="$home" \
		MISE_INSTALLED_TOOLS="$mise_tools" \
		bash "$manager" "$mode"
}

: >"$tmp_dir/skills.log"
: >"$tmp_dir/curl.log"
run_manager install '[]' '[]' >/dev/null
test "$(grep -c ' add ' "$tmp_dir/skills.log")" = 1
grep -Fq 'https://github.com/addyosmani/agent-skills/tree/aeac41d4d005999432bb7312f7ff06383a91d59d' "$tmp_dir/skills.log"
grep -Fq ' --agent pi --global --yes' "$tmp_dir/skills.log"

manual_skills=(
	browser-testing-with-devtools
	ci-cd-and-automation
	code-simplification
	deprecation-and-migration
	documentation-and-adrs
	doubt-driven-development
	performance-optimization
	shipping-and-launch
	source-driven-development
)
auto_skills=(
	api-and-interface-design
	frontend-ui-engineering
	observability-and-instrumentation
	security-and-hardening
)
for skill in "${manual_skills[@]}"; do
	grep -Fq 'disable-model-invocation: true' "$tmp_dir/home/.pi/agent/skills/$skill/SKILL.md"
done
for skill in "${auto_skills[@]}"; do
	if grep -Fq 'disable-model-invocation: true' "$tmp_dir/home/.pi/agent/skills/$skill/SKILL.md"; then
		exit 1
	fi
done
grep -Fq 'Use when adding, changing, or assessing application telemetry' \
	"$tmp_dir/home/.pi/agent/skills/observability-and-instrumentation/SKILL.md"

reference_files=(
	accessibility-checklist.md
	definition-of-done.md
	observability-checklist.md
	orchestration-patterns.md
	performance-checklist.md
	security-checklist.md
)
for reference in "${reference_files[@]}"; do
	test -f "$tmp_dir/home/.pi/agent/references/$reference"
done
grep -Fq 'aeac41d4d005999432bb7312f7ff06383a91d59d' \
	"$tmp_dir/home/.pi/agent/references/.addy-agent-skills-ref"
test "$(wc -l <"$tmp_dir/curl.log" | tr -d ' ')" = "${#reference_files[@]}"

installed_json="$(node -e '
const names = process.argv.slice(1);
process.stdout.write(JSON.stringify(names.map(name => ({name, source: "addyosmani/agent-skills"}))));
' "${auto_skills[@]}" "${manual_skills[@]}")"
: >"$tmp_dir/skills.log"
run_manager check '[]' "$installed_json" >"$tmp_dir/check.log"
grep -Eq '^observability-and-instrumentation[[:space:]]+installed \(automatic\)$' "$tmp_dir/check.log"
grep -Eq '^doubt-driven-development[[:space:]]+installed \(manual-only\)$' "$tmp_dir/check.log"

# An interrupted sync leaves a pending marker; the next install must repair it.
references_dir="$tmp_dir/home/.pi/agent/references"
printf 'pending:aeac41d4d005999432bb7312f7ff06383a91d59d\n' >"$references_dir/.addy-agent-skills-ref"
rm "$references_dir/observability-checklist.md"
run_manager install '[]' "$installed_json" >/dev/null
test "$(<"$references_dir/.addy-agent-skills-ref")" = 'aeac41d4d005999432bb7312f7ff06383a91d59d'
test -f "$references_dir/observability-checklist.md"
curl_count="$(wc -l <"$tmp_dir/curl.log" | tr -d ' ')"
run_manager install '[]' "$installed_json" >/dev/null
test "$(wc -l <"$tmp_dir/curl.log" | tr -d ' ')" = "$curl_count"

: >"$tmp_dir/skills.log"
run_manager install '[]' "$installed_json" >/dev/null
test "$(grep -c ' add ' "$tmp_dir/skills.log" || true)" = 0

: >"$tmp_dir/skills.log"
run_manager install '[{"name":"node","version":"22.0.0"}]' "$installed_json" >/dev/null
test "$(grep -c ' add ' "$tmp_dir/skills.log")" = 1
grep -Fq ' --skill api-and-interface-design frontend-ui-engineering observability-and-instrumentation security-and-hardening browser-testing-with-devtools ci-cd-and-automation code-simplification deprecation-and-migration documentation-and-adrs doubt-driven-development performance-optimization shipping-and-launch source-driven-development --agent pi --global --yes' "$tmp_dir/skills.log"

# Do not patch an unrelated skill that happens to use the same name.
unowned_home="$tmp_dir/unowned-home"
mkdir -p "$unowned_home/.pi/agent/skills/observability-and-instrumentation"
printf '%s\n' '---' 'name: observability-and-instrumentation' 'description: Keep this description.' 'disable-model-invocation: true' '---' >"$unowned_home/.pi/agent/skills/observability-and-instrumentation/SKILL.md"
run_manager update '[]' '[{"name":"observability-and-instrumentation","sourceUrl":"https://github.com/addyosmani/agent-skills-fork.git"}]' "$unowned_home" >/dev/null
grep -Fq 'description: Keep this description.' "$unowned_home/.pi/agent/skills/observability-and-instrumentation/SKILL.md"
grep -Fq 'disable-model-invocation: true' "$unowned_home/.pi/agent/skills/observability-and-instrumentation/SKILL.md"

# Refuse to replace even a dangling reference symlink when no manager marker exists.
dangling_home="$tmp_dir/dangling-home"
mkdir -p "$dangling_home/.pi/agent/references"
ln -s "$dangling_home/missing-target" "$dangling_home/.pi/agent/references/security-checklist.md"
if run_manager install '[]' '[]' "$dangling_home" >/dev/null 2>&1; then
	printf 'Expected manager to refuse an unowned dangling reference symlink.\n' >&2
	exit 1
fi
test -L "$dangling_home/.pi/agent/references/security-checklist.md"

printf 'Addy Pi skill reconciliation checks passed.\n'
