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
	join(home, ".config", "gh-personal"),
	join(home, ".config", "gh-work"),
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
	[/\b(?:rm|rmdir|unlink|trash)(?:\s|$)/i, "deleting files"],
	[/\bfind\b[^;\n]*\s-delete\b/i, "deleting files"],
	[/\bsudo\b/i, "elevated privileges"],
	[/\b(?:chmod|chown)\b/i, "changing file permissions or ownership"],
	[/\bgit\s+pull\b/i, "a remote Git operation that changes the checkout"],
	[/\bgit\s+(?:switch|checkout)\b/i, "switching branches"],
	[/\bgit\s+branch\s+(?:-+[dDcmCM]\b|--(?:delete|move|copy|create)\b|(?!-)[^;\n\s|&]+)/i, "creating, deleting, or moving branches"],
	[/\bgit\s+worktree\s+(?:add|remove|move|lock|unlock)\b/i, "changing Git worktrees"],
	[/\bgit\s+(?:reset\s+--hard|clean\b|checkout\s+--|restore\s+--)/i, "a destructive Git operation"],
	[/\b(?:npm|pnpm|yarn|bun|pip|uv|brew|mise)\s+(?:install|ci|add|remove|uninstall|update|upgrade)\b/i, "changing installed tooling or dependencies"],
	[/\b(?:kubectl|helm|k9s|oc|argocd|kargo|flux|stern)\b/i, "connecting to or inspecting a Kubernetes control plane"],
	[/\b(?:aws\s+eks\s+(?:get-token|update-kubeconfig|describe-cluster|list-clusters)|gcloud\s+container\s+clusters\s+(?:get-credentials|describe|list)|az\s+aks\s+(?:get-credentials|show|list))\b/i, "connecting to a Kubernetes control plane"],
	[/\b(?:git\s+push|gh\s+auth|gh\s+pr\s+(?:create|merge)|gh\s+issue\s+(?:comment|close)|npm\s+publish|docker\s+push)\b/i, "an externally visible operation"],
	[/\b(?:terraform)\b[^;\n]*(?:apply|destroy)\b/i, "an infrastructure change"],
	[/\bsecurity\s+(?:add|delete|set|remove)\b/i, "a credential or keychain change"],
];

function isNetworkWrite(command: string): boolean {
	return /\b(?:curl|wget)\b[^;\n]*(?:--request|-X)\s*(?:POST|PUT|PATCH|DELETE)\b|\b(?:curl|wget)\b[^;\n]*(?:--data(?:-raw|-binary)?|-d|--form|-F|--upload-file|-T)\b|\b(?:curl|wget)\b[^;\n]*\|\s*(?:sh|bash|zsh|fish)\b/i.test(command);
}

export function riskyCommandReason(command: string): string | undefined {
	if (isNetworkWrite(command)) return "uploading data or executing downloaded content";
	return riskyCommands.find(([pattern]) => pattern.test(command))?.[1];
}

function isExplicitDeliveryRequest(text: string): boolean {
	if (
		/[?]/.test(text) ||
		/^(?:can|could|should|would|may|might|shall|is|are|do)\b/i.test(text.trim()) ||
		/\b(?:maybe|perhaps|not sure|whether)\b/i.test(text)
	) {
		return false;
	}
	if (/\b(?:do not|don't|never|avoid|without)\b[^.!?]{0,30}\b(?:commit|push|publish|pull request|pr)\b/i.test(text)) {
		return false;
	}
	const action = /\b(?:commit|push|publish|create|open)\b/i.test(text);
	const target = /\b(?:commit|push|publish|pull request|pr)\b/i.test(text);
	return action && target;
}

function isAuthorizedDeliveryCommand(command: string): boolean {
	if (!/\bgit\s+push\b|\bgh\s+pr\s+create\b/i.test(command)) return false;
	return !/\b(?:gh\s+pr\s+merge|gh\s+issue\s+(?:comment|close)|gh\s+auth|kubectl|helm|k9s|oc|argocd|kargo|flux|stern|terraform|sudo|rm|rmdir|unlink|trash)(?:\s|\b)/i.test(command);
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
	if (/\bmise\s+run(?:\s+--silent)?\s+(?:(?:osx:)?(?:get-secret|ogs)|(?:aws-vault:)?(?:refresh|avr))\b/i.test(command)) {
		return "reading or exporting a credential through a Mise task";
	}
	return undefined;
}

function commandFromInput(input: ToolInput): string {
	return String(input.command ?? input.script ?? "");
}

export default function safetyGate(pi: ExtensionAPI): void {
	let deliveryBatchAuthorized = false;

	pi.on("input", (event) => {
		deliveryBatchAuthorized = isExplicitDeliveryRequest(event.text);
	});

	pi.on("agent_end", () => {
		deliveryBatchAuthorized = false;
	});

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
		if (deliveryBatchAuthorized && isAuthorizedDeliveryCommand(command)) return;

		if (!ctx.hasUI) {
			return { block: true, reason: `Safety gate blocked ${reason}; no interactive confirmation is available.` };
		}

		const allowed = await ctx.ui.confirm(`Allow ${reason}?`, command);
		if (!allowed) return { block: true, reason: `Safety gate blocked ${reason}.` };
	});
}
