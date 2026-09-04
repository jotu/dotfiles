import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type ToolInput = Record<string, unknown>;

const home = homedir();
const protectedRoots = [
	join(home, ".ssh"),
	join(home, ".aws"),
	join(home, ".kube"),
	join(home, ".config", "gh"),
	join(home, ".npmrc"),
	join(home, ".netrc"),
	join(home, ".docker", "config.json"),
	join(home, ".pi", "agent", "auth.json"),
	join(home, ".pi", "agent", "extensions", "herdr-agent-state.ts"),
];

function isWithin(root: string, candidate: string): boolean {
	const child = relative(root, candidate);
	return child === "" || (child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child));
}

function resolveInputPath(inputPath: string, cwd: string): string {
	const normalized = inputPath.replace(/^@/, "");
	const expanded = normalized === "~" ? home : normalized.startsWith("~/") ? join(home, normalized.slice(2)) : normalized;
	return resolve(cwd, expanded);
}

export function protectedPathReason(inputPath: string, cwd: string): string | undefined {
	const candidate = resolveInputPath(inputPath, cwd);
	const root = protectedRoots.find((path) => isWithin(path, candidate));
	if (root) return `protected path: ${candidate}`;

	const relativePath = relative(cwd, candidate);
	const parts = relativePath.split(sep);
	if (parts.includes(".git")) return `protected path: ${candidate}`;

	const name = basename(candidate);
	if (name === ".env" || (name.startsWith(".env.") && name !== ".env.example")) {
		return `secret-looking file: ${candidate}`;
	}
	if (/^(id_(?:rsa|ed25519)|.*\.(?:pem|key))$/i.test(name)) {
		return `private-key-looking file: ${candidate}`;
	}
	if (/^(?:credentials|secrets)\.(?:json|ya?ml|toml|env)$/i.test(name)) {
		return `credential-looking file: ${candidate}`;
	}
	return undefined;
}

// ponytail: regex checks miss shell indirection; use a VM for real isolation.
const riskyCommands: Array<[RegExp, string]> = [
	[/\brm(?:\s|$)/i, "deleting files"],
	[/\bsudo\b/i, "elevated privileges"],
	[/\b(?:chmod|chown)\b/i, "changing file permissions or ownership"],
	[/\bgit\s+(?:push|pull|fetch)\b/i, "a remote Git operation"],
	[/\bgit\s+(?:reset\s+--hard|clean\b|checkout\s+--|restore\s+--)/i, "a destructive Git operation"],
	[/\b(?:npm|pnpm|yarn|bun|pip|uv|brew|mise)\s+(?:install|ci|add|remove|uninstall|update|upgrade)\b/i, "changing installed tooling or dependencies"],
	[/\b(?:gh\s+auth|gh\s+pr\s+(?:create|merge)|gh\s+issue\s+(?:comment|close)|npm\s+publish|docker\s+push)\b/i, "an externally visible operation"],
	[/\b(?:kubectl|helm|terraform|aws|gcloud|az)\b[^;\n]*(?:apply|delete|destroy|deploy|patch|rollout|create)\b/i, "an infrastructure change"],
	[/\b(?:curl|wget)\b/i, "network access or a download"],
	[/\bsecurity\s+(?:add|delete|set|remove)\b/i, "a credential or keychain change"],
];

export function riskyCommandReason(command: string): string | undefined {
	return riskyCommands.find(([pattern]) => pattern.test(command))?.[1];
}

export function sensitiveCommandReason(command: string): string | undefined {
	const protectedCommandPaths = protectedRoots.flatMap((path) => [path, path.replace(home, "~")]);
	if (protectedCommandPaths.some((path) => command.includes(path))) {
		return "direct access to protected credentials or keys";
	}
	if (/(?:^|[\s"'`/])\.env(?:\.(?!example(?:$|[\s"'`/]))[A-Za-z0-9_-]+)?(?=$|[\s"'`/])/i.test(command)) {
		return "direct access to a secret-looking file";
	}
	if (/\bsecurity\s+(?:find|find-generic-password)\b/i.test(command)) {
		return "reading a keychain credential";
	}
	return undefined;
}

function commandFromInput(input: ToolInput): string {
	return String(input.command ?? input.script ?? "");
}

export default function safetyGate(pi: ExtensionAPI): void {
	pi.on("tool_call", async (event, ctx) => {
		const input = event.input as ToolInput;

		if (["read", "write", "edit"].includes(event.toolName) && typeof input.path === "string") {
			const reason = protectedPathReason(input.path, ctx.cwd);
			if (reason) return { block: true, reason: `Safety gate blocked ${reason}.` };
		}

		if (event.toolName !== "bash" && event.toolName !== "powershell") return;

		const command = commandFromInput(input);
		const sensitiveReason = sensitiveCommandReason(command);
		if (sensitiveReason) {
			return { block: true, reason: `Safety gate blocked ${sensitiveReason}.` };
		}

		const reason = riskyCommandReason(command);
		if (!reason) return;

		if (!ctx.hasUI) {
			return { block: true, reason: `Safety gate blocked ${reason}; no interactive confirmation is available.` };
		}

		const allowed = await ctx.ui.confirm(`Allow ${reason}?`, command);
		if (!allowed) return { block: true, reason: `Safety gate blocked ${reason}.` };
	});
}
