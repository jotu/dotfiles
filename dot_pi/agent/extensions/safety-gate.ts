// Best-effort safety gate for Pi tool calls.
//
// Three tiers, checked in order:
//   1. block   — credential/secret access. Never promptable; an injected instruction
//                cannot talk the gate into it. Emits a user notification.
//   2. confirm — externally visible or destructive actions (push, PR, publish, sudo,
//                rm -rf, cloud/k8s/db, remote shells, uploads). Asks in TUI/RPC;
//                hard-blocks when no UI is available (print/JSON mode, subagents).
//   3. allow   — everything else, including compound shell commands and reads anywhere.
//
// Plus one scope rule: writes outside the workspace (file tools, or simple shell
// redirects/cp/mv/tee/mkdir/touch) ask. Reads never do.
//
// This is not a security boundary: shell indirection and other processes bypass it.
// Hard isolation needs a container or VM.

import { lstatSync, readlinkSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type ToolInput = Record<string, unknown>;

export type SafetyCategory = "file_scope" | "credential" | "destructive_action" | "remote_access" | "delivery";

export type SafetyDecision =
	| { action: "allow" }
	| { action: "confirm"; category: SafetyCategory; reason: string; promptDetail: string }
	| { action: "block"; category: SafetyCategory; reason: string; needsAttention: boolean };

type ClassificationContext = { cwd: string; hasUI: boolean };

const home = homedir();

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const protectedRoots = [
	join(home, ".ssh"),
	join(home, ".aws"),
	join(home, ".kube"),
	join(home, ".gnupg"),
	join(home, ".password-store"),
	join(home, ".config", "gh"),
	join(home, ".config", "gh-personal"),
	join(home, ".config", "gh-work"),
	join(home, ".config", "op"),
	join(home, ".npmrc"),
	join(home, ".netrc"),
	join(home, ".docker", "config.json"),
	join(home, ".pi", "agent", "auth.json"),
	join(home, ".zsh_history"),
	join(home, ".bash_history"),
	join(home, ".python_history"),
	join(home, ".node_repl_history"),
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

// Canonicalize even when the leaf does not exist yet, following symlinks in the existing prefix.
function canonicalPath(candidate: string, visited = new Set<string>()): string | undefined {
	const absolute = resolve(candidate);
	if (visited.has(absolute)) return undefined;
	const nextVisited = new Set(visited).add(absolute);
	try {
		return realpathSync.native(absolute);
	} catch {
		try {
			if (lstatSync(absolute).isSymbolicLink()) {
				const target = readlinkSync(absolute);
				return canonicalPath(isAbsolute(target) ? target : resolve(dirname(absolute), target), nextVisited);
			}
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code !== "ENOENT" && code !== "ENOTDIR") return undefined;
		}
		const parent = dirname(absolute);
		if (parent === absolute) return undefined;
		const canonicalParent = canonicalPath(parent, nextVisited);
		return canonicalParent ? resolve(canonicalParent, basename(absolute)) : undefined;
	}
}

const canonicalProtectedRoots = protectedRoots.map((path) => canonicalPath(path)).filter((path): path is string => path !== undefined);

// Integration files that Herdr and TUIOS install and own. Agents may read them for review but never change them.
const toolOwnedFiles = [
	join(home, ".pi", "agent", "extensions", "herdr-agent-state.ts"),
	join(home, ".pi", "agent", "extensions", "tuios-agent-state.ts"),
];
const canonicalToolOwnedFiles = toolOwnedFiles.map((path) => canonicalPath(path)).filter((path): path is string => path !== undefined);

function isToolOwnedPath(inputPath: string, cwd: string): boolean {
	const canonical = canonicalPath(resolveInputPath(inputPath, cwd));
	return canonical !== undefined && canonicalToolOwnedFiles.includes(canonical);
}

function isSecretFileName(name: string): boolean {
	return name === ".env" || (name.startsWith(".env.") && name !== ".env.example");
}

export function protectedPathReason(inputPath: string, cwd: string): string | undefined {
	const candidate = resolveInputPath(inputPath, cwd);
	const canonical = canonicalPath(candidate);
	if (!canonical) return `unresolvable path: ${candidate}`;
	if (canonicalProtectedRoots.some((root) => isWithin(root, canonical))) return `protected path: ${canonical}`;
	if (isSecretFileName(basename(canonical))) return `secret-looking file: ${candidate}`;
	return undefined;
}

export function writeScopeReason(inputPath: string, cwd: string, worktreeRoot: string): string | undefined {
	const candidate = canonicalPath(resolveInputPath(inputPath, cwd));
	const root = canonicalPath(worktreeRoot);
	if (!candidate || !root) return "writing to an unresolvable file path";
	return isWithin(root, candidate) ? undefined : "writing files outside the task worktree";
}

// ---------------------------------------------------------------------------
// Tier 1: credential and secret access (block)
// ---------------------------------------------------------------------------

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const protectedNames = protectedRoots.map((path) => relative(home, path).split(sep).join("/"));
const protectedPathMention = new RegExp(`(?:^|[\\s"'\`/=:(])(?:${protectedNames.map(escapeRegExp).join("|")})(?=$|[\\s"'\`/)])`);
const secretFileMention = /(?:^|[\s"'`/=])\.env(?:\.(?!example(?:$|[\s"'`/]))[A-Za-z0-9_-]+)?(?=$|[\s"'`/])/;
// Match the integration file names anywhere (covering separators, globs, and braces), the extensions
// directory itself (for example `cd` into it), and wildcard paths inside it. Shell checks match by name,
// so a same-named file elsewhere is also treated as read-only in shell commands.
const toolOwnedMention = /(?:herdr|tuios)-agent-state|\.pi\/agent\/extensions(?:\/?(?=$|[\s"'`;&|<>)])|\/[^\s"'`;&|<>]*[*?[{])/;
// Commands that only read their operands when used without output redirection. Pagers such as `less`
// stay excluded because they can run shell commands.
const readOnlyCommands = new Set(["cat", "head", "tail", "wc", "diff", "ls", "stat", "file", "grep", "rg", "jq", "sha256sum", "shasum", "echo", "printf", "true"]);
const readOnlyGitCommands = new Set(["diff", "log", "show", "blame", "status", "grep"]);

const segments = (command: string) => command.split(/[;&|\n]+/).map((segment) => segment.trim());

function isReadOnlySegment(segment: string): boolean {
	if (segment === "") return true;
	const [name = "", subcommand = ""] = segment.split(/\s+/);
	const command = basename(name);
	// `rg --pre`/`--search-zip` and `git --output`/`-O` run programs or write files.
	if (command === "rg") return !/(?:^|\s)(?:--pre\b|--search-zip\b|-[A-Za-z]*z)/.test(segment);
	if (command === "git") return readOnlyGitCommands.has(subcommand) && !/(?:^|\s)(?:--output\b|--open-files-in-pager\b|-O)/.test(segment);
	return readOnlyCommands.has(command);
}

// Allow reading tool-owned integration files; block any shell command that could change them.
function toolOwnedCommandReason(command: string): string | undefined {
	if (!toolOwnedMention.test(command)) return undefined;
	const benign = command
		.replace(/\s\d?>\s*\/dev\/null\b/g, " ")
		.replace(/\s\d?>&\d\b/g, " ")
		.replace(/\$(?:HOME\b|\{HOME\})/g, "~");
	const readOnly = !/[>`$]|<\(/.test(benign) && segments(benign).every(isReadOnlySegment);
	return readOnly ? undefined : "modifying a tool-owned integration file (only read-only commands are allowed)";
}

function isEnvironmentDump(command: string): boolean {
	return segments(command).some(
		(segment) =>
			/^(?:\/usr\/bin\/)?env(?:\s+(?:-0|-i|--null|--ignore-environment))*$/.test(segment) ||
			/^printenv$/.test(segment) ||
			/^set$/.test(segment) ||
			/^export\s+-p$/.test(segment) ||
			/^(?:declare|typeset)\s+-p[xa]*$/.test(segment),
	);
}

export function sensitiveCommandReason(command: string): string | undefined {
	if (isEnvironmentDump(command)) return "dumping process environment variables";
	if (protectedPathMention.test(command)) return "direct access to protected credentials or keys";
	if (secretFileMention.test(command)) return "direct access to a secret-looking file";
	if (/\bkubectl\b[^;&|\n]*\bconfig\s+view\b[^;&|\n]*--raw\b/i.test(command)) return "reading raw Kubernetes credentials";
	if (/\bkubectl\b[^;&|\n]*\b(?:get|describe|edit|view)\b[^;&|\n]*\bsecrets?\b/i.test(command)) return "reading or displaying Kubernetes secrets";
	if (/\baws\b[^;&|\n]*\bconfigure\s+get\b[^;&|\n]*(?:secret|token|password|credential|access.?key|private.?key)/i.test(command)) return "reading cloud credentials";
	if (/\bsecurity\s+(?:find|find-generic-password|find-internet-password)\b/i.test(command)) return "reading a keychain credential";
	if (/\bmise\s+run(?:\s+--silent)?\s+(?:(?:osx:)?(?:get-secret|ogs)|(?:aws-vault:)?(?:refresh|avr))\b/i.test(command)) return "reading or exporting a credential through a Mise task";
	return undefined;
}

// ---------------------------------------------------------------------------
// Tier 2: externally visible or destructive actions (confirm)
// ---------------------------------------------------------------------------

type Rule = { pattern: RegExp; reason: string; category: SafetyCategory; unless?: (segment: string) => boolean };

const localKubeContext = /--(?:kube-)?context(?:=|\s+)["']?(?:kind-|k3d-|minikube\b|docker-desktop\b|rancher-desktop\b)/i;
const loopback = /(?:localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[?::1\]?)(?::\d+)?(?=[/\s"']|$)/i;
const lockfileInstall = /\b(?:npm\s+ci|(?:pnpm|bun)\s+install\s+--frozen-lockfile|yarn\s+install\s+--immutable|uv\s+sync\s+--frozen)\b/i;

const rules: Rule[] = [
	// delivery
	{ pattern: /\bgit\s+push\b/i, reason: "pushing to a remote Git repository", category: "delivery" },
	{
		pattern: /\bgh\s+(?:pr|issue|release|repo|gist|workflow|run|secret|variable|label|auth)\s+(?:create|merge|close|reopen|edit|comment|review|delete|upload|fork|rename|set|remove|run|rerun|cancel|dispatch|login|logout|refresh)\b/i,
		reason: "an externally visible GitHub change",
		category: "delivery",
	},
	{ pattern: /\bgh\s+api\b[^;&|\n]*(?:-X\s*|--method[= ]\s*)?(?:POST|PUT|PATCH|DELETE)\b|\bgh\s+api\b[^;&|\n]*\s(?:-f|-F|--field|--raw-field|--input)\b/i, reason: "an externally visible GitHub change", category: "delivery" },
	{ pattern: /\b(?:npm|pnpm|yarn)\s+publish\b|\bcargo\s+publish\b/i, reason: "publishing a package", category: "delivery" },
	{ pattern: /\bdocker\b[^;&|\n]*\s(?:push|login)\b|\bdocker\b[^;&|\n]*\s--push\b/i, reason: "publishing an image or authenticating with a registry", category: "delivery" },
	// destructive
	{ pattern: /\bsudo\b/i, reason: "elevated privileges", category: "destructive_action" },
	{ pattern: /\brm\s+(?:-[A-Za-z]*[rRf]|--recursive|--force)\b|\bfind\b[^;&|\n]*\s-delete\b/i, reason: "a recursive or forced deletion", category: "destructive_action" },
	{
		pattern: /\bgit\s+(?:reset\s+--hard|clean\b|checkout\s+(?:--|-f\b|--force)|restore\b(?![^;&|\n]*--staged)|branch\s+(?:-[dDmM]\b|--delete|--move)|stash\s+(?:drop|clear)|worktree\b|push\s+--force)/i,
		reason: "a destructive Git operation",
		category: "destructive_action",
	},
	{ pattern: /\bwt\s+(?:merge|remove|delete)\b|\bwt\s+step\s+push\b|\bwt\s+step\s+prune\b(?![^;&|\n]*--dry-run)/i, reason: "integrating, pruning, or removing Worktrunk worktrees", category: "destructive_action" },
	{ pattern: /\b(?:chmod|chown)\b/i, reason: "changing file permissions or ownership", category: "destructive_action" },
	{
		pattern: /\bdocker\b[^;&|\n]*\b(?:volume\s+(?:rm|prune)|(?:system|container|image)\s+prune|compose\s+down\b[^;&|\n]*(?:-v|--volumes)|rm\s[^;&|\n]*(?:-v|--volumes))\b/i,
		reason: "deleting local Docker data",
		category: "destructive_action",
	},
	{ pattern: /\b(?:kind\s+delete\s+cluster|minikube\s+delete|k3d\s+cluster\s+delete)\b/i, reason: "deleting a local Kubernetes cluster", category: "destructive_action" },
	{
		pattern: /\b(?:npm|pnpm|yarn|bun|pip3?|uv|brew|mise|cargo|go)\s+(?:install|add|remove|uninstall|update|upgrade|use)\b/i,
		reason: "changing installed tooling or dependencies",
		category: "destructive_action",
		unless: (segment) => lockfileInstall.test(segment),
	},
	{ pattern: /\b(?:npx|bunx|uvx|pipx\s+run|pnpm\s+dlx|yarn\s+dlx|bun\s+x|npm\s+(?:exec|x)|uv\s+tool\s+run)\b/i, reason: "running tools from an external package registry", category: "destructive_action" },
	// remote
	{ pattern: /\b(?:ssh|scp|sftp)\b|\brsync\b[^;&|\n]*\S+@\S+:/i, reason: "connecting to a remote server", category: "remote_access" },
	{ pattern: /\b(?:kubectl|helm|oc|k9s|flux|argocd|kargo|stern)\b/i, reason: "connecting to a Kubernetes control plane", category: "remote_access", unless: (segment) => localKubeContext.test(segment) },
	{ pattern: /\b(?:aws|aws-vault|gcloud|az)\b/i, reason: "accessing a remote cloud service", category: "remote_access", unless: (segment) => /--endpoint-url(?:=|\s+)["']?https?:\/\//i.test(segment) && loopback.test(segment) },
	{ pattern: /\bterraform\s+(?!fmt\b|validate\b|version\b|help\b|-help\b)\w/i, reason: "accessing or changing remote infrastructure state", category: "remote_access" },
	{
		pattern: /\b(?:psql|pg_dump|pg_restore|mysql|mysqladmin|mariadb|mongosh|mongodump|mongorestore|redis-cli|sqlcmd|sqlplus|cockroach|clickhouse-client)\b/i,
		reason: "accessing a remote database service",
		category: "remote_access",
		unless: (segment) => loopback.test(segment),
	},
	{ pattern: /\b(?:curl|wget)\b[^;&|\n]*\|\s*(?:sh|bash|zsh|fish)\b/i, reason: "executing downloaded content", category: "remote_access" },
	{
		pattern: /\b(?:curl|wget|http|xh)\b[^;&|\n]*(?:(?:-X\s*|--request[= ]\s*|--method[= ]\s*)(?:POST|PUT|PATCH|DELETE)\b|\s(?:--data(?:-raw|-binary|-urlencode)?|-d|--form|-F|--upload-file|-T|--post-data|--post-file|--body(?:-data|-file)?)(?=\s|=|$))/i,
		reason: "uploading data to a remote service",
		category: "remote_access",
	},
	{ pattern: /^\s*(?:http|xh)\s+(?:\S+\s+)*?(?:POST|PUT|PATCH|DELETE)\s+https?:\/\//i, reason: "uploading data to a remote service", category: "remote_access" },
];

// Risky-command rules are matched against the command with quoted literals and heredoc bodies
// removed, so a commit message or note that mentions `git push` is not treated as a push.
// Interpreter wrappers keep their quoted payload because it is executed.
function matchableCommand(command: string): string {
	if (/\b(?:ba|z|da|k)?sh\s+-l?c\b|\beval\b|\bxargs\b|\bsource\b/i.test(command)) return command;
	return command
		.replace(/<<-?\s*(["']?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g, " <<HEREDOC ")
		.replace(/'[^']*'/g, "''")
		.replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

export function riskyCommandReason(command: string): { reason: string; category: SafetyCategory } | undefined {
	const matchable = matchableCommand(command);
	for (const rule of rules) {
		if (!rule.pattern.test(matchable)) continue;
		if (rule.unless && segments(matchable).filter((segment) => rule.pattern.test(segment)).every(rule.unless)) continue;
		return { reason: rule.reason, category: rule.category };
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Write scope for simple shell commands
// ---------------------------------------------------------------------------

type ShellToken = { kind: "word" | "redirect"; value: string };

// Returns undefined for anything beyond one simple command (pipes, lists, substitution, newlines).
function parseSimpleShellTokens(command: string): ShellToken[] | undefined {
	const tokens: ShellToken[] = [];
	let word = "";
	let quote: "'" | '"' | undefined;
	const flush = () => {
		if (word) tokens.push({ kind: "word", value: word });
		word = "";
	};
	for (let index = 0; index < command.length; index++) {
		const character = command[index] ?? "";
		if (quote) {
			if (character === quote) quote = undefined;
			else if (character === "$" && quote === '"') return undefined;
			else word += character;
			continue;
		}
		if (character === "'" || character === '"') quote = character;
		else if (character === "\n" || character === "\r") return undefined;
		else if (/\s/.test(character)) flush();
		else if (character === ">" || (character === "&" && command[index + 1] === ">")) {
			flush();
			let operator = character === "&" ? "&>" : ">";
			if (character === "&") index++;
			const next = command[index + 1];
			if (next === ">" || next === "&" || next === "|") {
				operator += next;
				index++;
			}
			tokens.push({ kind: "redirect", value: operator });
		} else if (character === "<" || character === "\\" || character === "$" || character === "`" || ";&|()".includes(character)) return undefined;
		else word += character;
	}
	if (quote) return undefined;
	flush();
	return tokens;
}

const shellWriteCommands = new Set(["cp", "mv", "install", "mkdir", "touch", "tee", "ln", "truncate"]);

function shellWriteTargets(command: string): string[] | undefined {
	const tokens = parseSimpleShellTokens(command);
	if (!tokens) return undefined;
	const targets: string[] = [];
	const words: string[] = [];
	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		if (!token) continue;
		if (token.kind === "word") {
			words.push(token.value);
			continue;
		}
		const target = tokens[++index];
		if (target?.kind !== "word") return undefined;
		if (token.value === ">&" && /^(?:\d+|-)$/.test(target.value)) continue; // `2>&1`, `>&-`
		targets.push(target.value);
	}
	const name = basename(words[0] ?? "").toLowerCase();
	if (shellWriteCommands.has(name)) {
		const operands = words.slice(1).filter((word) => word !== "--" && !word.startsWith("-"));
		if (["cp", "mv", "ln", "install"].includes(name)) {
			if (operands.length >= 2) targets.push(operands.at(-1) ?? "");
		} else targets.push(...operands);
	}
	return targets.filter((target) => target && target !== "-" && !target.startsWith("/dev/"));
}

function shellWriteScopeReason(command: string, cwd: string, worktreeRoot: string): string | undefined {
	const targets = shellWriteTargets(command);
	if (!targets) return undefined;
	for (const target of targets) {
		if (/[{}*?]/.test(target) || (target.startsWith("~") && !target.startsWith("~/"))) continue;
		const reason = writeScopeReason(target, cwd, worktreeRoot);
		if (reason) return reason;
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

const credentialMaterial =
	/(?:^|\s)(?:--(?:user|username|password|cookie|netrc(?:-file)?|oauth2-bearer|bearer|auth|proxy-user|cert|key|session)(?:=|\s|$)|-[ubUK](?=\s|=))|\b(?:authorization|proxy-authorization|cookie|x-api-key|x-auth-token|api-key)\s*:|[a-z][a-z0-9+.-]*:\/\/[^/\s@]+@|(?:^|\s)[A-Za-z_][A-Za-z0-9_]*(?:TOKEN|API_?KEY|SECRET|PASSWORD|CREDENTIAL|AUTH|ACCESS_KEY|PRIVATE_KEY)[A-Za-z0-9_]*=|[?&][A-Za-z0-9_.-]*(?:token|api[_-]?key|secret|password|credential|auth|signature|jwt|key|sig)=/i;

function confirmationDetail(command: string, category: SafetyCategory, reason: string): string {
	if (credentialMaterial.test(command) || (category === "remote_access" && /uploading/.test(reason))) {
		return "Request details redacted to avoid exposing credentials or payloads.";
	}
	return command;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const fileTools = new Set(["read", "write", "edit", "ls", "grep", "find"]);
const fileWriteTools = new Set(["write", "edit"]);

function needsUI(context: ClassificationContext, category: SafetyCategory, reason: string, promptDetail: string): SafetyDecision {
	if (!context.hasUI) return { action: "block", category, reason, needsAttention: true };
	return { action: "confirm", category, reason, promptDetail };
}

export function classifyToolCall(toolName: string, input: ToolInput, context: ClassificationContext): SafetyDecision {
	if (fileTools.has(toolName)) {
		const inputPath = typeof input.path === "string" ? input.path : ".";
		if (protectedPathReason(inputPath, context.cwd)) {
			return { action: "block", category: "credential", reason: "accessing protected credential or secret material", needsAttention: false };
		}
		if (fileWriteTools.has(toolName)) {
			if (isToolOwnedPath(inputPath, context.cwd)) {
				return { action: "block", category: "file_scope", reason: "modifying a tool-owned integration file (only read-only commands are allowed)", needsAttention: false };
			}
			const scopeReason = writeScopeReason(inputPath, context.cwd, context.cwd);
			if (scopeReason) return needsUI(context, "file_scope", scopeReason, inputPath);
		}
		return { action: "allow" };
	}

	if (toolName !== "bash" && toolName !== "powershell") return { action: "allow" };

	const command = String(input.command ?? input.script ?? "");
	const commandCwd = typeof input.cwd === "string" ? resolveInputPath(input.cwd, context.cwd) : context.cwd;

	const sensitiveReason = sensitiveCommandReason(command);
	if (sensitiveReason) return { action: "block", category: "credential", reason: sensitiveReason, needsAttention: false };

	const toolOwnedReason = toolOwnedCommandReason(command);
	if (toolOwnedReason) return { action: "block", category: "file_scope", reason: toolOwnedReason, needsAttention: false };

	const risky = riskyCommandReason(command);
	if (risky) return needsUI(context, risky.category, risky.reason, confirmationDetail(command, risky.category, risky.reason));

	const scopeReason = shellWriteScopeReason(command, commandCwd, context.cwd);
	if (scopeReason) return needsUI(context, "file_scope", scopeReason, command);

	return { action: "allow" };
}

// ---------------------------------------------------------------------------
// Extension wiring
// ---------------------------------------------------------------------------

type SafetyGateEvent =
	| { phase: "approval_required" | "blocked"; category: SafetyCategory; reason: string }
	| { phase: "resolved"; category: SafetyCategory; reason: string; outcome: "approved" | "denied" };

export default function safetyGate(pi: ExtensionAPI): void {
	let nextBlockId = 0;
	const activeBlocks = new Set<number>();
	const headlessBlocks = new Set<number>();

	function emit(name: string, payload: unknown): void {
		try {
			pi.events?.emit(name, payload);
		} catch {
			// Observer failures must not change the gate decision.
		}
	}
	const emitDecision = (event: SafetyGateEvent) => emit("safety-gate:decision", event);

	function beginBlock(headless: boolean): number {
		const id = ++nextBlockId;
		if (activeBlocks.size === 0) emit("herdr:blocked", { active: true, label: "Safety gate needs attention" });
		activeBlocks.add(id);
		if (headless) headlessBlocks.add(id);
		return id;
	}
	function endBlock(id: number): void {
		headlessBlocks.delete(id);
		if (activeBlocks.delete(id) && activeBlocks.size === 0) emit("herdr:blocked", { active: false });
	}
	const clearHeadlessBlocks = () => {
		for (const id of [...headlessBlocks]) endBlock(id);
	};

	pi.on("input", clearHeadlessBlocks);
	pi.on("turn_start", clearHeadlessBlocks);
	pi.on("agent_end", clearHeadlessBlocks);
	pi.on("session_shutdown", () => {
		for (const id of [...activeBlocks]) endBlock(id);
	});

	pi.on("tool_call", async (event, ctx) => {
		const decision = classifyToolCall(event.toolName, event.input as ToolInput, { cwd: ctx.cwd, hasUI: ctx.hasUI });
		if (decision.action === "allow") return;

		if (decision.action === "block") {
			emitDecision({ phase: "blocked", category: decision.category, reason: decision.reason });
			if (decision.needsAttention) {
				beginBlock(true);
				return { block: true, reason: `Safety gate blocked ${decision.reason}; no interactive confirmation is available.` };
			}
			if (ctx.hasUI) {
				try {
					ctx.ui.notify(`Safety gate blocked ${decision.reason}.`, "warning");
				} catch {
					// Notification is informational only.
				}
			}
			return { block: true, reason: `Safety gate blocked ${decision.reason}.` };
		}

		emitDecision({ phase: "approval_required", category: decision.category, reason: decision.reason });
		const blockId = beginBlock(false);
		let allowed: boolean;
		try {
			allowed = await ctx.ui.confirm(`Allow ${decision.reason}?`, decision.promptDetail);
		} catch {
			emitDecision({ phase: "blocked", category: decision.category, reason: decision.reason });
			endBlock(blockId);
			return { block: true, reason: `Safety gate blocked ${decision.reason}; interactive confirmation failed.` };
		}
		emitDecision({ phase: "resolved", category: decision.category, reason: decision.reason, outcome: allowed ? "approved" : "denied" });
		endBlock(blockId);
		if (!allowed) return { block: true, reason: `Safety gate blocked ${decision.reason}.` };
	});
}
