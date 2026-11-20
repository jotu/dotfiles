import { withFileMutationQueue, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { basename, isAbsolute, join, posix, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const noteSchema = Type.Object({
	title: Type.String({ description: "A specific, concise concept title" }),
	definition: Type.String({ description: "The concept explained so the note stands alone" }),
	whyItMatters: Type.String({ description: "Why this concept is useful or important" }),
	example: Type.Optional(Type.String({ description: "A concrete example" })),
	relatedNotes: Type.Optional(Type.Array(Type.String({ description: "An Obsidian wikilink or note name" }))),
	sources: Type.Optional(Type.Array(Type.String({ description: "A source URL or citation" }))),
	tags: Type.Optional(Type.Array(Type.String({ description: "A short Obsidian tag without #" }))),
});

type NoteInput = {
	title: string;
	definition: string;
	whyItMatters: string;
	example?: string;
	relatedNotes?: string[];
	sources?: string[];
	tags?: string[];
};

function slugify(title: string): string {
	return (
		title
			.normalize("NFKD")
			.replace(/[^a-zA-Z0-9\s-]/g, "")
			.trim()
			.replace(/[\s-]+/g, "-")
			.toLowerCase() || `note-${Date.now()}`
	);
}

function cleanTitle(title: string): string {
	return title.replace(/[\r\n]+/g, " ").trim();
}

async function resolveVault(pi: ExtensionAPI, signal?: AbortSignal): Promise<{ name: string; path: string }> {
	const configuredPath = process.env.OBSIDIAN_VAULT_PATH?.trim();
	const configuredName = process.env.OBSIDIAN_VAULT?.trim() || (configuredPath ? basename(configuredPath) : "base");
	const result = await pi.exec("obsidian", [`vault=${configuredName}`, "vault"], { signal });
	if (result.code !== 0) throw new Error(result.stderr || `Obsidian vault not found: ${configuredName}`);

	const info = Object.fromEntries(
		result.stdout
			.split("\n")
			.map((line) => {
				const [key, ...valueParts] = line.split("\t");
				return [key?.trim(), valueParts.join("\t").trim()];
			})
			.filter(([key, value]) => key && value),
	);
	const vaultPath = info.path;
	if (!vaultPath) throw new Error(`Obsidian did not return a path for vault: ${configuredName}`);
	if (configuredPath && resolve(vaultPath) !== resolve(configuredPath)) {
		throw new Error(`Obsidian vault path mismatch for ${configuredName}: expected ${configuredPath}, got ${vaultPath}`);
	}
	return { name: info.name || configuredName, path: resolve(vaultPath) };
}

function relativeNotePath(title: string): string {
	const configuredDir = process.env.OBSIDIAN_ATOMIC_NOTES_DIR ?? "1 - Notes";
	if (isAbsolute(configuredDir) || configuredDir.split(/[\\/]/).includes("..")) {
		throw new Error("OBSIDIAN_ATOMIC_NOTES_DIR must be a relative directory inside the vault.");
	}
	return posix.join(configuredDir.replaceAll("\\", "/"), `${slugify(title)}.md`);
}

function relativeTemplatePath(): string {
	const configuredPath = process.env.OBSIDIAN_ATOMIC_NOTE_TEMPLATE ?? "5 - Templates/Atomic Note.md";
	if (isAbsolute(configuredPath) || configuredPath.split(/[\\/]/).includes("..")) {
		throw new Error("OBSIDIAN_ATOMIC_NOTE_TEMPLATE must be a relative path inside the vault.");
	}
	return configuredPath.replaceAll("\\", "/");
}

function asWikilink(value: string): string {
	const trimmed = value.trim();
	if (!trimmed || /^\[\[.*\]\]$/.test(trimmed) || /^https?:\/\//.test(trimmed)) return trimmed;
	return `[[${trimmed}]]`;
}

function renderNoteTemplate(template: string, input: NoteInput): string {
	const title = cleanTitle(input.title);
	const tags = [...new Set(["learning", "zettelkasten", ...(input.tags ?? [])]
		.map((tag) => tag.replace(/^#/, "").trim())
		.filter(Boolean))]
		.map((tag) => `#${tag}`)
		.join(" ");
	const example = input.example?.trim() ? `## Example\n${input.example.trim()}` : "";
	const connections = input.relatedNotes?.length
		? `## Connections\n${input.relatedNotes.map(asWikilink).filter(Boolean).join(" ")}`
		: "";
	const references = input.sources?.length ? input.sources.map((source) => `- ${asWikilink(source)}`).join("\n") : "";
	const created = new Date().toISOString().slice(0, 16).replace("T", " ");

	return template
		.replaceAll("{{CREATED}}", created)
		.replaceAll("{{TITLE}}", title)
		.replaceAll("{{TAGS}}", tags)
		.replaceAll("{{DEFINITION}}", input.definition.trim())
		.replaceAll("{{WHY_IT_MATTERS}}", input.whyItMatters.trim())
		.replaceAll("{{EXAMPLE_SECTION}}", example)
		.replaceAll("{{CONNECTIONS_SECTION}}", connections)
		.replaceAll("{{REFERENCES}}", references);
}

async function notePath(pi: ExtensionAPI, input: NoteInput, signal?: AbortSignal): Promise<{ vault: string; path: string; relativePath: string }> {
	const vault = await resolveVault(pi, signal);
	const relativePath = relativeNotePath(input.title);
	return { vault: vault.name, path: join(vault.path, relativePath), relativePath };
}

function toolResult(text: string, details: Record<string, unknown> = {}) {
	return { content: [{ type: "text" as const, text }], details };
}

function userText(content: string | Array<{ type: string; text?: string }>): string {
	return typeof content === "string" ? content : content.filter((part) => part.type === "text").map((part) => part.text).join("");
}

async function withCancellableQueue(path: string, signal: AbortSignal, operation: () => Promise<void>): Promise<void> {
	let entered = false;
	let onAbort = () => {};
	const cancelled = new Promise<never>((_resolve, reject) => {
		onAbort = () => { if (!entered) reject(new Error("The /learn capture request was cancelled.")); };
		signal.addEventListener("abort", onAbort, { once: true });
		if (signal.aborted) onAbort();
	});
	try {
		await Promise.race([withFileMutationQueue(path, async () => {
			if (signal.aborted) throw new Error("The /learn capture request was cancelled.");
			entered = true;
			await operation();
		}), cancelled]);
	} finally {
		signal.removeEventListener("abort", onAbort);
	}
}

export default function obsidianLearning(pi: ExtensionAPI): void {
	let generation = 0;
	let capture: { prompt: string; phase: "pending" | "starting" | "active" | "saving" | "creating"; controller: AbortController } | undefined;
	const revoke = () => { generation++; capture?.controller.abort(); capture = undefined; };
	pi.on("input", (event) => {
		if (event.source !== "extension" || event.text !== capture?.prompt) revoke();
	});
	pi.on("before_agent_start", (event) => {
		if (!capture) return;
		if (capture.phase === "pending" && event.messageType === "user" && event.prompt === capture.prompt) capture.phase = "starting";
		else revoke();
	});
	pi.on("message_start", (event) => {
		if (event.message.role !== "user" || !capture) return;
		if (capture.phase === "starting" && userText(event.message.content) === capture.prompt) capture.phase = "active";
		else revoke();
	});
	pi.on("agent_settled", (event) => { if (capture || event.aborted) revoke(); });
	pi.on("session_tree", revoke);
	pi.on("session_shutdown", revoke);
	pi.registerCommand("learn", {
		description: "Extract one atomic learning note from the current investigation",
		handler: async (args, ctx) => {
			revoke();
			const requestGeneration = generation;
			await ctx.waitForIdle();
			if (generation !== requestGeneration) return;
			const focus = args.trim();
			const prompt = [
				"You are in explicit learning-capture mode.",
				focus ? `Focus on: ${focus}` : "Use the current investigation or conversation.",
				"Extract exactly one useful, self-contained concept as a short mini-essay.",
				"Do not write a broad conversation summary. If there are multiple concepts, choose the most central one.",
				"Use the save_atomic_note tool with a precise title, definition, why it matters, and a concrete example when available.",
				"Preserve genuine Obsidian links and sources from the conversation; never invent them.",
				`Capture request: ${randomUUID()}`,
			].join("\n");
			capture = { prompt, phase: "pending", controller: new AbortController() };
			pi.sendUserMessage(prompt);
		},
	});

	pi.registerTool({
		name: "save_atomic_note",
		label: "Save Atomic Note",
		description: "Save one self-contained learning concept as an Obsidian Markdown note. Only use this after the user explicitly invokes /learn.",
		promptSnippet: "Save one atomic learning concept to the configured Obsidian vault",
		parameters: noteSchema,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			if (capture?.phase !== "active") throw new Error("No active /learn capture request.");
			const lastUser = ctx.sessionManager.buildSessionProjection().messages.findLast((message) => message.role === "user");
			if (!lastUser || lastUser.role !== "user" || userText(lastUser.content) !== capture.prompt) {
				revoke();
				throw new Error("No active /learn capture request.");
			}
			const request = capture;
			request.phase = "saving";
			const operationSignal = signal ? AbortSignal.any([signal, request.controller.signal]) : request.controller.signal;
			const checkRequest = () => {
				if (operationSignal.aborted || capture !== request) throw new Error("The /learn capture request was cancelled.");
			};
			try {
				checkRequest();
				const target = await notePath(pi, params, operationSignal);
				checkRequest();
				const templatePath = relativeTemplatePath();
				const templateResult = await pi.exec("obsidian", [
					"read",
					`vault=${target.vault}`,
					`path=${templatePath}`,
				], { signal: operationSignal });
				checkRequest();
				if (templateResult.code !== 0) throw new Error(templateResult.stderr || `Obsidian could not read ${templatePath}.`);
				const content = renderNoteTemplate(templateResult.stdout, params);
				await withCancellableQueue(target.path, operationSignal, async () => {
					checkRequest();
					// Keep the controller until creation ends, but never allow another save.
					request.phase = "creating";
					try {
						const result = await pi.exec("obsidian", [
							"create",
							`vault=${target.vault}`,
							`path=${target.relativePath}`,
							`content=${content}`,
						], { signal: operationSignal });
						if (result.code !== 0 || result.killed || operationSignal.aborted) throw new Error(result.stderr || `Obsidian could not create ${target.relativePath}.`);
					} catch (error) {
						throw new Error(`Obsidian creation may have failed; check the vault before retrying. ${String(error)}`);
					}
				});
				if (capture === request) revoke();
				return toolResult(`Saved atomic note: ${target.path}`, { path: target.path, title: cleanTitle(params.title) });
			} catch (error) {
				if (capture === request && request.phase === "saving" && !operationSignal.aborted) request.phase = "active";
				else if (capture === request) revoke();
				throw error;
			}
		},
	});
}
