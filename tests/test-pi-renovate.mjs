import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const config = JSON.parse(await readFile(new URL("../renovate.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(new URL("./fixtures/chezmoi-data.json", import.meta.url), "utf8"));
const template = await readFile(new URL("../dot_config/mise/conf.d/00-base.toml.tmpl", import.meta.url), "utf8");
const packageName = "@earendil-works/pi-coding-agent";
const root = fileURLToPath(new URL("../", import.meta.url));
const templatePath = `${root}dot_config/mise/conf.d/00-base.toml.tmpl`;

function piManager() {
  const managers = config.customManagers.filter((manager) =>
    manager.customType === "regex" && manager.depNameTemplate === packageName && manager.datasourceTemplate === "npm"
  );
  assert.equal(managers.length, 1, "one npm manager should own the Pi pin");
  const manager = managers[0];
  assert.ok(manager.managerFilePatterns.some((pattern) =>
    pattern.startsWith("/") && pattern.endsWith("/") &&
    new RegExp(pattern.slice(1, -1)).test("dot_config/mise/conf.d/00-base.toml.tmpl")
  ));
  assert.equal(manager.matchStrings.length, 1);
  return new RegExp(manager.matchStrings[0], "g");
}

test("Renovate extracts one exact Pi version from the managed template", () => {
  const matches = [...template.matchAll(piManager())];
  assert.equal(matches.length, 1);
  assert.match(matches[0].groups.currentValue, /^\d+\.\d+\.\d+$/);
});

test("Pi version extraction stays inside its table and supports the next pin", () => {
  const pattern = piManager();
  const fixture = '[tools."npm:@earendil-works/pi-coding-agent"]\r\nversion = "1.7.0"\r\npostinstall = "sync"\r\n[tools.other]\r\nversion = "9.0.0"';
  assert.equal([...fixture.matchAll(pattern)][0]?.groups.currentValue, "1.7.0");
  const missing = '[tools."npm:@earendil-works/pi-coding-agent"]\npostinstall = "sync"\n[tools.other]\nversion = "9.0.0"';
  assert.equal([...missing.matchAll(pattern)].length, 0);
});

test("Pi has an explicit non-automerge grouping rule", () => {
  const rules = config.packageRules.filter((rule) => rule.matchPackageNames?.includes(packageName));
  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0].matchManagers, ["custom.regex"]);
  assert.equal(rules[0].groupName, "Pi coding agent");
  assert.equal(rules[0].automerge, false);
});

test("rendered profiles pin Pi only where Mise owns it", () => {
  for (const os of ["darwin", "linux"]) {
    for (const work of [false, true]) {
      const data = JSON.stringify({ ...fixture, chezmoi: { os, arch: "arm64" }, work: { ...fixture.work, enable: work } });
      const toml = execFileSync("chezmoi", ["--config", "/dev/null", "--config-format", "toml", "execute-template", "--source", root, "--override-data", data, "--file", templatePath], { encoding: "utf8" });
      const parsed = JSON.parse(execFileSync("chezmoi", ["--config", "/dev/null", "--config-format", "toml", "execute-template", "--with-stdin", "{{ .chezmoi.stdin | fromToml | toJson }}"], { input: toml, encoding: "utf8" }));
      const pi = parsed.tools[`npm:${packageName}`];
      if (os === "linux") assert.equal(pi, undefined);
      else {
        assert.match(pi.version, /^\d+\.\d+\.\d+$/);
        assert.match(pi.postinstall, /install-pi-subagent/);
      }
    }
  }
});
