#!/usr/bin/env bash
# Exercise Pi skill reconciliation without touching the real global skill set.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
command -v chezmoi >/dev/null 2>&1 || {
  printf 'ERROR: chezmoi is required for Pi skill template tests.\n' >&2
  exit 1
}
script_template="$repo_root/dot_config/mise/scripts/executable_manage-matt-pi-skills.tmpl"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$tmp_dir/bin" "$tmp_dir/home/.pi/agent/skills"

render_manager() {
  local work_enabled="$1" output="$2"
  chezmoi execute-template \
    --override-data "{\"work\":{\"enable\":$work_enabled}}" \
    --file "$script_template" >"$output"
  chmod +x "$output"
}

personal_script="$tmp_dir/manage-matt-pi-skills-personal"
work_script="$tmp_dir/manage-matt-pi-skills-work"
render_manager false "$personal_script"
render_manager true "$work_script"
: >"$tmp_dir/bin/pi"
chmod +x "$tmp_dir/bin/pi"

cat >"$tmp_dir/bin/npx" <<'EOF_NPX'
#!/usr/bin/env bash
set -euo pipefail
if [[ " $* " == *" list "* ]]; then
  printf '%s\n' "${FAKE_SKILLS_JSON:-[]}"
else
  printf '%s\n' "$*" >>"$FAKE_LOG"
fi
EOF_NPX
chmod +x "$tmp_dir/bin/npx"

# Keep the three Pi adaptations present so the test only observes upstream skills.
for skill in grill-me grilling grill-with-docs; do
  mkdir -p "$tmp_dir/home/.pi/agent/skills/$skill"
  : >"$tmp_dir/home/.pi/agent/skills/$skill/SKILL.md"
done

run_reconcile() {
  local manager_script="$1" mise_installed_tools="$2"
  local fake_skills_json="${FAKE_SKILLS_JSON:-}"
  if [ -z "$fake_skills_json" ]; then
    fake_skills_json='[{"name":"ask-matt","source":"mattpocock/skills"}]'
  fi
  FAKE_LOG="$tmp_dir/skills.log" \
    FAKE_SKILLS_JSON="$fake_skills_json" \
    PATH="$tmp_dir/bin:$PATH" \
    HOME="$tmp_dir/home" \
    MISE_INSTALLED_TOOLS="$mise_installed_tools" \
    bash "$manager_script" install
}

: >"$tmp_dir/skills.log"
run_reconcile "$personal_script" '[]'
test "$(grep -c ' add ' "$tmp_dir/skills.log")" = 1
test "$(grep -c ' update ' "$tmp_dir/skills.log" || true)" = 0
grep -Fq ' implement-spec ' "$tmp_dir/skills.log"
grep -Fq ' retro ' "$tmp_dir/skills.log"
grep -Fq ' pr ' "$tmp_dir/skills.log"
! grep -Fq 'resolving-merge-conflicts' "$tmp_dir/skills.log"

: >"$tmp_dir/skills.log"
run_reconcile "$work_script" '[]'
test "$(grep -c ' add ' "$tmp_dir/skills.log")" = 1
! grep -Fq ' pr ' "$tmp_dir/skills.log"

: >"$tmp_dir/skills.log"
run_reconcile "$personal_script" '[{"name":"node","version":"22.0.0"}]'
test "$(grep -c ' add ' "$tmp_dir/skills.log")" = 1
test "$(grep -c ' update ' "$tmp_dir/skills.log")" = 1
grep -Fq 'ask-matt' "$tmp_dir/skills.log"

: >"$tmp_dir/skills.log"
FAKE_SKILLS_JSON='[{"name":"ask-matt","source":"another/repository"}]' run_reconcile "$personal_script" '[]'
grep -Fq 'ask-matt' "$tmp_dir/skills.log"
test "$(grep -c ' update ' "$tmp_dir/skills.log" || true)" = 0

printf 'Pi skill reconciliation checks passed.\n'
