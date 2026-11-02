// Best-effort safety gate for Pi tool calls.
//
//   block   — credential/secret access and edits to Herdr/TUIOS-owned files. Never promptable.
//   confirm — delivery, destructive, privileged, or remote commands, and writes outside the
//             repository's worktrees. Blocks instead when no UI can ask (print/JSON, subagents).
//   allow   — everything else, including reads anywhere.
//
// Not a security boundary: shell indirection and other processes bypass it. Hard isolation
// needs a container or VM.

import { execFileSync } from "node:child_process";
import { lstatSync, readlinkSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type ToolInput = Record<string, unknown>;
export type SafetyCategory = "file_scope" | "credential" | "destructive_action" | "remote_access" | "delivery";
export type SafetyDecision =
	| { action: "allow" }
	| { action: "confirm"; category: SafetyCategory; reason: string; promptDetail: string }
	| { action: "block"; category: SafetyCategory; reason: string; needsAttention: boolean };
type ClassificationContext = { cwd: string; hasUI: boolean };

const home = homedir();

// --- Paths -----------------------------------------------------------------

function resolveInputPath(inputPath: string, cwd: string): string {
	const path = inputPath.replace(/^@/, "");
	return resolve(cwd, path === "~" ? home : path.startsWith("~/") ? join(home, path.slice(2)) : path);
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

const canonicalAll = (paths: string[]) => paths.map((path) => canonicalPath(path)).filter((path): path is string => path !== undefined);
const canonicalInput = (inputPath: string, cwd: string) => canonicalPath(resolveInputPath(inputPath, cwd));

function isWithin(root: string, candidate: string): boolean {
	const child = relative(root, candidate);
	return child === "" || (child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child));
}

const secretNames = [".ssh", ".aws", ".kube", ".gnupg", ".password-store", ".config/gh", ".config/gh-personal", ".config/gh-work", ".config/op", ".npmrc", ".netrc", ".docker/config.json", ".pi/agent/auth.json", ".zsh_history", ".bash_history", ".python_history", ".node_repl_history"];
const secretRoots = canonicalAll(secretNames.map((name) => join(home, name)));
const isSecretFileName = (name: string) => name === ".env" || (name.startsWith(".env.") && name !== ".env.example");

function isSecretPath(inputPath: string, cwd: string): boolean {
	const path = canonicalInput(inputPath, cwd);
	return !path || secretRoots.some((root) => isWithin(root, path)) || isSecretFileName(basename(path));
}

// Herdr and TUIOS install and own these extensions: agents may read them, never change them.
const toolOwnedFiles = canonicalAll(["herdr", "tuios"].map((tool) => join(home, ".pi", "agent", "extensions", `${tool}-agent-state.ts`)));
const toolOwnedReason = "modifying a tool-owned integration file (only read-only commands are allowed)";

// Every worktree of the session's repository is writable, so a session in the primary checkout
// can work in its Worktrunk task worktrees. Outside Git, only the session directory is.
function worktreeRoots(cwd: string): string[] {
	try {
		const listing = execFileSync("git", ["-c", "core.fsmonitor=false", "-C", cwd, "worktree", "list", "--porcelain"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 });
		const roots = listing.split("\n\n").filter((entry) => !/^(?:bare|prunable\b)/m.test(entry)).flatMap((entry) => /^worktree (.+)$/m.exec(entry)?.[1] ?? []);
		if (roots.length > 0) return canonicalAll(roots);
	} catch {
		// Not a Git repository.
	}
	return canonicalAll([cwd]);
}

function isWritable(inputPath: string, cwd: string, sessionCwd: string): boolean {
	const path = canonicalInput(inputPath, cwd);
	if (!path) return false;
	const session = canonicalPath(sessionCwd);
	return (session !== undefined && isWithin(session, path)) || worktreeRoots(sessionCwd).some((root) => isWithin(root, path));
}

// --- Shell parsing ---------------------------------------------------------

// Quoted literals and heredoc bodies are data, so `git commit -m "no git push"` is not a push.
// Interpreter wrappers execute their quoted payload, so its quotes become command separators.
function matchableCommand(command: string): string {
	const data = command
		.replace(/<<-?\s*(["']?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g, " <<HEREDOC ")
		.replace(/'[^']*'/g, "''")
		.replace(/"(?:[^"\\]|\\.)*"/g, '""');
	return /\b(?:(?:ba|z|da|k)?sh\s+-l?c|eval|xargs|source)\b/i.test(data) ? command.replace(/["']/g, ";") : data;
}

// Each simple command, without leading shell keywords and variable assignments.
function commandSegments(command: string): string[] {
	return matchableCommand(command)
		.split(/&&|\|\||[;&|\n(){}`]|\$\(/)
		.map((segment) => segment.trim().replace(/^(?:(?:then|do|else|elif|if|while|until|time|!)\s+|[A-Za-z_]\w*=\S*\s+)+/, ""))
		.filter(Boolean);
}

// --- Tier 1: credentials and tool-owned files (block) ----------------------

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const secretMention = new RegExp(`(?:^|[\\s"'\`/=:(])(?:${secretNames.map(escapeRegExp).join("|")})(?=$|[\\s"'\`/)])`);
const secretFileMention = /(?:^|[\s"'`/=])\.env(?:\.(?!example(?:$|[\s"'`/]))[A-Za-z0-9_-]+)?(?=$|[\s"'`/])/;
const environmentDump = /^(?:(?:\/usr\/bin\/)?env(?:\s+(?:-0|-i|--null|--ignore-environment))*|printenv|set|export\s+-p|(?:declare|typeset)\s+-p[xa]*)$/;

const credentialCommands: [RegExp, string][] = [
	[secretMention, "direct access to protected credentials or keys"],
	[secretFileMention, "direct access to a secret-looking file"],
	[/\bkubectl\b[^;&|\n]*\bconfig\s+view\b[^;&|\n]*--raw\b/i, "reading raw Kubernetes credentials"],
	[/\bkubectl\b[^;&|\n]*\b(?:get|describe|edit|view)\b[^;&|\n]*\bsecrets?\b/i, "reading or displaying Kubernetes secrets"],
	[/\baws\b[^;&|\n]*\bconfigure\s+get\b[^;&|\n]*(?:secret|token|password|credential|access.?key|private.?key)/i, "reading cloud credentials"],
	[/\bsecurity\s+find(?:-generic-password|-internet-password)?\b/i, "reading a keychain credential"],
	[/\bmise\s+run(?:\s+--silent)?\s+(?:(?:osx:)?(?:get-secret|ogs)|(?:aws-vault:)?(?:refresh|avr))\b/i, "reading or exporting a credential through a Mise task"],
];

function credentialReason(command: string): string | undefined {
	if (command.split(/[;&|\n]+/).some((segment) => environmentDump.test(segment.trim()))) return "dumping process environment variables";
	return credentialCommands.find(([pattern]) => pattern.test(command))?.[1];
}

// The integration file names (including globs and braces, but not other extensions such as `.md`), the
// extensions directory, and wildcards inside it. Matching is by name, so same-named files elsewhere
// are read-only in shell commands too.
const toolOwnedMention = /(?:herdr|tuios)-agent-state(?!\.(?!t)\w)|\.pi\/agent\/extensions(?:\/?(?=$|[\s"'`;&|<>)])|\/[^\s"'`;&|<>]*[*?[{])/;
// Pagers such as `less` are excluded because they can run shell commands.
const readOnlyCommands = new Set(["cat", "head", "tail", "wc", "diff", "ls", "stat", "file", "grep", "rg", "jq", "find", "sort", "uniq", "cut", "sha256sum", "shasum", "echo", "printf", "true", "cd", "pwd"]);
const readOnlyGitCommands = new Set(["diff", "log", "show", "blame", "status", "grep"]);

function isReadOnly(segment: string): boolean {
	const [name = "", subcommand = ""] = segment.split(/\s+/);
	const command = basename(name);
	// These options run programs or write files.
	if (command === "rg") return !/\s(?:--pre\b|--search-zip\b|-[A-Za-z]*z)/.test(segment);
	if (command === "find") return !/\s-(?:delete|exec|execdir|ok|okdir|fprint\w*|fls)\b/.test(segment);
	if (command === "git") return readOnlyGitCommands.has(subcommand) && !/\s(?:--output\b|--open-files-in-pager\b|-O)/.test(segment);
	return readOnlyCommands.has(command);
}

function modifiesToolOwnedFile(command: string): boolean {
	if (!toolOwnedMention.test(command)) return false;
	const benign = command.replace(/\s\d?>\s*\/dev\/null\b|\s\d?>&\d\b/g, " ").replace(/\$(?:HOME\b|\{HOME\})/g, "~");
	return /[>`$]|<\(/.test(benign) || !commandSegments(benign).every(isReadOnly);
}

// --- Tier 2: delivery, destructive, and remote commands (confirm) ----------

// Rules match anywhere in a segment, so wrappers such as `timeout`, `command`, `env -u`, `/bin/rm`,
// or `op run --` cannot hide a command. Name lookups (`command -v`, `which`, `for x in`) and
// trailing `--help` are not invocations.
const lookupOnly = /^(?:command\s+-[vV]|type|which|whereis|hash)\b|^for\s+\w+\s+in\b|\s--help$/;

type ShellScope = { command: string; cwd: string; sessionCwd: string };
type Rule = { pattern: RegExp; reason: string; category: SafetyCategory; unless?: (segment: string, scope: ShellScope) => boolean; whole?: true };

const git = String.raw`\bgit(?:\s+-[Cc]\s+\S+)*\s+`;
const localKubeContext = /--(?:kube-)?context(?:=|\s+)(?:kind-|k3d-|minikube\b|docker-desktop\b|rancher-desktop\b)/i;
const loopback = /(?:localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[?::1\]?)(?::\d+)?(?=[/\s"']|$)/i;
const lockfileInstall = /\b(?:npm\s+ci|(?:pnpm|bun)\s+install\s+--frozen-lockfile|yarn\s+install\s+--immutable|uv\s+sync\s+--frozen)\b/i;
const recursiveDelete = /\brm\s(?:.*\s)?(?:-[A-Za-z]*[rRf]|--recursive|--force)\b/i;

// Recursive deletes of plain relative paths inside a writable worktree are routine. Substitutions,
// braces, `~`, globs, `..`, absolute paths, the worktree itself, `.git`, and directory changes after
// a leading literal `cd dir &&` (which sets the base directory) ask.
function isWorktreeDelete(segment: string, { command, cwd, sessionCwd }: ShellScope): boolean {
	const leadingCd = /^\s*cd\s+([\w@%+=:,./~-]+)\s*&&/.exec(command);
	const rest = command.slice(leadingCd?.[0].length ?? 0);
	if (/[$`{}()]/.test(rest) || /(?:^|[\s;&|])(?:cd|pushd|popd)\b/.test(rest)) return false;
	const base = leadingCd?.[1] ? resolveInputPath(leadingCd[1], cwd) : cwd;
	const operands = segment.slice(segment.search(/\brm\s/)).split(/\s+/).slice(1).filter((word) => !word.startsWith("-"));
	return (
		operands.length > 0 &&
		operands.every((operand) => {
			const path = normalize(operand);
			return /^[\w@%+=:,./-]+$/.test(operand) && !isAbsolute(path) && path !== "." && path !== ".." && !path.startsWith(`..${sep}`) && !/\/\.git(?:\/|$)/i.test(resolveInputPath(path, base)) && isWritable(path, base, sessionCwd);
		})
	);
}

const rules: Rule[] = [
	// delivery
	{ pattern: new RegExp(`${git}push\\b`, "i"), reason: "pushing to a remote Git repository", category: "delivery" },
	{
		pattern: /\bgh\s+(?:pr|issue|release|repo|gist|workflow|run|secret|variable|label|auth)\s+(?:create|merge|close|reopen|edit|comment|review|delete|upload|fork|rename|set|remove|run|rerun|cancel|dispatch|login|logout|refresh)\b/i,
		reason: "an externally visible GitHub change",
		category: "delivery",
	},
	{ pattern: /\bgh\s+api\b.*(?:(?:-X\s*|--method[= ]\s*|\b)(?:POST|PUT|PATCH|DELETE)\b|\s(?:-f|-F|--field|--raw-field|--input)\b)/i, reason: "an externally visible GitHub change", category: "delivery" },
	{ pattern: /\b(?:(?:yarn\s+)?npm|pnpm|yarn|cargo)\s+publish\b/i, reason: "publishing a package", category: "delivery" },
	{ pattern: /\bdocker\b.*\s(?:push|login|--push)\b/i, reason: "publishing an image or authenticating with a registry", category: "delivery" },
	// destructive
	{ pattern: /\bsudo\b/i, reason: "elevated privileges", category: "destructive_action" },
	{ pattern: recursiveDelete, reason: "a recursive or forced deletion", category: "destructive_action", unless: isWorktreeDelete },
	{ pattern: /\bfind\b.*\s-delete\b/i, reason: "a recursive or forced deletion", category: "destructive_action" },
	{
		pattern: new RegExp(`${git}(?:reset\\s+--hard|clean\\b|checkout\\s+(?:--|-f\\b|--force)|restore\\b(?!.*--staged)|branch\\s+(?:-[dDmM]\\b|--delete|--move)|stash\\s+(?:drop|clear)|worktree\\s+(?:add|move|remove|prune|repair)\\b)`, "i"),
		reason: "a destructive Git operation",
		category: "destructive_action",
	},
	{ pattern: /\bwt(?:\s+-C\s+\S+)*\s+(?:remove|delete|step\s+(?:push|prune(?!.*--dry-run)))\b/i, reason: "pruning or removing Worktrunk worktrees", category: "destructive_action" },
	{ pattern: /\b(?:chmod|chown)\b/i, reason: "changing file permissions or ownership", category: "destructive_action" },
	{
		pattern: /\bdocker\b.*\b(?:volume\s+(?:rm|prune)|(?:system|container|image)\s+prune|compose\s+down\b.*(?:-v|--volumes)|rm\s.*(?:-v|--volumes))\b/i,
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
	{ pattern: /\b(?:ssh|scp|sftp)\b|\brsync\b.*\S+@\S+:/i, reason: "connecting to a remote server", category: "remote_access" },
	{ pattern: /\b(?:kubectl|helm|oc|k9s|flux|argocd|kargo|stern)\b/i, reason: "connecting to a Kubernetes control plane", category: "remote_access", unless: (segment) => localKubeContext.test(segment) },
	{ pattern: /\b(?:aws|aws-vault|gcloud|az)\b/i, reason: "accessing a remote cloud service", category: "remote_access", unless: (segment) => /--endpoint-url(?:=|\s+)https?:\/\//i.test(segment) && loopback.test(segment) },
	{ pattern: /\bterraform\s+(?!fmt\b|validate\b|version\b|help\b|-help\b)\w/i, reason: "accessing or changing remote infrastructure state", category: "remote_access" },
	{
		pattern: /\b(?:psql|pg_dump|pg_restore|mysql|mysqladmin|mariadb|mongosh|mongodump|mongorestore|redis-cli|sqlcmd|sqlplus|cockroach|clickhouse-client)\b/i,
		reason: "accessing a remote database service",
		category: "remote_access",
		unless: (segment) => loopback.test(segment),
	},
	{ pattern: /\b(?:curl|wget)\b[^;&|\n]*\|\s*(?:sh|bash|zsh|fish)\b/i, reason: "executing downloaded content", category: "remote_access", whole: true },
	{
		pattern: /\b(?:curl|wget|http|xh)\b.*(?:(?:-X\s*|--request[= ]\s*|--method[= ]\s*)(?:POST|PUT|PATCH|DELETE)\b|\s(?:--data(?:-raw|-binary|-urlencode)?|-d|--form|-F|--upload-file|-T|--post-data|--post-file|--body(?:-data|-file)?)(?=\s|=|$))/i,
		reason: "uploading data to a remote service",
		category: "remote_access",
	},
	{ pattern: /\b(?:http|xh)\s+(?:\S+\s+)*?(?:POST|PUT|PATCH|DELETE)\s+https?:\/\//i, reason: "uploading data to a remote service", category: "remote_access" },
];

function riskyRule(scope: ShellScope): Rule | undefined {
	const whole = matchableCommand(scope.command);
	const segments = commandSegments(scope.command).filter((segment) => !lookupOnly.test(segment));
	return rules.find((rule) =>
		rule.whole ? rule.pattern.test(whole) : segments.some((segment) => rule.pattern.test(segment) && !rule.unless?.(segment, scope)),
	);
}

// --- Write scope for simple shell commands ---------------------------------

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
		} else if ("<\\$`;&|()".includes(character)) return undefined;
		else word += character;
	}
	if (quote) return undefined;
	flush();
	return tokens;
}

const shellWriteCommands = new Set(["cp", "mv", "install", "mkdir", "touch", "tee", "ln", "truncate"]);

function shellWriteTargets(command: string): string[] {
	const tokens = parseSimpleShellTokens(command);
	if (!tokens) return [];
	const targets: string[] = [];
	const words: string[] = [];
	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		if (token?.kind === "word") {
			words.push(token.value);
			continue;
		}
		const target = tokens[++index];
		if (target?.kind !== "word") return [];
		if (token?.value === ">&" && /^(?:\d+|-)$/.test(target.value)) continue; // `2>&1`, `>&-`
		targets.push(target.value);
	}
	const name = basename(words[0] ?? "").toLowerCase();
	if (shellWriteCommands.has(name)) {
		const operands = words.slice(1).filter((word) => word !== "--" && !word.startsWith("-"));
		if (["cp", "mv", "ln", "install"].includes(name)) targets.push(...operands.slice(1).slice(-1));
		else targets.push(...operands);
	}
	// Globs, braces, and `~user` paths are not resolvable here.
	return targets.filter((target) => target && target !== "-" && !target.startsWith("/dev/") && !/[{}*?]/.test(target) && !/^~[^/]/.test(target));
}

// --- Classification --------------------------------------------------------

const credentialMaterial =
	/(?:^|\s)(?:--(?:user|username|password|cookie|netrc(?:-file)?|oauth2-bearer|bearer|auth|proxy-user|cert|key|session)(?:=|\s|$)|-[ubUK](?=\s|=))|\b(?:authorization|proxy-authorization|cookie|x-api-key|x-auth-token|api-key)\s*:|[a-z][a-z0-9+.-]*:\/\/[^/\s@]+@|(?:^|\s)[A-Za-z_][A-Za-z0-9_]*(?:TOKEN|API_?KEY|SECRET|PASSWORD|CREDENTIAL|AUTH|ACCESS_KEY|PRIVATE_KEY)[A-Za-z0-9_]*=|[?&][A-Za-z0-9_.-]*(?:token|api[_-]?key|secret|password|credential|auth|signature|jwt|key|sig)=/i;

const redacted = (command: string, reason: string) =>
	credentialMaterial.test(command) || reason.startsWith("uploading") ? "Request details redacted to avoid exposing credentials or payloads." : command;

const fileTools = new Set(["read", "write", "edit", "ls", "grep", "find"]);
const outsideWorktrees = "writing files outside the repository's worktrees";

export function classifyToolCall(toolName: string, input: ToolInput, { cwd, hasUI }: ClassificationContext): SafetyDecision {
	const block = (category: SafetyCategory, reason: string): SafetyDecision => ({ action: "block", category, reason, needsAttention: false });
	const ask = (category: SafetyCategory, reason: string, promptDetail: string): SafetyDecision =>
		hasUI ? { action: "confirm", category, reason, promptDetail } : { action: "block", category, reason, needsAttention: true };

	if (fileTools.has(toolName)) {
		const path = typeof input.path === "string" ? input.path : ".";
		if (isSecretPath(path, cwd)) return block("credential", "accessing protected credential or secret material");
		if (toolName !== "write" && toolName !== "edit") return { action: "allow" };
		const target = canonicalInput(path, cwd);
		if (target && toolOwnedFiles.includes(target)) return block("file_scope", toolOwnedReason);
		return isWritable(path, cwd, cwd) ? { action: "allow" } : ask("file_scope", outsideWorktrees, path);
	}
	if (toolName !== "bash" && toolName !== "powershell") return { action: "allow" };

	const command = String(input.command ?? input.script ?? "");
	const commandCwd = typeof input.cwd === "string" ? resolveInputPath(input.cwd, cwd) : cwd;

	const credential = credentialReason(command);
	if (credential) return block("credential", credential);
	if (modifiesToolOwnedFile(command)) return block("file_scope", toolOwnedReason);
	const rule = riskyRule({ command, cwd: commandCwd, sessionCwd: cwd });
	if (rule) return ask(rule.category, rule.reason, redacted(command, rule.reason));
	if (shellWriteTargets(command).some((target) => !isWritable(target, commandCwd, cwd))) return ask("file_scope", outsideWorktrees, command);
	return { action: "allow" };
}

// --- Extension wiring ------------------------------------------------------

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
