import { withFileMutationQueue, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { basename, isAbsolute, join, posix, resolve } from "node:path";

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

let captureRequested = false;

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

async function resolveVault(pi: ExtensionAPI): Promise<{ name: string; path: string }> {
	const configuredPath = process.env.OBSIDIAN_VAULT_PATH?.trim();
	const configuredName = process.env.OBSIDIAN_VAULT?.trim() || (configuredPath ? basename(configuredPath) : "base");
	const result = await pi.exec("obsidian", [`vault=${configuredName}`, "vault"]);
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

async function notePath(pi: ExtensionAPI, input: NoteInput): Promise<{ vault: string; path: string; relativePath: string }> {
	const vault = await resolveVault(pi);
	const relativePath = relativeNotePath(input.title);
	return { vault: vault.name, path: join(vault.path, relativePath), relativePath };
}

function toolResult(text: string, details: Record<string, unknown> = {}) {
	return { content: [{ type: "text" as const, text }], details };
}

export default function obsidianLearning(pi: ExtensionAPI): void {
	pi.registerCommand("learn", {
		description: "Extract one atomic learning note from the current investigation",
		handler: async (args, ctx) => {
			await ctx.waitForIdle();
			captureRequested = true;
			const focus = args.trim();
			pi.sendUserMessage(
				[
					"You are in explicit learning-capture mode.",
					focus ? `Focus on: ${focus}` : "Use the current investigation or conversation.",
					"Extract exactly one useful, self-contained concept as a short mini-essay.",
					"Do not write a broad conversation summary. If there are multiple concepts, choose the most central one.",
					"Use the save_atomic_note tool with a precise title, definition, why it matters, and a concrete example when available.",
					"Preserve genuine Obsidian links and sources from the conversation; never invent them.",
				].join("\n"),
			);
		},
	});

	pi.registerTool({
		name: "save_atomic_note",
		label: "Save Atomic Note",
		description: "Save one self-contained learning concept as an Obsidian Markdown note. Only use this after the user explicitly invokes /learn.",
		promptSnippet: "Save one atomic learning concept to the configured Obsidian vault",
		parameters: noteSchema,
		async execute(_toolCallId, params) {
			if (!captureRequested) throw new Error("No active /learn capture request.");
			captureRequested = false;

			const target = await notePath(pi, params);
			const templatePath = relativeTemplatePath();
			const templateResult = await pi.exec("obsidian", [
				"read",
				`vault=${target.vault}`,
				`path=${templatePath}`,
			]);
			if (templateResult.code !== 0) throw new Error(templateResult.stderr || `Obsidian could not read ${templatePath}.`);
			const content = renderNoteTemplate(templateResult.stdout, params);
			await withFileMutationQueue(target.path, async () => {
				const result = await pi.exec("obsidian", [
					"create",
					`vault=${target.vault}`,
					`path=${target.relativePath}`,
					`content=${content}`,
				]);
				if (result.code !== 0) throw new Error(result.stderr || `Obsidian could not create ${target.relativePath}.`);
			});
			return toolResult(`Saved atomic note: ${target.path}`, { path: target.path, title: cleanTitle(params.title) });
		},
	});
}
