#!/usr/bin/env bash
# Verify the explicit Addy cleanup task without touching global Pi skills.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
manager="$repo_root/dot_config/mise/scripts/executable_manage-addy-pi-skills"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$tmp_dir/bin" "$tmp_dir/home/.pi/agent/skills" "$tmp_dir/home/.pi/agent/references"

cat >"$tmp_dir/bin/npx" <<'EOF_NPX'
#!/usr/bin/env bash
set -euo pipefail
if [ "${DO_NOT_TRACK:-}" != 1 ] || [ "${NPM_CONFIG_OFFLINE:-}" != true ]; then
	printf 'Expected the skills CLI to run offline without telemetry.\n' >&2
	exit 2
fi
if [[ " $* " == *" list --global --agent pi --json "* ]]; then
	printf '%s\n' "${FAKE_SKILLS_JSON:-[]}"
	exit 0
fi
if [[ " $* " == *" remove "* ]]; then
	printf '%s\n' "$*" >>"$FAKE_LOG"
	remove_skills=false
	for arg in "$@"; do
		if [ "$arg" = remove ]; then
			remove_skills=true
			continue
		fi
		if [[ "$arg" == --* ]]; then
			remove_skills=false
			continue
		fi
		if [ "$remove_skills" = true ]; then
			rm -rf "$HOME/.pi/agent/skills/$arg"
		fi
	done
	exit 0
fi
printf 'Unexpected skills CLI invocation: %s\n' "$*" >&2
exit 2
EOF_NPX
chmod +x "$tmp_dir/bin/npx"

run_manager() {
	local skills_json="$1" home="${2:-$tmp_dir/home}"
	FAKE_LOG="$tmp_dir/skills.log" \
		FAKE_SKILLS_JSON="$skills_json" \
		PATH="$tmp_dir/bin:$PATH" \
		HOME="$home" \
		bash "$manager" remove
}

for skill in api-and-interface-design security-and-hardening observability-and-instrumentation frontend-ui-engineering unselected-addy-skill; do
	mkdir -p "$tmp_dir/home/.pi/agent/skills/$skill"
	printf '%s\n' "$skill" >"$tmp_dir/home/.pi/agent/skills/$skill/SKILL.md"
done
mkdir -p "$tmp_dir/home/.pi/agent/skills/api-and-interface-design/references"
printf 'nested reference\n' >"$tmp_dir/home/.pi/agent/skills/api-and-interface-design/references/design.md"

cat >"$tmp_dir/home/.pi/agent/references/.addy-agent-skills-ref" <<'EOF_MARKER'
aeac41d4d005999432bb7312f7ff06383a91d59d
EOF_MARKER
for reference in accessibility-checklist.md definition-of-done.md observability-checklist.md orchestration-patterns.md performance-checklist.md security-checklist.md; do
	printf '%s\n' "$reference" >"$tmp_dir/home/.pi/agent/references/$reference"
done
printf 'Keep this unrelated reference.\n' >"$tmp_dir/home/.pi/agent/references/local-notes.md"

owned_skills='[
  {"name":"api-and-interface-design","source":"addyosmani/agent-skills","sourceUrl":"https://github.com/addyosmani/agent-skills.git"},
  {"name":"security-and-hardening","sourceUrl":"https://github.com/addyosmani/agent-skills/tree/aeac41d4d005999432bb7312f7ff06383a91d59d"},
  {"name":"observability-and-instrumentation","sourceUrl":"https://github.com/addyosmani/agent-skills-fork.git"},
  {"name":"frontend-ui-engineering","source":"addyosmani/agent-skills","sourceUrl":"https://github.com/example/agent-skills.git"},
  {"name":"unselected-addy-skill","source":"addyosmani/agent-skills"}
]'
: >"$tmp_dir/skills.log"
run_manager "$owned_skills" >"$tmp_dir/remove.log"

grep -Fq ' remove api-and-interface-design security-and-hardening --global --agent pi --yes' "$tmp_dir/skills.log"
test "$(wc -l <"$tmp_dir/skills.log" | tr -d ' ')" = 1
test ! -e "$tmp_dir/home/.pi/agent/skills/api-and-interface-design"
test ! -e "$tmp_dir/home/.pi/agent/skills/security-and-hardening"
test -f "$tmp_dir/home/.pi/agent/skills/observability-and-instrumentation/SKILL.md"
test -f "$tmp_dir/home/.pi/agent/skills/frontend-ui-engineering/SKILL.md"
test -f "$tmp_dir/home/.pi/agent/skills/unselected-addy-skill/SKILL.md"
test ! -e "$tmp_dir/home/.pi/agent/references/.addy-agent-skills-ref"
for reference in accessibility-checklist.md definition-of-done.md observability-checklist.md orchestration-patterns.md performance-checklist.md security-checklist.md; do
	test ! -e "$tmp_dir/home/.pi/agent/references/$reference"
done
grep -Fq 'Keep this unrelated reference.' "$tmp_dir/home/.pi/agent/references/local-notes.md"
run_manager '[]' >"$tmp_dir/repeat.log"
test "$(wc -l <"$tmp_dir/skills.log" | tr -d ' ')" = 1

# An unrecognized owner marker must leave the references untouched.
unowned_home="$tmp_dir/unowned-home"
mkdir -p "$unowned_home/.pi/agent/references"
printf 'unrecognized-owner\n' >"$unowned_home/.pi/agent/references/.addy-agent-skills-ref"
printf 'user-owned\n' >"$unowned_home/.pi/agent/references/security-checklist.md"
run_manager '[]' "$unowned_home" >"$tmp_dir/unowned.log"
test -f "$unowned_home/.pi/agent/references/.addy-agent-skills-ref"
grep -Fq 'user-owned' "$unowned_home/.pi/agent/references/security-checklist.md"

# A symlinked reference is never followed or removed as an owned regular file.
symlink_home="$tmp_dir/symlink-home"
mkdir -p "$symlink_home/.pi/agent/references"
printf 'aeac41d4d005999432bb7312f7ff06383a91d59d\n' >"$symlink_home/.pi/agent/references/.addy-agent-skills-ref"
printf 'outside reference\n' >"$tmp_dir/outside-reference.md"
ln -s "$tmp_dir/outside-reference.md" "$symlink_home/.pi/agent/references/security-checklist.md"
run_manager '[]' "$symlink_home" >"$tmp_dir/symlink.log"
test -L "$symlink_home/.pi/agent/references/security-checklist.md"
grep -Fq 'outside reference' "$tmp_dir/outside-reference.md"
test -f "$symlink_home/.pi/agent/references/.addy-agent-skills-ref"

# Invalid skill ownership data must fail closed before any removal.
invalid_home="$tmp_dir/invalid-home"
mkdir -p "$invalid_home/.pi/agent/skills/api-and-interface-design"
printf 'keep\n' >"$invalid_home/.pi/agent/skills/api-and-interface-design/SKILL.md"
if run_manager 'not-json' "$invalid_home" >"$tmp_dir/invalid.log" 2>&1; then
	printf 'Expected invalid skill metadata to fail cleanup.\n' >&2
	exit 1
fi
test -f "$invalid_home/.pi/agent/skills/api-and-interface-design/SKILL.md"

printf 'Addy Pi cleanup checks passed.\n'
