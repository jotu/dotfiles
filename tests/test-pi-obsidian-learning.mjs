import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Pi and TypeBox are supplied by the host; stub those host APIs for offline tests.
const hostModules = {
	"@earendil-works/pi-coding-agent": "export const withFileMutationQueue = async (path, fn) => globalThis.__learningQueue ? globalThis.__learningQueue(path, fn) : fn();",
	typebox: "export const Type = { Object: x => x, String: x => x, Optional: x => x, Array: x => x };",
};
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier in hostModules) return { url: `data:text/javascript,${encodeURIComponent(hostModules[specifier])}`, shortCircuit: true };
		return nextResolve(specifier, context);
	},
});
const { default: obsidianLearning } = await import("../dot_pi/agent/extensions/obsidian-learning.ts");

const note = { title: "A concept", definition: "A definition", whyItMatters: "It matters" };

function setup(exec) {
	const handlers = new Map();
	let command;
	let tool;
	let prompt;
	let branch = [];
	let projection;
	const pi = {
		on: (event, handler) => handlers.set(event, handler),
		registerCommand: (_name, value) => { command = value; },
		registerTool: (value) => { tool = value; },
		sendUserMessage: (value) => { prompt = value; },
		exec: exec ?? (async (_program, args) => {
			if (args.includes("vault")) return { code: 0, stdout: "name\tbase\npath\t/tmp/vault", stderr: "" };
			return { code: 0, stdout: "{{TITLE}}", stderr: "" };
		}),
	};
	obsidianLearning(pi);
	return {
		command: (waitForIdle = async () => {}) => command.handler("", { waitForIdle }),
		event: async (name, value = {}) => handlers.get(name)?.(value, {}),
		start: async () => {
			await handlers.get("input")?.({ text: prompt, source: "extension" }, {});
			await handlers.get("before_agent_start")?.({ messageType: "user", prompt }, {});
			await handlers.get("message_start")?.({ message: { role: "user", content: [{ type: "text", text: prompt }] } }, {});
			branch = [{ type: "message", message: { role: "user", content: [{ type: "text", text: prompt }] } }];
		},
		replaceMessage: (text) => { branch = [{ type: "message", message: { role: "user", content: [{ type: "text", text }] } }]; },
		editContext: (text) => { projection = [{ role: "user", content: [{ type: "text", text }] }]; },
		save: (signal = new AbortController().signal) => tool.execute("call", note, signal, undefined, { sessionManager: { getBranch: () => branch, buildSessionProjection: () => ({ messages: projection ?? branch.map((entry) => entry.message) }) } }),
	};
}

test("/learn authorizes only its own started request", async () => {
	const session = setup();
	await session.command();
	await assert.rejects(session.save(), /No active \/learn/);
	await session.start();
	assert.match((await session.save()).content[0].text, /Saved atomic note/);
	await assert.rejects(session.save(), /No active \/learn/);
});

test("new user input revokes the active request before queued messages run", async () => {
	const session = setup();
	await session.command();
	await session.start();
	await session.event("input", { text: "another task", source: "interactive" });
	await assert.rejects(session.save(), /No active \/learn/);
});

test("a failed template read can be retried during the same request", async () => {
	let reads = 0;
	const session = setup(async (_program, args) => {
		if (args.includes("vault")) return { code: 0, stdout: "name\tbase\npath\t/tmp/vault", stderr: "" };
		if (args[0] === "read" && reads++ === 0) return { code: 1, stdout: "", stderr: "template unavailable" };
		return { code: 0, stdout: "{{TITLE}}", stderr: "" };
	});
	await session.command();
	await session.start();
	await assert.rejects(session.save(), /template unavailable/);
	assert.match((await session.save()).content[0].text, /Saved atomic note/);
});

test("concurrent saves reserve only one capture", async () => {
	let release;
	const waiting = new Promise((resolve) => { release = resolve; });
	let creates = 0;
	const session = setup(async (_program, args) => {
		if (args.includes("vault")) {
			await waiting;
			return { code: 0, stdout: "name\tbase\npath\t/tmp/vault", stderr: "" };
		}
		if (args[0] === "create") creates++;
		return { code: 0, stdout: "{{TITLE}}", stderr: "" };
	});
	await session.command();
	await session.start();
	const first = session.save();
	await assert.rejects(session.save(), /No active \/learn/);
	release();
	await first;
	assert.equal(creates, 1);
});

test("an unrelated or transformed prompt cannot activate a pending capture", async () => {
	const session = setup();
	await session.command();
	await session.event("before_agent_start", { messageType: "user", prompt: "other prompt" });
	await session.start();
	await assert.rejects(session.save(), /No active \/learn/);
});

test("a learning prompt replaced at message end cannot authorize a save", async () => {
	const session = setup();
	await session.command();
	await session.start();
	session.replaceMessage("a different task");
	await assert.rejects(session.save(), /No active \/learn/);
});

test("a learning prompt replaced by a context edit cannot authorize a save", async () => {
	const session = setup();
	await session.command();
	await session.start();
	session.editContext("a different task");
	await assert.rejects(session.save(), /No active \/learn/);
});

test("tree navigation and session shutdown revoke active captures", async () => {
	for (const event of ["session_tree", "session_shutdown"]) {
		const session = setup();
		await session.command();
		await session.start();
		await session.event(event);
		await assert.rejects(session.save(), /No active \/learn/);
	}
});

test("a cancelled save does not create a note or retain permission", async () => {
	let release;
	const waiting = new Promise((resolve) => { release = resolve; });
	let creates = 0;
	const session = setup(async (_program, args, options) => {
		if (args.includes("vault")) {
			assert.ok(options.signal);
			await waiting;
			return { code: 0, stdout: "name\tbase\npath\t/tmp/vault", stderr: "" };
		}
		if (args[0] === "create") creates++;
		return { code: 0, stdout: "{{TITLE}}", stderr: "" };
	});
	await session.command();
	await session.start();
	const controller = new AbortController();
	const saving = session.save(controller.signal);
	controller.abort();
	release();
	await assert.rejects(saving, /cancelled/);
	await assert.rejects(session.save(), /No active \/learn/);
	assert.equal(creates, 0);
});

test("an ambiguous creation failure consumes permission and asks for inspection", async () => {
	const session = setup(async (_program, args) => {
		if (args.includes("vault")) return { code: 0, stdout: "name\tbase\npath\t/tmp/vault", stderr: "" };
		if (args[0] === "create") return { code: 1, stdout: "", stderr: "timed out" };
		return { code: 0, stdout: "{{TITLE}}", stderr: "" };
	});
	await session.command();
	await session.start();
	await assert.rejects(session.save(), /check the vault before retrying/);
	await assert.rejects(session.save(), /No active \/learn/);
});

test("/learn requested during a run starts after that run settles", async () => {
	let release;
	const waiting = new Promise((resolve) => { release = resolve; });
	const session = setup();
	const command = session.command(() => waiting);
	await session.event("agent_settled");
	release();
	await command;
	await session.start();
	assert.match((await session.save()).content[0].text, /Saved atomic note/);
});

test("/learn waiting through another run's startup remains queued", async () => {
	let release;
	const waiting = new Promise((resolve) => { release = resolve; });
	const session = setup();
	const command = session.command(() => waiting);
	await session.event("before_agent_start", { messageType: "user", prompt: "earlier task" });
	await session.event("agent_settled", { aborted: false });
	release();
	await command;
	await session.start();
	assert.match((await session.save()).content[0].text, /Saved atomic note/);
});

test("a queued message delivered before idle does not discard /learn", async () => {
	let release;
	const waiting = new Promise((resolve) => { release = resolve; });
	const session = setup();
	const command = session.command(() => waiting);
	await session.event("message_start", { message: { role: "user", content: [{ type: "text", text: "queued earlier" }] } });
	await session.event("agent_settled", { aborted: false });
	release();
	await command;
	await session.start();
	assert.match((await session.save()).content[0].text, /Saved atomic note/);
});

test("aborting the preceding run cancels a waiting /learn command", async () => {
	let release;
	const waiting = new Promise((resolve) => { release = resolve; });
	const session = setup();
	const command = session.command(() => waiting);
	await session.event("agent_settled", { aborted: true });
	release();
	await command;
	await session.start();
	await assert.rejects(session.save(), /No active \/learn/);
});

test("revocation interrupts an in-flight vault lookup", async () => {
	let observedSignal;
	const session = setup(async (_program, _args, options) => {
		observedSignal = options.signal;
		return await new Promise((resolve) => observedSignal.addEventListener("abort", () => resolve({ code: 1, stderr: "cancelled", stdout: "" })));
	});
	await session.command();
	await session.start();
	const saving = session.save();
	await session.event("input", { text: "another task", source: "interactive" });
	assert.equal(observedSignal.aborted, true);
	await assert.rejects(saving, /cancelled/);
});

test("cancellation while waiting for the mutation queue returns promptly without creating a note", async () => {
	let release;
	let queueStarted;
	const waiting = new Promise((resolve) => { release = resolve; });
	const started = new Promise((resolve) => { queueStarted = resolve; });
	let creates = 0;
	globalThis.__learningQueue = async (_path, fn) => { queueStarted(); await waiting; return fn(); };
	try {
		const session = setup(async (_program, args) => {
			if (args.includes("vault")) return { code: 0, stdout: "name\tbase\npath\t/tmp/vault", stderr: "" };
			if (args[0] === "create") creates++;
			return { code: 0, stdout: "{{TITLE}}", stderr: "" };
		});
		await session.command();
		await session.start();
		const controller = new AbortController();
		const saving = session.save(controller.signal);
		await started;
		controller.abort();
		await assert.rejects(saving, /cancelled/);
		release();
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(creates, 0);
	} finally {
		release();
		delete globalThis.__learningQueue;
	}
});

test("new input interrupts in-flight creation and reports an uncertain outcome", async () => {
	let observedSignal;
	let started;
	const creating = new Promise((resolve) => { started = resolve; });
	const session = setup(async (_program, args, options) => {
		if (args.includes("vault")) return { code: 0, stdout: "name\tbase\npath\t/tmp/vault", stderr: "" };
		if (args[0] !== "create") return { code: 0, stdout: "{{TITLE}}", stderr: "" };
		observedSignal = options.signal;
		started();
		return await new Promise((resolve) => observedSignal.addEventListener("abort", () => resolve({ code: 0, killed: true, stderr: "", stdout: "" })));
	});
	await session.command();
	await session.start();
	const saving = session.save();
	await creating;
	await session.event("input", { text: "another task", source: "interactive" });
	assert.equal(observedSignal.aborted, true);
	await assert.rejects(saving, /check the vault before retrying/);
	await assert.rejects(session.save(), /No active \/learn/);
});

test("a killed creation reports an uncertain outcome even with exit code zero", async () => {
	const session = setup(async (_program, args) => {
		if (args.includes("vault")) return { code: 0, stdout: "name\tbase\npath\t/tmp/vault", stderr: "" };
		if (args[0] === "create") return { code: 0, killed: true, stdout: "", stderr: "" };
		return { code: 0, stdout: "{{TITLE}}", stderr: "" };
	});
	await session.command();
	await session.start();
	await assert.rejects(session.save(), /check the vault before retrying/);
	await assert.rejects(session.save(), /No active \/learn/);
});

test("shutdown while waiting for idle prevents a delayed capture", async () => {
	let release;
	const waiting = new Promise((resolve) => { release = resolve; });
	const session = setup();
	const command = session.command(() => waiting);
	await session.event("session_shutdown");
	release();
	await command;
	await session.start();
	await assert.rejects(session.save(), /No active \/learn/);
});

test("a settled /learn request cannot authorize a later save", async () => {
	const session = setup();
	await session.command();
	await session.start();
	await session.event("agent_settled");
	await assert.rejects(session.save(), /No active \/learn/);
});
