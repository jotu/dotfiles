import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import safetyGate, { classifyToolCall, fileScopeReason, hasPotentialPackageAuthConfig, protectedPathReason, riskyCommandReason, sensitiveCommandReason } from "../dot_pi/agent/extensions/safety-gate.ts";

test("ordinary missing paths in the task workspace remain usable", () => {
	const temporaryDirectory = mkdtempSync(join(tmpdir(), "pi-safety-gate-"));
	try {
		assert.equal(protectedPathReason("src/new-file.ts", temporaryDirectory), undefined);
	} finally {
		rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});

test("file access is scoped to the active task worktree", () => {
	const temporaryDirectory = mkdtempSync(join(tmpdir(), "pi-safety-gate-"));
	try {
		assert.equal(fileScopeReason("src/new-file.ts", temporaryDirectory, temporaryDirectory), undefined);
		assert.match(fileScopeReason(join(tmpdir(), "pi-task-scratch.txt"), temporaryDirectory, temporaryDirectory), /outside the task worktree/);
		assert.match(fileScopeReason(join(homedir(), "outside-task-file"), temporaryDirectory, temporaryDirectory), /outside the task worktree/);
	} finally {
		rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});

test("direct shell file access stays inside the task worktree", () => {
	const worktree = mkdtempSync(join(tmpdir(), "pi-safety-gate-"));
	const context = { worktreeRoot: worktree, cwd: worktree, hasUI: true };
	const outsidePath = join(homedir(), "outside-task-file");
	try {
		assert.equal(classifyToolCall("bash", { command: "cp src/file.txt local-copy.txt" }, context).action, "allow");
		assert.equal(classifyToolCall("bash", { command: "cat src/file.txt" }, context).action, "allow");
		assert.equal(classifyToolCall("bash", { command: "cat src/*.txt" }, context).action, "allow");
		assert.equal(classifyToolCall("bash", { command: "rg -n 'TODO' src" }, context).action, "allow");
		assert.equal(classifyToolCall("bash", { command: "find src -name '*.ts'" }, context).action, "allow");
		assert.equal(classifyToolCall("bash", { command: "ls src" }, context).action, "allow");
		assert.equal(classifyToolCall("bash", { command: "printf x > generated.txt" }, context).action, "allow");
		assert.equal(classifyToolCall("bash", { command: "echo '>'" }, context).action, "allow");

		for (const command of [
			`cp src/file.txt ${outsidePath}`,
			`cp ${outsidePath} local-copy.txt`,
			`cat ${outsidePath}`,
			`rg TODO ${outsidePath}`,
			`rg -Ff ${outsidePath} TODO`,
			"find ../outside -name '*.txt'",
			"find -- ../outside",
			"ls ../outside",
			"cat ../outside*.txt",
			`printf x > ${outsidePath}`,
			`printf x > "${outsidePath}"`,
		]) {
			assert.deepEqual(
				classifyToolCall("bash", { command }, context),
				{ action: "confirm", category: "file_scope", reason: "accessing or changing files outside the task worktree", promptDetail: command },
			);
		}
		const wrappedCopy = classifyToolCall("bash", { command: "env cp src/file.txt ../outside.txt" }, context);
		assert.equal(wrappedCopy.action, "confirm");
		assert.equal(wrappedCopy.category, "file_scope");
	} finally {
		rmSync(worktree, { recursive: true, force: true });
	}
});

test("symlink aliases into protected home paths remain blocked", () => {
	const temporaryDirectory = mkdtempSync(join(tmpdir(), "pi-safety-gate-"));
	try {
		symlinkSync(homedir(), join(temporaryDirectory, "home-alias"), "dir");
		assert.match(protectedPathReason("home-alias/.ssh/agent-key", temporaryDirectory), /protected path/);
	} finally {
		rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});

test("environment dumps are treated as sensitive", () => {
	assert.match(sensitiveCommandReason("env"), /environment variables/);
	assert.match(sensitiveCommandReason("env | sort"), /environment variables/);
	assert.match(sensitiveCommandReason("env -u PATH"), /environment variables/);
	assert.match(sensitiveCommandReason("env --unset=PATH"), /environment variables/);
	assert.match(sensitiveCommandReason("env --"), /environment variables/);
	assert.match(sensitiveCommandReason("env --debug"), /environment variables/);
	assert.match(sensitiveCommandReason("declare -px"), /environment variables/);
	assert.match(sensitiveCommandReason("printenv AWS_SECRET_ACCESS_KEY"), /environment variables/);
	assert.equal(sensitiveCommandReason("env NODE_ENV=test node app.js"), undefined);
});

test("authenticated request prompts without showing credential material", async () => {
	const handlers = new Map();
	safetyGate({ on: (event, handler) => handlers.set(event, handler) });
	const confirmations = [];
	const context = {
		cwd: process.cwd(),
		hasUI: true,
		ui: { confirm: async (...args) => { confirmations.push(args); return true; } },
	};

	const result = await handlers.get("tool_call")(
		{
			toolName: "bash",
			input: { command: "curl -H 'Authorization: Bearer example-token' https://api.example.com/data" },
		},
		context,
	);
	assert.equal(result, undefined);
	assert.equal(confirmations.length, 1);
	assert.match(confirmations[0][0], /authenticated request/);
	assert.doesNotMatch(confirmations[0][1], /example-token/);
});

test("query-string credentials require approval and are redacted", () => {
	const secretUrl = "https://api.example.com/data?access_token=query-secret";
	assert.match(riskyCommandReason(`curl ${secretUrl}`), /authenticated request/);
	for (const command of [
		`curl ${secretUrl}`,
		"curl https://api.example.com/data?key=query-secret",
		"curl https://10.0.0.2/data?access_token=query-secret",
	]) {
		assert.deepEqual(
			classifyToolCall("bash", { command }, { worktreeRoot: process.cwd(), cwd: process.cwd(), hasUI: true }),
			{
				action: "confirm",
				category: "credential",
				reason: "making an authenticated request",
				promptDetail: "Request details redacted to avoid exposing credentials or payloads.",
			},
		);
	}
});

test("inline credential assignments are redacted and cannot bypass scoped delivery authorization", async () => {
	const handlers = new Map();
	const confirmations = [];
	safetyGate({ on: (event, handler) => handlers.set(event, handler) });
	const context = {
		cwd: process.cwd(),
		hasUI: true,
		ui: { confirm: async (...args) => { confirmations.push(args); return false; } },
	};

	const request = await handlers.get("tool_call")(
		{ toolName: "bash", input: { command: "API_TOKEN=example-token curl https://api.example.com/data" } },
		context,
	);
	assert.equal(request.block, true);
	assert.match(confirmations[0][0], /authenticated request/);
	assert.doesNotMatch(confirmations[0][1], /example-token/);

	handlers.get("input")({ text: "Create a PR for this change." });
	const delivery = await handlers.get("tool_call")(
		{ toolName: "bash", input: { command: "GH_TOKEN=example-token gh pr create --title change" } },
		context,
	);
	assert.equal(delivery.block, true);
	assert.doesNotMatch(confirmations[1][1], /example-token/);
});

test("approval events carry safe categories and never copy the command", async () => {
	const handlers = new Map();
	const emitted = [];
	safetyGate({
		on: (event, handler) => handlers.set(event, handler),
		events: { emit: (name, payload) => emitted.push({ name, payload }) },
	});
	const context = {
		cwd: process.cwd(),
		hasUI: true,
		ui: { confirm: async () => true },
	};

	await handlers.get("tool_call")(
		{ toolName: "bash", input: { command: "aws sts get-caller-identity" } },
		context,
	);

	assert.deepEqual(emitted, [
		{
			name: "safety-gate:decision",
			payload: { phase: "approval_required", category: "remote_access", reason: "accessing a remote cloud service" },
		},
		{ name: "herdr:blocked", payload: { active: true, label: "Safety gate needs attention" } },
		{
			name: "safety-gate:decision",
			payload: { phase: "resolved", category: "remote_access", reason: "accessing a remote cloud service", outcome: "approved" },
		},
		{ name: "herdr:blocked", payload: { active: false } },
	]);
	assert.doesNotMatch(JSON.stringify(emitted), /aws sts get-caller-identity/);
});

test("allowed actions do not emit safety events", async () => {
	const handlers = new Map();
	const emitted = [];
	safetyGate({
		on: (event, handler) => handlers.set(event, handler),
		events: { emit: (name, payload) => emitted.push({ name, payload }) },
	});
	const result = await handlers.get("tool_call")(
		{ toolName: "bash", input: { command: "curl https://docs.example.com/guide" } },
		{ cwd: process.cwd(), hasUI: true, ui: { confirm: async () => assert.fail("allowed actions do not prompt") } },
	);

	assert.equal(result, undefined);
	assert.deepEqual(emitted, []);
});

test("observer failures do not change a Pi approval decision", async () => {
	const handlers = new Map();
	safetyGate({
		on: (event, handler) => handlers.set(event, handler),
		events: { emit: () => { throw new Error("observer unavailable"); } },
	});
	const result = await handlers.get("tool_call")(
		{ toolName: "bash", input: { command: "aws sts get-caller-identity" } },
		{ cwd: process.cwd(), hasUI: true, ui: { confirm: async () => true } },
	);

	assert.equal(result, undefined);
});

test("a confirmation UI failure blocks the action and clears Herdr state", async () => {
	const handlers = new Map();
	const emitted = [];
	safetyGate({
		on: (event, handler) => handlers.set(event, handler),
		events: { emit: (name, payload) => emitted.push({ name, payload }) },
	});
	const result = await handlers.get("tool_call")(
		{ toolName: "bash", input: { command: "aws sts get-caller-identity" } },
		{ cwd: process.cwd(), hasUI: true, ui: { confirm: async () => { throw new Error("UI closed"); } } },
	);

	assert.equal(result.block, true);
	assert.deepEqual(
		emitted.filter(({ name }) => name === "safety-gate:decision").map(({ payload }) => payload.phase),
		["approval_required", "blocked"],
	);
	assert.deepEqual(
		emitted.filter(({ name }) => name === "herdr:blocked").map(({ payload }) => payload),
		[{ active: true, label: "Safety gate needs attention" }, { active: false }],
	);
});

test("denied approval reports the outcome and clears Herdr blocked state", async () => {
	const handlers = new Map();
	const emitted = [];
	safetyGate({
		on: (event, handler) => handlers.set(event, handler),
		events: { emit: (name, payload) => emitted.push({ name, payload }) },
	});
	const result = await handlers.get("tool_call")(
		{ toolName: "bash", input: { command: "aws sts get-caller-identity" } },
		{ cwd: process.cwd(), hasUI: true, ui: { confirm: async () => false } },
	);

	assert.equal(result.block, true);
	assert.deepEqual(
		emitted.filter(({ name }) => name === "safety-gate:decision").map(({ payload }) => payload),
		[
			{ phase: "approval_required", category: "remote_access", reason: "accessing a remote cloud service" },
			{ phase: "resolved", category: "remote_access", reason: "accessing a remote cloud service", outcome: "denied" },
		],
	);
	assert.deepEqual(
		emitted.filter(({ name }) => name === "herdr:blocked").map(({ payload }) => payload),
		[{ active: true, label: "Safety gate needs attention" }, { active: false }],
	);
});

test("hard denials emit an informational event without blocking Herdr state", async () => {
	const handlers = new Map();
	const emitted = [];
	safetyGate({
		on: (event, handler) => handlers.set(event, handler),
		events: { emit: (name, payload) => emitted.push({ name, payload }) },
	});
	const result = await handlers.get("tool_call")(
		{ toolName: "bash", input: { command: "cat ~/.aws/credentials" } },
		{ cwd: process.cwd(), hasUI: true, ui: { confirm: async () => assert.fail("hard denials do not prompt") } },
	);

	assert.equal(result.block, true);
	assert.deepEqual(emitted, [
		{
			name: "safety-gate:decision",
			payload: { phase: "blocked", category: "credential", reason: "direct access to protected credentials or keys" },
		},
	]);
	assert.doesNotMatch(JSON.stringify(emitted), /\.aws\/credentials/);
});

test("a block without UI notifies Herdr until the run progresses", async () => {
	const handlers = new Map();
	const emitted = [];
	safetyGate({
		on: (event, handler) => handlers.set(event, handler),
		events: { emit: (name, payload) => emitted.push({ name, payload }) },
	});
	const result = await handlers.get("tool_call")(
		{ toolName: "bash", input: { command: "aws sts get-caller-identity" } },
		{ cwd: process.cwd(), hasUI: false },
	);
	assert.equal(result.block, true);
	assert.deepEqual(emitted, [
		{
			name: "safety-gate:decision",
			payload: { phase: "blocked", category: "remote_access", reason: "accessing a remote cloud service" },
		},
		{ name: "herdr:blocked", payload: { active: true, label: "Safety gate needs attention" } },
	]);

	handlers.get("turn_start")();
	assert.deepEqual(emitted.at(-1), { name: "herdr:blocked", payload: { active: false } });
});

test("the TUIOS-owned integration file is protected from direct access", () => {
	assert.match(
		protectedPathReason(join(homedir(), ".pi", "agent", "extensions", "tuios-agent-state.ts"), process.cwd()),
		/protected path/,
	);
});

test("direct file tools allow task files, prompt outside scope, and keep protected paths blocked", async () => {
	const handlers = new Map();
	safetyGate({ on: (event, handler) => handlers.set(event, handler) });
	const confirmations = [];
	const context = {
		cwd: process.cwd(),
		hasUI: true,
		ui: { confirm: async (...args) => { confirmations.push(args); return false; } },
	};

	assert.equal(await handlers.get("tool_call")({ toolName: "write", input: { path: "README.md" } }, context), undefined);
	const outside = await handlers.get("tool_call")(
		{ toolName: "write", input: { path: join(homedir(), "outside-task-file") } },
		context,
	);
	assert.equal(outside.block, true);
	assert.match(confirmations[0][0], /outside the task worktree/);
	const temporaryPath = await handlers.get("tool_call")(
		{ toolName: "write", input: { path: join(tmpdir(), "pi-task-scratch.txt") } },
		context,
	);
	assert.equal(temporaryPath.block, true);
	assert.match(confirmations[1][0], /outside the task worktree/);
	const protectedPath = await handlers.get("tool_call")(
		{ toolName: "read", input: { path: join(homedir(), ".npmrc") } },
		context,
	);
	assert.equal(protectedPath.block, true);
	assert.equal(confirmations.length, 2);
});

test("directory and search tools respect the task file scope", async () => {
	const handlers = new Map();
	safetyGate({ on: (event, handler) => handlers.set(event, handler) });
	const context = {
		cwd: process.cwd(),
		hasUI: true,
		ui: { confirm: async () => false },
	};

	for (const toolName of ["ls", "grep", "find"]) {
		assert.equal(await handlers.get("tool_call")({ toolName, input: { path: "." } }, context), undefined);
		const outside = await handlers.get("tool_call")(
			{ toolName, input: { path: join(homedir(), "outside-task-file") } },
			context,
		);
		assert.equal(outside.block, true, toolName);
		const protectedPath = await handlers.get("tool_call")(
			{ toolName, input: { path: join(homedir(), ".ssh") } },
			context,
		);
		assert.equal(protectedPath.block, true, toolName);
	}
});

test("ordinary public research is classified as allowed", () => {
	assert.deepEqual(
		classifyToolCall("bash", { command: "curl https://docs.example.com/guide" }, {
			worktreeRoot: process.cwd(),
			cwd: process.cwd(),
			hasUI: true,
		}),
		{ action: "allow" },
	);
});

test("classifies remote access as a confirmation with a safe category", () => {
	assert.deepEqual(
		classifyToolCall("bash", { command: "aws sts get-caller-identity" }, {
			worktreeRoot: process.cwd(),
			cwd: process.cwd(),
			hasUI: true,
			authConfigPresent: false,
		}),
		{
			action: "confirm",
			category: "remote_access",
			reason: "accessing a remote cloud service",
			promptDetail: "aws sts get-caller-identity",
		},
	);
});

test("blocks credential access without putting paths into the decision", () => {
	assert.deepEqual(
		classifyToolCall("read", { path: join(tmpdir(), ".env") }, {
			worktreeRoot: process.cwd(),
			cwd: process.cwd(),
			hasUI: true,
		}),
		{
			action: "block",
			category: "credential",
			reason: "accessing protected credential or secret material",
			needsAttention: false,
		},
	);
});

test("turns an unpromptable remote action into an attention-worthy block", () => {
	assert.deepEqual(
		classifyToolCall("bash", { command: "aws sts get-caller-identity" }, {
			worktreeRoot: process.cwd(),
			cwd: process.cwd(),
			hasUI: false,
			authConfigPresent: false,
		}),
		{
			action: "block",
			category: "remote_access",
			reason: "accessing a remote cloud service",
			needsAttention: true,
		},
	);
});

test("public read-only research does not require confirmation", () => {
	assert.equal(riskyCommandReason("curl https://docs.example.com/guide"), undefined);
	assert.equal(riskyCommandReason("curl https://fdic.gov/guide"), undefined);
	assert.equal(riskyCommandReason("curl https://docs.example.com/?monkey=banana"), undefined);
	assert.match(riskyCommandReason("curl http://registry/"), /private or internal service/);
	assert.equal(riskyCommandReason("curl http://[::1]/health"), undefined);
	assert.match(riskyCommandReason("curl http://[fd00::1]/health"), /private or internal service/);
	assert.match(riskyCommandReason("curl https://10.24.0.8/health"), /private or internal service/);
	assert.match(riskyCommandReason("curl https://api.internal/health"), /private or internal service/);
	assert.match(
		riskyCommandReason("curl -H 'Authorization: Bearer example-token' https://api.example.com/data"),
		/authenticated request/,
	);
	assert.match(riskyCommandReason("curl --cookie session=example https://docs.example.com"), /authenticated request/);
	assert.match(riskyCommandReason("curl -b session=example https://docs.example.com"), /authenticated request/);
	assert.match(riskyCommandReason("curl --user alice:example https://docs.example.com"), /authenticated request/);
	assert.match(
		riskyCommandReason("kubectl --context=kind-dev apply -f https://api.internal/manifest.yaml"),
		/private or internal service/,
	);
	assert.match(
		riskyCommandReason("helm --kube-context=kind-dev upgrade app oci://registry.internal/chart"),
		/private or internal service/,
	);
	assert.equal(
		riskyCommandReason("kubectl --context=kind-dev apply -f https://docs.example.com/manifest.yaml"),
		undefined,
	);
	assert.match(riskyCommandReason("curl -X POST https://example.com/api"), /uploading data/);
	assert.match(riskyCommandReason("wget --method=PUT https://example.com/api"), /uploading data/);
	assert.match(riskyCommandReason("wget --body-data=payload https://example.com/api"), /uploading data/);
	assert.match(riskyCommandReason("http POST https://example.com/api"), /uploading data/);
	assert.match(riskyCommandReason("xh DELETE https://example.com/api"), /uploading data/);
});

test("local branch and Worktrunk worktree setup is allowed", () => {
	assert.equal(riskyCommandReason("git switch -c pi/task"), undefined);
	assert.equal(riskyCommandReason("git branch pi/task"), undefined);
	assert.match(riskyCommandReason("git worktree add ../task pi/task"), /Worktrunk/);
	assert.equal(riskyCommandReason("wt switch --create pi/task"), undefined);
	assert.equal(riskyCommandReason("wt switch ^"), undefined);
	assert.match(riskyCommandReason("wt switch another-agent-task"), /another Worktrunk workspace/);
	assert.match(riskyCommandReason("wt switch pr:123"), /another Worktrunk workspace/);
	assert.match(riskyCommandReason("wt switch --create followup --base pr:123"), /remote PR/);
	assert.equal(riskyCommandReason("wt step prune --dry-run"), undefined);
	for (const command of ["wt merge", "wt remove pi/task", "wt step push", "wt step prune"]) {
		assert.match(riskyCommandReason(command), /Worktrunk|local branch/i, command);
	}
});

test("lockfile-based project installs are allowed only without registry credential configuration", () => {
	const publicInstallContext = { worktreeRoot: process.cwd(), cwd: process.cwd(), authConfigPresent: false };
	assert.equal(riskyCommandReason("npm ci", publicInstallContext), undefined);
	assert.equal(riskyCommandReason("pnpm install --frozen-lockfile", publicInstallContext), undefined);
	assert.equal(riskyCommandReason("yarn install --immutable", publicInstallContext), undefined);
	assert.equal(riskyCommandReason("bun install --frozen-lockfile", publicInstallContext), undefined);
	assert.equal(riskyCommandReason("pip install --require-hashes -r requirements.txt", publicInstallContext), undefined);
	assert.match(riskyCommandReason("npm ci --registry=https://registry.npmjs.org"), /dependencies/);
	assert.match(riskyCommandReason("npm ci --userconfig=/tmp/registry.conf"), /dependencies/);
	assert.match(
		riskyCommandReason("npm ci", { worktreeRoot: process.cwd(), cwd: join(homedir(), "outside-task"), authConfigPresent: false }),
		/outside the task worktree/,
	);
	assert.match(
		riskyCommandReason("terraform validate", { worktreeRoot: process.cwd(), cwd: join(homedir(), "outside-task") }),
		/outside the task worktree/,
	);
	assert.match(riskyCommandReason("uv sync --frozen --default-index=https://packages.example.org/simple", publicInstallContext), /dependencies/);
	assert.match(riskyCommandReason("pip install --require-hashes -r requirements.txt --find-links=https://packages.example.org/wheels", publicInstallContext), /dependencies/);
	assert.match(riskyCommandReason("npm ci https://user:token@registry.npmjs.org/private-package.tgz"), /authenticated request/);
	assert.match(
		riskyCommandReason("pip install --require-hashes --index-url=https://user:token@pypi.org/simple -r requirements.txt"),
		/authenticated request/,
	);
	assert.match(riskyCommandReason("pip install --require-hashes --target /tmp/out -r requirements.txt"), /dependencies/);
	assert.match(riskyCommandReason("npm ci --registry=https://packages.internal/npm"), /private or internal service/);
	assert.match(riskyCommandReason("npm install new-package"), /dependencies/);
	assert.match(riskyCommandReason("mise install node@22"), /tooling or dependencies/);
});

test("package registry environment settings are detected by name only", () => {
	const temporaryDirectory = mkdtempSync(join(tmpdir(), "pi-safety-gate-env-"));
	try {
		for (const name of [
			"npm_config_registry",
			"NPM_CONFIG_REGISTRY",
			"npm_config_//registry.example.com/:_authToken",
			"YARN_NPM_REGISTRY_SERVER",
			"PIP_INDEX_URL",
			"UV_DEFAULT_INDEX",
			"UV_INDEX_CORPORATE_URL",
		]) {
			assert.equal(
				hasPotentialPackageAuthConfig({ cwd: temporaryDirectory, worktreeRoot: temporaryDirectory }, { [name]: "configured" }),
				true,
				name,
			);
		}
		assert.deepEqual(
			classifyToolCall("bash", { command: "npm ci" }, {
				worktreeRoot: temporaryDirectory,
				cwd: temporaryDirectory,
				hasUI: true,
				authConfigPresent: true,
			}),
			{
				action: "confirm",
				category: "credential",
				reason: "installing dependencies with possible authenticated or private registry access",
				promptDetail: "npm ci",
			},
		);
	} finally {
		rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});

test("locked installs ask when registry configuration is present without inspecting its contents", () => {
	const temporaryDirectory = mkdtempSync(join(tmpdir(), "pi-safety-gate-install-"));
	try {
		writeFileSync(join(temporaryDirectory, ".npmrc"), "\n");
		assert.match(
			riskyCommandReason("npm ci", { worktreeRoot: temporaryDirectory, cwd: temporaryDirectory }),
			/authenticated or private registry/,
		);
		rmSync(join(temporaryDirectory, ".npmrc"));
		writeFileSync(join(temporaryDirectory, "bunfig.toml"), "\n");
		assert.match(
			riskyCommandReason("bun install --frozen-lockfile", { worktreeRoot: temporaryDirectory, cwd: temporaryDirectory }),
			/authenticated or private registry/,
		);
	} finally {
		rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});

test("explicit local Kubernetes contexts are allowed", () => {
	assert.equal(riskyCommandReason("kubectl --context=kind-dev get pods"), undefined);
	assert.equal(riskyCommandReason("kubectl --context k3d-local apply -f app.yaml"), undefined);
	assert.equal(riskyCommandReason("helm --kube-context=minikube upgrade app ./chart"), undefined);
});

test("implicit, remote, overridden, or compound Kubernetes commands require permission", () => {
	for (const command of [
		"kubectl get pods",
		"kubectl --context=production get pods",
		"kubectl --kubeconfig ./other-config --context=kind-dev get pods",
		"kubectl --context=kind-dev --context=production get pods",
		"kubectl --context=kind-dev --cluster=production get pods",
		"kubectl --context=kind-dev get pods; kubectl --context=production get pods",
		"helm --kube-context=kind-dev --kube-context=production upgrade app ./chart",
		"helm upgrade app ./chart",
	]) {
		assert.match(riskyCommandReason(command), /Kubernetes control plane/, command);
	}
});

test("local database and LocalStack endpoints are allowed", () => {
	assert.equal(riskyCommandReason("psql -h localhost -d app"), undefined);
	assert.equal(riskyCommandReason("mysql --host=127.0.0.1 app"), undefined);
	assert.equal(riskyCommandReason("mongosh mongodb://[::1]:27017/app"), undefined);
	assert.equal(riskyCommandReason("aws --endpoint-url=http://localhost:4566 s3 ls"), undefined);
	assert.match(riskyCommandReason("aws --endpoint-url=http://127.api.example s3 ls"), /remote cloud service/);
	assert.match(
		riskyCommandReason("aws --endpoint-url=http://localhost:4566 --endpoint-url=https://cloud.example s3 ls"),
		/remote cloud service/,
	);
	assert.match(riskyCommandReason("psql -h 127.db.example -d app"), /remote database service/);
	assert.match(riskyCommandReason("psql postgres://localhost/app -h db.internal"), /remote database service/);
});

test("local infrastructure commands do not bypass secret or destructive-operation checks", () => {
	assert.match(sensitiveCommandReason("kubectl --context=kind-dev config view --raw"), /credential/);
	assert.match(sensitiveCommandReason("kubectl --context=kind-dev get secrets -o yaml"), /secret/);
	assert.match(sensitiveCommandReason("aws --endpoint-url=http://localhost:4566 configure get aws_secret_access_key"), /credential/);
	assert.match(riskyCommandReason("kubectl --context=kind-dev delete pvc data"), /persistent data/);
	assert.match(riskyCommandReason("kind delete cluster --name dev"), /cluster/);
	assert.match(riskyCommandReason("minikube delete -p dev"), /cluster/);
	assert.match(riskyCommandReason("k3d cluster delete dev"), /cluster/);
	assert.match(riskyCommandReason("docker volume rm data"), /persistent data/);
	assert.match(riskyCommandReason("docker system prune --volumes -f"), /persistent data/);
	assert.match(riskyCommandReason("docker compose down --volumes"), /persistent data/);
	assert.equal(riskyCommandReason("docker image prune -f"), undefined);
	assert.equal(riskyCommandReason("docker builder prune -f"), undefined);
	assert.match(riskyCommandReason("docker container prune -f"), /destructive local Docker cleanup/);
	assert.match(riskyCommandReason("psql -h localhost -c 'DROP DATABASE app'"), /database data/);
	assert.equal(riskyCommandReason("kubectl --context=kind-dev delete pod app"), undefined);
});

test("remote Docker contexts require permission but the local Docker context is allowed", () => {
	const context = { worktreeRoot: process.cwd(), cwd: process.cwd(), dockerTargetOverridePresent: false };
	assert.equal(riskyCommandReason("docker ps", context), undefined);
	assert.equal(riskyCommandReason("docker --context=desktop-linux ps", context), undefined);
	assert.match(riskyCommandReason("docker --context=production ps", context), /remote Docker/);
	assert.match(riskyCommandReason("echo done; docker --context=production ps", context), /remote Docker/);
	assert.equal(riskyCommandReason("echo done; docker --context=desktop-linux ps", context), undefined);
	assert.equal(riskyCommandReason("docker --context=desktop-linux ps > docker.log", context), undefined);
	assert.match(riskyCommandReason("docker --host=tcp://192.168.10.5:2376 ps", context), /remote Docker/);
});

test("local Docker registry operations ask about private or authenticated registry access", () => {
	const local = {
		worktreeRoot: process.cwd(),
		cwd: process.cwd(),
		dockerTargetOverridePresent: false,
		dockerAuthConfigPresent: false,
	};
	assert.equal(riskyCommandReason("docker pull alpine", local), undefined);
	assert.match(riskyCommandReason("docker pull registry.internal/team/app", local), /container registry/);
	assert.match(
		riskyCommandReason("docker compose -f compose.yml up", { ...local, dockerAuthConfigPresent: true }),
		/container registry/,
	);
	assert.equal(riskyCommandReason("docker ps", { ...local, dockerAuthConfigPresent: true }), undefined);
});

test("Docker environment overrides make an implicit context ambiguous", () => {
	const base = { worktreeRoot: process.cwd(), cwd: process.cwd(), dockerTargetOverridePresent: true };
	assert.match(riskyCommandReason("docker ps", base), /remote Docker/);
	assert.equal(riskyCommandReason("docker --context=desktop-linux ps", base), undefined);
});

test("remote or implicit database and cloud commands require permission", () => {
	for (const command of [
		"psql -h db.internal -d app",
		"psql -d app",
		"mysql -h db.example.com app",
		"aws sts get-caller-identity",
		"gcloud projects list",
		"az account show",
	]) {
		assert.match(riskyCommandReason(command), /remote (?:database|cloud) service/, command);
	}
	assert.match(riskyCommandReason("terraform output"), /remote infrastructure state/);
	assert.equal(riskyCommandReason("terraform validate"), undefined);
});

test("syncing is allowed only in the active task worktree", () => {
	const worktree = process.cwd();
	for (const command of ["git fetch origin", "git pull --ff-only", "git pull --rebase", "git rebase origin/main"]) {
		assert.equal(riskyCommandReason(command, { worktreeRoot: worktree, cwd: worktree }), undefined, command);
	}
	assert.match(
		riskyCommandReason("git -C ../other-repo pull --ff-only", { worktreeRoot: worktree, cwd: worktree }),
		/another repository/,
	);
	assert.match(
		riskyCommandReason("git pull --ff-only", { worktreeRoot: worktree, cwd: "../other-repo" }),
		/another repository/,
	);
});

test("ordinary deletions stay inside the worktree and destructive Git commands stay gated", () => {
	const worktree = process.cwd();
	assert.equal(riskyCommandReason("rm -f src/old-file.ts", { worktreeRoot: worktree, cwd: worktree }), undefined);
	assert.equal(riskyCommandReason("rm -rf src/generated", { worktreeRoot: worktree, cwd: worktree }), undefined);
	assert.equal(riskyCommandReason("git rm src/old-file.ts", { worktreeRoot: worktree, cwd: worktree }), undefined);
	assert.match(riskyCommandReason("echo done; rm src/old-file.ts", { worktreeRoot: worktree, cwd: worktree }), /compound command/);
	assert.equal(riskyCommandReason("rmdir src/old-dir", { worktreeRoot: worktree, cwd: worktree }), undefined);
	assert.equal(riskyCommandReason("unlink src/old-file.ts", { worktreeRoot: worktree, cwd: worktree }), undefined);
	assert.match(riskyCommandReason("rmdir ../outside-dir", { worktreeRoot: worktree, cwd: worktree }), /outside the task worktree/);
	assert.match(riskyCommandReason("rm -rf .", { worktreeRoot: worktree, cwd: worktree }), /whole task worktree/);
	assert.match(riskyCommandReason("rm -f ../outside.txt", { worktreeRoot: worktree, cwd: worktree }), /outside the task worktree/);
	assert.match(riskyCommandReason("find . -delete", { worktreeRoot: worktree, cwd: worktree }), /bulk deletion/);
	assert.match(riskyCommandReason("git reset --hard"), /destructive Git/);
	assert.match(riskyCommandReason("git merge feature"), /merging branches/);
	assert.match(riskyCommandReason("git stash clear"), /destructive Git/);
	assert.match(riskyCommandReason("git checkout --force main"), /destructive Git/);
	assert.match(riskyCommandReason("git restore src/app.ts"), /destructive Git/);
	assert.equal(riskyCommandReason("git restore --staged src/app.ts"), undefined);
	assert.match(riskyCommandReason("git restore --staged --worktree src/app.ts"), /destructive Git/);
});

test("other remote access and publication commands require permission", () => {
	for (const command of [
		"kubectl --context=production get pods",
		"git clone https://example.com/repo.git",
		"git ls-remote origin",
		"git push origin HEAD",
		"gh pr create --title change",
		"gh issue list",
		"ssh deploy@example.com",
		"npx --yes create-vite",
		"pnpm dlx create-vite",
		"uvx ruff",
		"cargo install cargo-audit",
		"go install example.com/tool@latest",
	]) {
		assert.ok(riskyCommandReason(command), command);
	}
});

test("delivery authorization is scoped to the requested operation", async () => {
	const handlers = new Map();
	safetyGate({ on: (event, handler) => handlers.set(event, handler) });
	const context = {
		cwd: process.cwd(),
		hasUI: true,
		ui: { confirm: async () => false },
	};

	handlers.get("input")({ text: "Push this branch." });
	assert.equal(
		await handlers.get("tool_call")({ toolName: "bash", input: { command: "git push origin HEAD" } }, context),
		undefined,
	);
	handlers.get("input")({ text: "Push this branch to origin." });
	assert.equal(
		await handlers.get("tool_call")({ toolName: "bash", input: { command: "git push origin HEAD" } }, context),
		undefined,
	);
	assert.equal(
		(await handlers.get("tool_call")({ toolName: "bash", input: { command: "gh pr create --title change" } }, context)).block,
		true,
	);

	handlers.get("input")({ text: "Publish this package." });
	assert.equal(
		(await handlers.get("tool_call")({ toolName: "bash", input: { command: "git push origin HEAD" } }, context)).block,
		true,
	);
});

test("PR authorization does not bypass a GitHub host or repository environment override", async () => {
	const handlers = new Map();
	safetyGate({ on: (event, handler) => handlers.set(event, handler) });
	const context = {
		cwd: process.cwd(),
		hasUI: true,
		ui: { confirm: async () => false },
	};

	delete process.env.GH_REPO;
	process.env.GH_REPO = "someone/else";
	try {
		handlers.get("input")({ text: "Create a PR for this change." });
		const result = await handlers.get("tool_call")(
			{ toolName: "bash", input: { command: "gh pr create --title change" } },
			context,
		);
		assert.equal(result.block, true);
	} finally {
		delete process.env.GH_REPO;
	}
});

test("PR authorization permits only the requested direct push, not compound remote actions", async () => {
	const handlers = new Map();
	safetyGate({ on: (event, handler) => handlers.set(event, handler) });
	const confirmCalls = [];
	const context = {
		cwd: process.cwd(),
		hasUI: true,
		ui: {
			confirm: async (...args) => {
				confirmCalls.push(args);
				return false;
			},
		},
	};

	handlers.get("input")({ text: "Create a PR for this change." });
	const authorizedPush = await handlers.get("tool_call")(
		{ toolName: "bash", input: { command: "git push origin HEAD" } },
		context,
	);
	assert.equal(authorizedPush, undefined);

	const mixedCommand = await handlers.get("tool_call")(
		{ toolName: "bash", input: { command: "git push origin HEAD && aws s3 ls" } },
		context,
	);
	assert.equal(confirmCalls.length, 1);
	assert.equal(mixedCommand.block, true);

	handlers.get("input")({ text: "After review, create a PR for this change." });
	const unanchoredDeliveryRequest = await handlers.get("tool_call")(
		{ toolName: "bash", input: { command: "git push origin HEAD" } },
		context,
	);
	assert.equal(unanchoredDeliveryRequest.block, true);

	handlers.get("input")({ text: "We might create a PR later." });
	const tentativePush = await handlers.get("tool_call")(
		{ toolName: "bash", input: { command: "git push origin HEAD" } },
		context,
	);
	assert.equal(tentativePush.block, true);

	handlers.get("input")({ text: "Create a PR for this change." });
	for (const command of [
		"git push --mirror origin",
		"git push --all origin",
		"git push --tags origin",
		"git push origin another-branch",
		"git push personal HEAD",
		"gh pr create --repo someone/else",
		"gh pr create -R someone/else",
		"gh pr create -Rsomeone/else",
		"gh pr create --head someone:branch",
		"gh pr create -Hsomeone:branch",
		"gh pr create -Bmain",
	]) {
		const blockedPush = await handlers.get("tool_call")({ toolName: "bash", input: { command } }, context);
		assert.equal(blockedPush.block, true, command);
	}

	for (const text of [
		"Push the release tag v1.2.3.",
		"Push all branches.",
		"Push this branch to upstream.",
		"Push branch pi-agent-autonomy.",
		"Push main to origin.",
		"Push this branch to origin/main.",
	]) {
		handlers.get("input")({ text });
		const blocked = await handlers.get("tool_call")(
			{ toolName: "bash", input: { command: "git push origin HEAD" } },
			context,
		);
		assert.equal(blocked.block, true, text);
	}

	for (const text of [
		"Create a PR from branch feature.",
		"Create a PR against main.",
		"Create a PR in someone/else.",
	]) {
		handlers.get("input")({ text });
		const blocked = await handlers.get("tool_call")(
			{ toolName: "bash", input: { command: "gh pr create --title change" } },
			context,
		);
		assert.equal(blocked.block, true, text);
	}

	for (const text of [
		"'Create a PR for this change.'",
		"Create a local branch, no PR.",
		"I saw someone write: please push this branch.",
		"Create a PR, but don't create it.",
		"Create a PR if the checks pass.",
		"Create a PR once the checks pass.",
		"Create a PR, maybe later.",
	]) {
		handlers.get("input")({ text });
		const blocked = await handlers.get("tool_call")(
			{ toolName: "bash", input: { command: "git push origin HEAD" } },
			context,
		);
		assert.equal(blocked.block, true, text);
	}
});
