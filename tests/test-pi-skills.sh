#!/usr/bin/env bash
# Exercise Pi skill reconciliation without touching the real global skill set.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
script="$repo_root/dot_config/mise/scripts/manage-matt-pi-skills"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$tmp_dir/bin" "$tmp_dir/home/.pi/agent/skills"
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
  local fake_skills_json="${FAKE_SKILLS_JSON:-}"
  if [ -z "$fake_skills_json" ]; then
    fake_skills_json='[{"name":"ask-matt","source":"mattpocock/skills"}]'
  fi
  FAKE_LOG="$tmp_dir/skills.log" \
    FAKE_SKILLS_JSON="$fake_skills_json" \
    PATH="$tmp_dir/bin:$PATH" \
    HOME="$tmp_dir/home" \
    MISE_INSTALLED_TOOLS="$1" \
    bash "$script" install
}

: >"$tmp_dir/skills.log"
run_reconcile '[]'
test "$(grep -c ' add ' "$tmp_dir/skills.log")" = 1
test "$(grep -c ' update ' "$tmp_dir/skills.log" || true)" = 0

: >"$tmp_dir/skills.log"
run_reconcile '[{"name":"node","version":"22.0.0"}]'
test "$(grep -c ' add ' "$tmp_dir/skills.log")" = 1
test "$(grep -c ' update ' "$tmp_dir/skills.log")" = 1
grep -Fq 'ask-matt' "$tmp_dir/skills.log"

: >"$tmp_dir/skills.log"
FAKE_SKILLS_JSON='[{"name":"ask-matt","source":"another/repository"}]' run_reconcile '[]'
grep -Fq 'ask-matt' "$tmp_dir/skills.log"
test "$(grep -c ' update ' "$tmp_dir/skills.log" || true)" = 0

printf 'Pi skill reconciliation checks passed.\n'
