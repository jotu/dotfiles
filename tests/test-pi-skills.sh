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
node - "$repo_root" "$tmp_dir" <<'EOF_NODE'
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const [repoRoot, tmpDir] = process.argv.slice(2);
const sharedSkills = [
  "ask-matt",
  "code-review",
  "codebase-design",
  "diagnosing-bugs",
  "domain-modeling",
  "handoff",
  "implement",
  "improve-codebase-architecture",
  "setup-matt-pocock-skills",
  "tdd",
  "teach",
  "to-tickets",
  "triage",
  "wait-what",
  "wayfinder",
  "wizard",
];
const templatePath = path.join(repoRoot, "dot_pi/agent/settings.json.tmpl");
const sharedHome = path.join(tmpDir, "shared-home");
for (const name of sharedSkills) {
  const skillPath = path.join(sharedHome, ".agents/skills", name, "SKILL.md");
  fs.mkdirSync(path.dirname(skillPath), { recursive: true });
  fs.writeFileSync(skillPath, "fixture\n");
}
const renderSettings = (home, workEnabled = false) => JSON.parse(execFileSync("chezmoi", [
  "execute-template",
  "--override-data",
  JSON.stringify({ work: { enable: workEnabled }, chezmoi: { homeDir: home } }),
  "--file",
  templatePath,
], { encoding: "utf8" }));
const sharedSettings = renderSettings(sharedHome);
const expected = sharedSkills.map((name) => `-${sharedHome}/.pi/agent/skills/${name}`);
const missing = expected.filter((entry) => !sharedSettings.skills?.includes(entry));
assert.deepEqual(missing, [], "shared skills must exclude their native Pi copies");
const workSettings = renderSettings(sharedHome, true);
const hasPackage = (settings, prefix) => settings.packages?.some(({ source }) => source?.startsWith(prefix));
assert.ok(!hasPackage(sharedSettings, "npm:@dietrichgebert/ponytail@"), "personal Pi must not load Ponytail");
assert.ok(!hasPackage(workSettings, "npm:@dietrichgebert/ponytail@"), "work Pi must not load Ponytail");
assert.ok(!hasPackage(sharedSettings, "npm:opencode-ai@"), "personal Pi must not load OpenCode");
assert.ok(!hasPackage(workSettings, "npm:opencode-ai@"), "work Pi must not load OpenCode");
assert.ok(hasPackage(sharedSettings, "npm:pi-copilot-usage@1.0.0"), "personal Pi must load its usage package");
assert.ok(!hasPackage(sharedSettings, "npm:pi-chatgpt-limit@0.3.1"), "personal Pi must not load the work usage package");
assert.ok(hasPackage(workSettings, "npm:pi-chatgpt-limit@0.3.1"), "work Pi must load its usage package");
assert.ok(!hasPackage(workSettings, "npm:pi-copilot-usage@1.0.0"), "work Pi must not load the personal usage package");
const freshSettings = renderSettings(path.join(tmpDir, "fresh-home"));
assert.deepEqual(freshSettings.skills, [], "fresh installs must keep native Pi skills discoverable");
EOF_NODE
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

run_update() {
  local manager_script="$1"
  local fake_skills_json="${FAKE_SKILLS_JSON:-}"
  if [ -z "$fake_skills_json" ]; then
    fake_skills_json='[{"name":"ask-matt","source":"mattpocock/skills"}]'
  fi
  FAKE_LOG="$tmp_dir/skills.log" \
    FAKE_SKILLS_JSON="$fake_skills_json" \
    PATH="$tmp_dir/bin:$PATH" \
    HOME="$tmp_dir/home" \
    bash "$manager_script" update
}

: >"$tmp_dir/skills.log"
run_reconcile "$personal_script" '[]'
test "$(grep -c ' add ' "$tmp_dir/skills.log")" = 1
test "$(grep -c ' update ' "$tmp_dir/skills.log" || true)" = 0
grep -Fq 'https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336' "$tmp_dir/skills.log"
grep -Fq ' --agent pi --global --yes' "$tmp_dir/skills.log"
grep -Fq ' implement-spec ' "$tmp_dir/skills.log"
grep -Fq ' retro ' "$tmp_dir/skills.log"
grep -Fq ' pr ' "$tmp_dir/skills.log"
! grep -Fq 'resolving-merge-conflicts' "$tmp_dir/skills.log"

: >"$tmp_dir/skills.log"
run_reconcile "$work_script" '[]'
test "$(grep -c ' add ' "$tmp_dir/skills.log")" = 1
grep -Fq ' --agent pi --global --yes' "$tmp_dir/skills.log"
! grep -Fq ' pr ' "$tmp_dir/skills.log"

: >"$tmp_dir/skills.log"
run_reconcile "$personal_script" '[{"name":"node","version":"22.0.0"}]'
test "$(grep -c ' add ' "$tmp_dir/skills.log")" = 2
test "$(grep -c ' update ' "$tmp_dir/skills.log" || true)" = 0
grep -Fq ' add https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336 --skill ask-matt --agent pi --global --yes' "$tmp_dir/skills.log"
test "$(grep -c -- '--agent pi --global --yes' "$tmp_dir/skills.log")" = 2
grep -Fq 'ask-matt' "$tmp_dir/skills.log"

: >"$tmp_dir/skills.log"
FAKE_SKILLS_JSON='[{"name":"ask-matt","source":"another/repository"}]' run_reconcile "$personal_script" '[]'
grep -Fq 'ask-matt' "$tmp_dir/skills.log"
test "$(grep -c ' update ' "$tmp_dir/skills.log" || true)" = 0

: >"$tmp_dir/skills.log"
run_update "$personal_script"
test "$(grep -c ' add ' "$tmp_dir/skills.log")" = 1
test "$(grep -c ' update ' "$tmp_dir/skills.log" || true)" = 0
grep -Fq ' add https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336 --skill ask-matt --agent pi --global --yes' "$tmp_dir/skills.log"

printf 'Pi skill reconciliation checks passed.\n'
