import { existsSync, lstatSync, readlinkSync, realpathSync } from "node:fs";
import { isIP } from "node:net";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type ToolInput = Record<string, unknown>;
type CommandContext = {
	worktreeRoot: string;
	cwd: string;
	authConfigPresent?: boolean;
	dockerAuthConfigPresent?: boolean;
	dockerTargetOverridePresent?: boolean;
};

function defaultCommandContext(): CommandContext {
	const cwd = process.cwd();
	return { worktreeRoot: cwd, cwd };
}

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
	join(home, ".pi", "agent", "extensions", "tuios-agent-state.ts"),
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

export function protectedPathReason(inputPath: string, cwd: string): string | undefined {
	const candidate = resolveInputPath(inputPath, cwd);
	const canonicalCandidate = canonicalPath(candidate);
	const canonicalCwd = canonicalPath(cwd);
	if (!canonicalCandidate || !canonicalCwd) return `unresolvable path: ${candidate}`;

	const root = protectedRoots
		.map((path) => canonicalPath(path))
		.find((path): path is string => path !== undefined && isWithin(path, canonicalCandidate));
	if (root) return `protected path: ${canonicalCandidate}`;

	const relativePath = relative(canonicalCwd, canonicalCandidate);
	const parts = relativePath.split(sep);
	if (parts.includes(".git")) return `protected path: ${canonicalCandidate}`;

	const name = basename(canonicalCandidate);
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

// Best-effort gate only: shell indirection can bypass these checks; hard isolation requires an OS-level security boundary.
const riskyCommands: Array<[RegExp, string]> = [
	[/\bsudo\b/i, "elevated privileges"],
	[/\b(?:chmod|chown)\b/i, "changing file permissions or ownership"],
	[/\bgit\s+(?:clone|ls-remote)\b/i, "connecting to a remote Git service"],
	[/\bgit\s+branch\s+(?:-+[dD]\b|--delete\b|--move\b|-m\b|-M\b)/i, "deleting or moving branches"],
	[/\bgit\s+worktree\b/i, "use Worktrunk (`wt`) to manage Git worktrees"],
	[/\bgit\s+merge\b/i, "merging branches into the task worktree"],
	[/\bgit\s+stash\s+(?:clear|drop)\b/i, "a destructive Git operation"],
	[/\bgit\s+(?:reset\s+--hard|clean\b|checkout\s+(?:--|-f\b|--force\b)|restore\b(?![^;\n]*--staged\b)|restore\b[^;\n]*--worktree\b|switch\b[^;\n]*--discard-changes\b)/i, "a destructive Git operation"],
	[/\b(?:npm\s+(?:exec|x)|npx|pnpm\s+dlx|yarn\s+dlx|bunx|bun\s+x|uvx|uv\s+tool\s+run|pipx\s+run|cargo\s+install|go\s+install)\b/i, "running or installing tools from an external package registry"],
	[/\b(?:npm|pnpm|yarn|bun|pip|uv|brew|mise)\s+(?:install|ci|add|remove|uninstall|update|upgrade)\b/i, "changing installed tooling or dependencies"],
	[/\buv\s+sync\b/i, "changing installed tooling or dependencies"],
	[/\b(?:git\s+push|gh\b|npm\s+publish|docker\s+push)\b/i, "an externally visible or authenticated remote operation"],
	[/\b(?:ssh|scp|sftp)\b/i, "connecting to a remote server"],
	[/\bsecurity\s+(?:add|delete|set|remove)\b/i, "a credential or keychain change"],
];

function hasShellComposition(command: string): boolean {
	return /[;&|`\n<>]/.test(command) || /\$\(|\$\{/.test(command);
}

function isDirectCommand(command: string): boolean {
	return !hasShellComposition(command) && !/^\s*(?:[A-Za-z_][A-Za-z0-9_]*\s*=|env(?:\s|$)|sudo(?:\s|$))/i.test(command);
}

function optionValues(command: string, options: string[]): string[] {
	const values: string[] = [];
	for (const option of options) {
		const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const pattern = new RegExp(`(?:^|\\s)${escaped}(?:=|\\s+)(?:"([^"]*)"|'([^']*)'|([^\\s]+))`, "gi");
		for (const match of command.matchAll(pattern)) {
			const value = match[1] ?? match[2] ?? match[3];
			if (value) values.push(value);
		}
	}
	return values;
}

const localKubeContext = /^(?:kind-[a-z0-9][a-z0-9._-]*|k3d-[a-z0-9][a-z0-9._-]*|minikube|docker-desktop|rancher-desktop)$/i;
const kubernetesCommand = /\b(?:kubectl|helm|k9s|oc|argocd|kargo|flux|stern)\b/i;

function isExplicitLocalKubernetesCommand(command: string): boolean {
	if (!isDirectCommand(command) || /(?:^|\s)--(?:kubeconfig|server|cluster|user)(?:=|\s|$)/i.test(command)) return false;
	const executable = command.trimStart().match(/^(kubectl|helm|oc|flux|stern|k9s)\b/i)?.[1]?.toLowerCase();
	if (!executable) return false;
	const contexts = optionValues(command, executable === "helm" ? ["--kube-context"] : ["--context"]);
	return contexts.length === 1 && localKubeContext.test(contexts[0] ?? "");
}

function isLoopbackHost(host: string): boolean {
	const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
	if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
	const ipVersion = isIP(normalized);
	return (ipVersion === 4 && normalized.startsWith("127.")) || (ipVersion === 6 && normalized === "::1");
}

function isLoopbackUrl(value: string): boolean {
	try {
		return isLoopbackHost(new URL(value).hostname);
	} catch {
		return false;
	}
}

const databaseCommand = /\b(?:psql|pg_dump|pg_restore|mysql|mysqladmin|mariadb|mongosh|mongodump|mongorestore|redis-cli|sqlcmd|sqlplus|cockroach|clickhouse-client)\b/i;
const databaseUrl = /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss):\/\/[^\s"'`]+/gi;

function isExplicitLocalServiceCommand(command: string): boolean {
	if (!isDirectCommand(command)) return false;
	if (/^aws\b/i.test(command.trimStart())) {
		const endpoints = optionValues(command, ["--endpoint-url"]);
		return endpoints.length === 1 && isLoopbackUrl(endpoints[0] ?? "");
	}
	if (!databaseCommand.test(command)) return false;
	const uris = command.match(databaseUrl) ?? [];
	const hosts = optionValues(command, ["--host", "-h"]);
	if (uris.length === 1 && hosts.length === 0) return isLoopbackUrl(uris[0] ?? "");
	if (uris.length === 0 && hosts.length === 1) return isLoopbackHost(hosts[0] ?? "");
	return false;
}

function isPrivateHost(host: string): boolean {
	const normalized = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
	if (isLoopbackHost(normalized)) return false;
	if (/\.(?:internal|local|cluster\.local|svc|corp|lan|home\.arpa|private)$/.test(normalized)) return true;
	const ipVersion = isIP(normalized);
	if (ipVersion === 6) {
		const address = normalized.split("%")[0] ?? normalized;
		return /^(?:fc|fd)/.test(address) || /^fe[89ab]/.test(address);
	}
	if (ipVersion !== 4) return false;
	const octets = normalized.split(".").map(Number);
	return (
		octets[0] === 10 ||
		(octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
		(octets[0] === 192 && octets[1] === 168) ||
		(octets[0] === 169 && octets[1] === 254) ||
		(octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
	);
}

function isAmbiguousHost(host: string): boolean {
	const normalized = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
	return isIP(normalized) === 0 && !isLoopbackHost(normalized) && !normalized.includes(".");
}

function isPrivateNetworkRequest(command: string): boolean {
	const urls = command.match(/[a-z][a-z0-9+.-]*:\/\/[^\s"'`<>;&|]+/gi) ?? [];
	return urls.some((value) => {
		try {
			const host = new URL(value).hostname;
			return isPrivateHost(host) || isAmbiguousHost(host);
		} catch {
			return false;
		}
	});
}

function isLockedProjectInstall(command: string): boolean {
	if (
		!isDirectCommand(command) ||
		/(?:^|\s)(?:-g|--global|--prefix|--dir|-C|--system|--target|--root|--user|--project|--userconfig|--registry|--index-url|--extra-index-url|--default-index|--index|--find-links|-f|--trusted-host)(?:\s|=|$)/i.test(command)
	) return false;
	return [
		/^npm\s+ci(?:\s|$)/i,
		/^pnpm\s+install\s+--frozen-lockfile(?:\s|$)/i,
		/^yarn\s+install\s+--immutable(?:\s|$)/i,
		/^bun\s+install\s+--frozen-lockfile(?:\s|$)/i,
		/^uv\s+sync\s+--frozen(?:\s|$)/i,
		/^pip\s+install\s+--require-hashes\b.*(?:-r|--requirement)(?:\s|=)/i,
	].some((pattern) => pattern.test(command.trim()));
}

export function fileScopeReason(inputPath: string, cwd: string, worktreeRoot: string): string | undefined {
	const candidate = canonicalPath(resolveInputPath(inputPath, cwd));
	const root = canonicalPath(worktreeRoot);
	if (!candidate || !root) return "using an unresolvable file path";
	if (isWithin(root, candidate)) return undefined;
	return "accessing or changing files outside the task worktree";
}

type ShellToken = { kind: "word" | "redirect"; value: string };

function parseSimpleShellTokens(command: string): ShellToken[] | undefined {
	const tokens: ShellToken[] = [];
	let word = "";
	let quote: "'" | '"' | undefined;
	const flushWord = () => {
		if (word) tokens.push({ kind: "word", value: word });
		word = "";
	};

	for (let index = 0; index < command.length; index++) {
		const character = command[index] ?? "";
		if (quote) {
			if (character === quote) quote = undefined;
			else if (character === "$" && quote === '"') return undefined;
			else if (character === "\\" && quote === '"') {
				const escaped = command[++index];
				if (escaped === undefined) return undefined;
				word += escaped;
			} else word += character;
			continue;
		}

		if (character === "'" || character === '"') quote = character;
		else if (character === "\n" || character === "\r") return undefined;
		else if (/\s/.test(character)) flushWord();
		else if (character === ">" || character === "<" || (character === "&" && command[index + 1] === ">")) {
			flushWord();
			let operator = character;
			const next = command[index + 1];
			if ((character === ">" || character === "<") && (next === character || next === "&" || (character === ">" && next === "|"))) {
				operator += next;
				index++;
				if (operator === "<<" && command[index + 1] === "<") {
					operator += "<";
					index++;
				}
			} else if (character === "&") {
				operator += ">";
				index++;
			}
			tokens.push({ kind: "redirect", value: operator });
		} else if (character === "\\" || character === "$" || character === "`" || ";&|()".includes(character)) return undefined;
		else word += character;
	}

	if (quote) return undefined;
	flushWord();
	return tokens;
}

const shellFileCommands = new Set(["cp", "mv", "install", "mkdir", "touch", "tee", "ln", "truncate"]);
const shellFileReadCommands = new Set(["cat", "head", "tail", "less", "more", "wc", "stat", "file", "sha256sum", "shasum", "md5", "od", "xxd", "strings", "base64", "nl", "ls", "cmp", "diff", "find", "grep", "rg"]);
const shellFileAccessCommands = new Set([...shellFileCommands, ...shellFileReadCommands]);
const possibleShellFileAccess = new RegExp(`\\b(?:${[...shellFileAccessCommands].join("|")})\\b|[<>]`, "i");

function shellFileScopeReason(command: string, context: CommandContext): string | undefined {
	const tokens = parseSimpleShellTokens(command);
	if (!tokens) return possibleShellFileAccess.test(command) ? "using an unresolved shell file operation" : undefined;

	const words: string[] = [];
	const paths: string[] = [];
	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		if (token?.kind !== "redirect") {
			if (token?.kind === "word") words.push(token.value);
			continue;
		}
		const target = tokens[++index];
		if (target?.kind !== "word") return "using an unresolved shell file operation";
		if (!["<&", ">&"].includes(token.value) || !/^(?:\d+|-)\s*$/.test(target.value)) paths.push(target.value);
	}

	const commandName = basename(words[0] ?? "").toLowerCase();
	if (
		(["env", "command"].includes(commandName) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0] ?? "")) &&
		words.slice(1).some((word) => shellFileAccessCommands.has(basename(word).toLowerCase()))
	) return "using an unresolved shell file operation";
	if (shellFileCommands.has(commandName) || shellFileReadCommands.has(commandName)) {
		const args = words.slice(1);
		if (args.some((argument) => ["-t", "--target-directory"].includes(argument) || argument.startsWith("--target-directory="))) {
			return "using an unresolved shell file operation";
		}
		const operands = args.filter((argument) => argument !== "--" && !argument.startsWith("-"));
		if (["cp", "mv", "ln"].includes(commandName) && operands.length < 2) return "using an unresolved shell file operation";
		if (commandName === "install" && operands.length < 1) return "using an unresolved shell file operation";
		if (commandName === "find") {
			if (args.some((argument) => ["-exec", "-execdir", "-ok", "-okdir"].includes(argument))) return "using an unresolved shell file operation";
			const roots: string[] = [];
			let index = args[0] === "--" ? 1 : 0;
			while (["-H", "-L", "-P"].includes(args[index] ?? "")) index++;
			while (index < args.length && !args[index]?.startsWith("-") && !["!", "("].includes(args[index] ?? "")) roots.push(args[index++] ?? "");
			paths.push(...(roots.length > 0 ? roots : ["."]));
		} else if (["grep", "rg"].includes(commandName)) {
			const searchPaths: string[] = [];
			let patternsAreExplicit = false;
			for (let index = 0; index < args.length; index++) {
				const argument = args[index] ?? "";
				if (["-e", "--regexp"].includes(argument)) {
					patternsAreExplicit = true;
					index++;
				} else if (["-f", "--file"].includes(argument) || (/^-[^-]*f/.test(argument) && argument !== "-f")) {
					const attachedFile = argument.startsWith("--") ? "" : argument.slice(argument.indexOf("f") + 1);
					const patternFile = attachedFile || args[++index];
					if (!patternFile) return "using an unresolved shell file operation";
					paths.push(patternFile);
				} else if (argument.startsWith("--regexp=")) patternsAreExplicit = true;
				else if (argument.startsWith("--file=")) paths.push(argument.slice("--file=".length));
				else if (argument.startsWith("-")) continue;
				else searchPaths.push(argument);
			}
			if (commandName === "rg" && args.includes("--files")) paths.push(...(searchPaths.length > 0 ? searchPaths : ["."]));
			else paths.push(...(patternsAreExplicit ? searchPaths : searchPaths.slice(1)));
		} else {
			paths.push(...operands.filter((path) => path !== "-"));
			if (commandName === "ls" && operands.length === 0) paths.push(".");
		}
	}

	for (const path of paths) {
		if (/[{}]/.test(path) || (path.startsWith("~") && !path.startsWith("~/"))) {
			return "using an unresolved shell file operation";
		}
		if (path === "/dev/null" || path === "/dev/stdout" || path === "/dev/stderr") continue;
		const reason = fileScopeReason(path, context.cwd, context.worktreeRoot);
		if (reason) return reason;
	}
	return undefined;
}

function deletionCommandReason(command: string, context: CommandContext): string | undefined {
	if (/\bfind\b[^\n]*\s-delete\b/i.test(command)) return "using a bulk deletion command";
	const gitRm = /^\s*git\s+rm(?:\s|$)/i.test(command);
	const plainRm = /^\s*rm(?:\s|$)/i.test(command);
	const scopedDelete = /^\s*(?:rmdir|unlink|trash)(?:\s|$)/i.test(command);
	const hasDeleteSegment = command.split(/[;&|\n]+/).some((segment) => /^\s*(?:(?:git\s+)?rm|rmdir|unlink|trash)(?:\s|$)/i.test(segment));
	if (!gitRm && !plainRm && !scopedDelete) return hasDeleteSegment ? "deleting files through a compound command" : undefined;
	if (!isDirectCommand(command)) return "deleting files through a compound command";

	const normalized = gitRm ? command.replace(/^\s*git\s+rm/i, "rm") : command;
	const words = normalized.trim().split(/\s+/).slice(1);
	const paths: string[] = [];
	let readPaths = false;
	for (const word of words) {
		if (!readPaths && word === "--") {
			readPaths = true;
			continue;
		}
		if (!readPaths && word.startsWith("-")) {
			if (/^-[rRfdivIpv]+$/.test(word) || ["--recursive", "--force", "--dir", "--parents", "--verbose", "--interactive", "--ignore-fail-on-non-empty", "--preserve-root", "--one-file-system", "--cached", "--ignore-unmatch"].includes(word)) continue;
			return "deleting files with an unresolved or broad target";
		}
		if (/[\s*?\[\]{}$`'"\\]/.test(word)) return "deleting files with an unresolved or broad target";
		paths.push(word);
	}
	if (paths.length === 0) return "deleting files without explicit targets";

	const root = canonicalPath(context.worktreeRoot);
	const cwd = canonicalPath(context.cwd);
	if (!root || !cwd || !isWithin(root, cwd)) return "deleting files outside the task worktree";
	for (const path of paths) {
		const candidate = canonicalPath(resolveInputPath(path, context.cwd));
		if (!candidate) return "deleting files with an unresolvable target";
		if (candidate === root) return "deleting the whole task worktree";
		if (!isWithin(root, candidate)) return "deleting files outside the task worktree";
		const protectedReason = protectedPathReason(path, context.cwd);
		if (protectedReason) return "deleting protected or secret-looking files";
	}
	return undefined;
}

function gitSyncSegment(command: string): string | undefined {
	return command.split(/[;&|\n]+/).find((segment) =>
		/^\s*git\b(?:(?:\s+-(?:C|c)\s+\S+)|(?:\s+--(?:git-dir|work-tree|config-env)(?:=|\s+)\S+))*\s+(?:fetch|pull|rebase)\b/i.test(segment),
	);
}

function isAllowedTaskGitSync(command: string, context: CommandContext): boolean {
	if (!isDirectCommand(command) || !/^\s*git\s+(?:fetch|pull|rebase)\b/i.test(command)) return false;
	if (/\b(?:--exec|--upload-pack|--receive-pack|--server-option)\b|(?:https?|ssh):\/\//i.test(command)) return false;
	const root = canonicalPath(context.worktreeRoot);
	const cwd = canonicalPath(context.cwd);
	return root !== undefined && cwd !== undefined && isWithin(root, cwd);
}

const localDockerContext = /^(?:default|desktop-linux|docker-desktop|rancher-desktop|colima|orbstack)$/i;

function isPotentialDockerRegistryRequest(command: string): boolean {
	return /^\s*docker\s+(?:(?:image|container|buildx)\s+)?(?:pull|build|run)\b/i.test(command) || /^\s*docker\s+compose\b[^;\n]*\b(?:pull|run|up|build)\b/i.test(command);
}

function hasPrivateDockerRegistryTarget(command: string): boolean {
	for (const match of command.matchAll(/(?:^|[\s"'`])(\[[^\]]+\]|[A-Za-z0-9.-]+)(?::\d+)?\/[A-Za-z0-9._/@:-]+/g)) {
		if (isPrivateHost(match[1] ?? "")) return true;
	}
	return false;
}

function hasPotentialDockerAuthConfig(command: string, context: CommandContext): boolean {
	if (context.dockerAuthConfigPresent !== undefined) return context.dockerAuthConfigPresent;
	return (
		existsSync(join(home, ".docker", "config.json")) ||
		Object.keys(process.env).some((name) => /^DOCKER_CONFIG$/i.test(name)) ||
		/(?:^|\s)--config(?:=|\s|$)/i.test(command)
	);
}

function isExplicitLocalDockerCommand(command: string, context: CommandContext): boolean {
	if (!isDirectCommand(command) || !/^\s*docker\b/i.test(command)) return false;
	const contexts = optionValues(command, ["--context"]);
	const hosts = optionValues(command, ["--host", "-H"]);
	if (contexts.length > 1 || hosts.length > 1 || (contexts.length > 0 && hosts.length > 0)) return false;
	if (contexts.length === 1) return localDockerContext.test(contexts[0] ?? "");
	if (hosts.length === 1) {
		const endpoint = hosts[0] ?? "";
		return /^(?:unix|npipe):\/\//i.test(endpoint) || isLoopbackUrl(endpoint);
	}
	const hasTargetOverride = context.dockerTargetOverridePresent ?? Object.keys(process.env).some((name) => /^DOCKER_(?:HOST|CONTEXT|CERT_PATH)$/i.test(name));
	return !hasTargetOverride;
}

function destructiveLocalInfrastructureReason(command: string): string | undefined {
	if (/\b(?:kind\s+delete\s+cluster|minikube\s+delete|k3d\s+cluster\s+delete)\b/i.test(command)) return "deleting a local Kubernetes cluster";
	if (/\bkubectl\b[^;\n]*\bdelete\b[^;\n]*\b(?:pvc|persistentvolumeclaim|pv|persistentvolume|namespace|namespaces|ns)\b/i.test(command)) {
		return "deleting persistent data or a whole Kubernetes namespace";
	}
	if (/\b(?:psql|mysql|mariadb|mongosh|sqlcmd|sqlplus)\b[^;\n]*\b(?:drop\s+(?:database|schema)|truncate(?:\s+table)?|delete\s+from)\b/i.test(command)) {
		return "destructively changing local database data";
	}
	if (/\bdocker\b[^;\n]*\b(?:volume\s+(?:rm|prune)|system\s+prune\b[^;\n]*(?:--volumes|-a\b)|rm\b[^;\n]*(?:-v|--volumes)|compose\s+down\b[^;\n]*(?:-v|--volumes))\b/i.test(command)) {
		return "deleting persistent data from local Docker";
	}
	if (/\bdocker\b[^;\n]*\b(?:system|container)\s+prune\b/i.test(command)) {
		return "performing destructive local Docker cleanup";
	}
	return undefined;
}

export function hasPotentialPackageAuthConfig(
	context: Pick<CommandContext, "cwd" | "worktreeRoot">,
	environment: Record<string, unknown> = process.env,
): boolean {
	const authEnvironment = /^(?:NPM_TOKEN|NODE_AUTH_TOKEN|YARN_NPM_AUTH_TOKEN|PNPM_AUTH_TOKEN|NPM_CONFIG_(?:USERCONFIG|REGISTRY|.*(?:AUTH|TOKEN|PASSWORD))|PNPM_REGISTRY|YARN_NPM_REGISTRY_SERVER|PIP_(?:INDEX_URL|EXTRA_INDEX_URL|CONFIG_FILE|TRUSTED_HOST)|UV_(?:INDEX_URL|EXTRA_INDEX_URL|DEFAULT_INDEX|CONFIG_FILE|INDEX_.*))$/i;
	if (Object.keys(environment).some((name) => authEnvironment.test(name))) return true;

	const projectDirectories = new Set([resolve(context.cwd), resolve(context.worktreeRoot)]);
	const projectConfigNames = [".npmrc", ".yarnrc", ".yarnrc.yml", "bunfig.toml", ".bunfig.toml", "pip.conf", "uv.toml"];
	const globalConfigPaths = [
		join(home, ".npmrc"),
		join(home, ".config", "pnpm", "rc"),
		join(home, ".bunfig.toml"),
		join(home, ".config", "bun", "bunfig.toml"),
		join(home, ".yarnrc"),
		join(home, ".yarnrc.yml"),
		join(home, ".netrc"),
		join(home, ".pip", "pip.conf"),
		join(home, ".config", "pip", "pip.conf"),
		join(home, ".config", "uv", "uv.toml"),
	];
	return (
		globalConfigPaths.some((path) => existsSync(path)) ||
		[...projectDirectories].some((directory) => projectConfigNames.some((name) => existsSync(join(directory, name))))
	);
}

function worktrunkCommandReason(command: string): string | undefined {
	const switchSegments = command.split(/[;&|\n]+/).filter((segment) => /\bwt\s+switch\b/i.test(segment));
	for (const segment of switchSegments) {
		const normalized = segment.trim();
		if (/^wt\s+switch\s+\^$/i.test(normalized)) continue;
		if (/^wt\s+switch\s+--create\b/i.test(normalized)) {
			if (/\s--base(?:=|\s+)pr:/i.test(normalized)) return "switching to a remote PR worktree";
			continue;
		}
		return "switching to another Worktrunk workspace or PR branch";
	}
	if (/\bwt\s+(?:merge|remove|delete)\b/i.test(command)) return "deleting or integrating Worktrunk worktrees and local branches";
	if (/\bwt\s+step\s+push\b/i.test(command)) return "advancing a local branch with Worktrunk";
	const pruneSegments = command.split(/[;&|\n]+/).filter((segment) => /\bwt\s+step\s+prune\b/i.test(segment));
	if (pruneSegments.some((segment) => !/(?:^|\s)--dry-run(?:\s|$)/i.test(segment))) {
		return "pruning Worktrunk worktrees or local branches";
	}
	return undefined;
}

function isLocalTerraformCommand(command: string): boolean {
	return isDirectCommand(command) && /^terraform\s+(?:fmt|validate|version|help)\b/i.test(command.trim());
}

function isEnvironmentDump(command: string): boolean {
	const match = command.match(
		/^\s*(?:(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S+))\s+)*(?:\/usr\/bin\/)?env\b(.*)$/i,
	);
	if (!match) return false;

	let argumentsText = match[1] ?? "";
	while (argumentsText.trim()) {
		argumentsText = argumentsText.trimStart();
		if (/^[|;&]/.test(argumentsText)) return true;
		if (/^--(?:\s+|$)/.test(argumentsText)) {
			const afterTerminator = argumentsText.slice(2).trim();
			return !afterTerminator || /^[|;&]/.test(afterTerminator);
		}

		const noValueOption = argumentsText.match(/^(?:--null|--debug|-v|-0|-i|--ignore-environment)(?:\s+|$)/i);
		if (noValueOption) {
			argumentsText = argumentsText.slice(noValueOption[0].length);
			continue;
		}
		const valueOption = argumentsText.match(/^(?:-u|--unset|-C|--chdir)\s+(?:"[^"]*"|'[^']*'|\S+)(?:\s+|$)/i);
		if (valueOption) {
			argumentsText = argumentsText.slice(valueOption[0].length);
			continue;
		}
		const assignedOption = argumentsText.match(/^(?:--unset|--chdir)=(?:"[^"]*"|'[^']*'|\S+)(?:\s+|$)/i);
		if (assignedOption) {
			argumentsText = argumentsText.slice(assignedOption[0].length);
			continue;
		}
		const assignment = argumentsText.match(/^[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S+)(?:\s+|$)/);
		if (assignment) {
			argumentsText = argumentsText.slice(assignment[0].length);
			continue;
		}
		return false;
	}
	return true;
}

const httpCommand = /\b(?:curl|wget|http|xh)\b/i;
const credentialOption = /(?:^|\s)(?:--(?:user|username|password|cookie|netrc(?:-file)?|load-cookies|oauth2-bearer|bearer|auth|auth-type|proxy-user|cert|key|config|session(?:-read-only)?|digest|negotiate)(?:=|\s|$)|-[ubUK](?=\s|=))/i;
const credentialHeader = /\b(?:authorization|proxy-authorization|cookie|x-api-key|x-auth-token|api-key)\s*:/i;
const credentialUrl = /[a-z][a-z0-9+.-]*:\/\/[^/\s@]+@/i;
const credentialEnvironmentAssignment = /(?:^|\s)[A-Za-z_][A-Za-z0-9_]*(?:TOKEN|API_?KEY|SECRET|PASSWORD|CREDENTIAL|AUTH|ACCESS_KEY|PRIVATE_KEY)[A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S+)/i;
const credentialQueryParameter = /[?&](?:[A-Za-z0-9_.-]*(?:token|api[_-]?key|secret|password|passwd|credential|auth|access[_-]?key|private[_-]?key|signature|jwt)[A-Za-z0-9_.-]*|key|sig|code|assertion)=[^&#\s"'`]*/i;

function isAuthenticatedRequest(command: string): boolean {
	const hasCredentialMaterial = credentialOption.test(command) || credentialHeader.test(command) || credentialUrl.test(command) || credentialEnvironmentAssignment.test(command) || credentialQueryParameter.test(command);
	const packageInstall = /\b(?:npm|pnpm|yarn|bun|pip|uv)\s+(?:ci|install|add|sync)\b/i.test(command);
	return hasCredentialMaterial && (httpCommand.test(command) || packageInstall);
}

function containsCredentialMaterial(command: string): boolean {
	return credentialOption.test(command) || credentialHeader.test(command) || credentialUrl.test(command) || credentialEnvironmentAssignment.test(command) || credentialQueryParameter.test(command);
}

function isNetworkWrite(command: string): boolean {
	return (
		/\b(?:curl|wget|http|xh)\b[^;\n]*(?:--request|--method)(?:=|\s+)(?:POST|PUT|PATCH|DELETE)\b/i.test(command) ||
		/\b(?:curl|http|xh)\b[^;\n]*-X\s*(?:POST|PUT|PATCH|DELETE)\b/i.test(command) ||
		/^\s*(?:http|xh)\s+(?:\S+\s+)*?(?:POST|PUT|PATCH|DELETE)\s+https?:\/\//i.test(command) ||
		/\b(?:curl|wget|http|xh)\b[^;\n]*(?:--data(?:-raw|-binary|-urlencode)?|--post-data|--body(?:-data|-file)?|--post-file|-d|--form|-F|--upload-file|-T)\b/i.test(command) ||
		/\b(?:curl|wget|http|xh)\b[^;\n]*\|\s*(?:sh|bash|zsh|fish)\b/i.test(command)
	);
}

function confirmationDetail(command: string): string {
	if (containsCredentialMaterial(command) || isNetworkWrite(command)) {
		return "Request details redacted to avoid exposing credentials or payloads.";
	}
	return command;
}

export function riskyCommandReason(command: string, context: CommandContext = defaultCommandContext()): string | undefined {
	const syncSegment = gitSyncSegment(command);
	if (syncSegment) {
		return isAllowedTaskGitSync(command, context) ? undefined : "synchronizing another repository or using an out-of-scope Git command";
	}

	const deletionReason = deletionCommandReason(command, context);
	if (deletionReason) return deletionReason;
	const fileReason = shellFileScopeReason(command, context);
	if (fileReason) return fileReason;
	const worktrunkReason = worktrunkCommandReason(command);
	if (worktrunkReason) return worktrunkReason;
	if (isNetworkWrite(command)) return "uploading data or executing downloaded content";
	if (isAuthenticatedRequest(command)) return "making an authenticated request";

	const dockerSegments = command.split(/[;&|\n]+/).filter((segment) => /^\s*docker\b/i.test(segment));
	for (const segment of dockerSegments) {
		const dockerCommand = parseSimpleShellTokens(segment)?.filter((token) => token.kind === "word").map((token) => token.value).join(" ") ?? segment;
		if (/^\s*docker\b[^;\n]*\s(?:login|push)\b|\s--push\b/i.test(dockerCommand)) {
			return "publishing an image or authenticating with a remote Docker service";
		}
		if (/^\s*docker\b[^;\n]*\bcontext\s+use\b/i.test(dockerCommand)) return "changing the global Docker context";
		if (
			isPotentialDockerRegistryRequest(dockerCommand) &&
			(hasPotentialDockerAuthConfig(dockerCommand, context) || hasPrivateDockerRegistryTarget(dockerCommand))
		) return "accessing a private or authenticated container registry";
		if (!isExplicitLocalDockerCommand(dockerCommand, context)) return "connecting to a remote Docker service";
	}

	const destructiveReason = destructiveLocalInfrastructureReason(command);
	if (destructiveReason) return destructiveReason;
	if (isPrivateNetworkRequest(command)) return "connecting to a private or internal service";
	if (isExplicitLocalDockerCommand(command, context)) return undefined;
	if (isExplicitLocalKubernetesCommand(command)) return undefined;
	if (kubernetesCommand.test(command)) return "connecting to or inspecting a Kubernetes control plane";
	if (isExplicitLocalServiceCommand(command)) return undefined;
	if (databaseCommand.test(command)) return "accessing a remote database service";
	if (/\b(?:aws|aws-vault|gcloud|az)\b/i.test(command)) return "accessing a remote cloud service";
	if (/\bterraform\b/i.test(command)) {
		if (!isLocalTerraformCommand(command)) return "accessing or changing remote infrastructure state";
		if (/^\s*terraform\s+(?:fmt|validate)\b/i.test(command)) {
			const root = canonicalPath(context.worktreeRoot);
			const cwd = canonicalPath(context.cwd);
			if (!root || !cwd || !isWithin(root, cwd)) return "accessing files outside the task worktree";
		}
		return undefined;
	}
	if (isLockedProjectInstall(command)) {
		const root = canonicalPath(context.worktreeRoot);
		const cwd = canonicalPath(context.cwd);
		if (!root || !cwd || !isWithin(root, cwd)) return "installing dependencies outside the task worktree";
		const authConfigPresent = context.authConfigPresent ?? hasPotentialPackageAuthConfig(context);
		return authConfigPresent ? "installing dependencies with possible authenticated or private registry access" : undefined;
	}
	return riskyCommands.find(([pattern]) => pattern.test(command))?.[1];
}

type DeliveryAuthorization = "push" | "pull_request";

function explicitDeliveryAuthorization(text: string): DeliveryAuthorization | undefined {
	const normalized = text.trim();
	if (/[?]/.test(normalized)) return undefined;
	if (/\b(?:no|not|never|don't|do not|avoid|without|maybe|might|perhaps|possibly|could|if|unless|once|when|later|eventually|sometime|consider)\b/i.test(normalized)) {
		return undefined;
	}

	const action = normalized.match(
		/^(?:(?:please|go ahead and|yes[,! ]+)\s*)?(push|create|open)\b|^(?:i authorize you to|you have my permission to|you are authorized to|i want you to)\s+(push|create|open)\b/i,
	);
	const requestedAction = (action?.[1] ?? action?.[2])?.toLowerCase();
	if (requestedAction === "push") {
		const unsupportedTarget =
			/\b(?:tag|tags|image|container|package|artifact|release|mirror|everything|all branches|all refs)\b/i.test(normalized) ||
			/\bbranch\s+(?!this\b|current\b|head\b|to\b)[A-Za-z0-9_][A-Za-z0-9._/:-]*/i.test(normalized) ||
			/\bpush\s+(?!this\b|current\b|head\b|branch\b|to\b|the\b|my\b)[A-Za-z0-9._/-]+/i.test(normalized);
		const remoteMatch = normalized.match(/\bto\s+(?:remote\s+)?([A-Za-z0-9._-]+)(\/\S+)?/i);
		const remote = remoteMatch?.[1]?.replace(/[.,!?;:]$/, "");
		if (unsupportedTarget || remoteMatch?.[2] || (remote && remote.toLowerCase() !== "origin")) return undefined;
		return "push";
	}
	if ((requestedAction === "create" || requestedAction === "open") && /\b(?:pull request|pr)\b/i.test(normalized)) {
		const targetOverride =
			/--(?:repo|head|base)\b/i.test(normalized) ||
			/\b(?:from|against|into|base)\s+(?!(?:this|current|head|default)\b|the\s+(?:current|default)\b)[A-Za-z0-9._/:-]+/i.test(normalized) ||
			/\b[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\b/.test(normalized);
		return targetOverride ? undefined : "pull_request";
	}
	return undefined;
}

function isAuthorizedDeliveryCommand(command: string, authorization: DeliveryAuthorization): boolean {
	if (!isDirectCommand(command) || containsCredentialMaterial(command)) return false;
	const normalized = command.trim();
	if (/^gh\s+pr\s+create\b/i.test(normalized)) {
		const overridesTarget =
			/(?:^|\s)--(?:repo|head|base)(?:=|\s|$)/i.test(normalized) ||
			/(?:^|\s)-[RHB]\S*/.test(normalized) ||
			Object.keys(process.env).some((name) => /^GH_(?:REPO|HOST)$/i.test(name));
		return authorization === "pull_request" && !overridesTarget;
	}
	if (authorization !== "push" && authorization !== "pull_request") return false;
	const match = normalized.match(/^git\s+push(?:\s+(.*))?$/i);
	if (!match) return false;
	const argumentsList = (match[1] ?? "").split(/\s+/).filter(Boolean);
	const positional: string[] = [];
	for (const argument of argumentsList) {
		if (argument === "-u" || argument === "--set-upstream") continue;
		if (argument.startsWith("-")) return false;
		positional.push(argument);
	}
	return positional.length === 2 && positional[0] === "origin" && positional[1] === "HEAD";
}

export function sensitiveCommandReason(command: string): string | undefined {
	if (
		isEnvironmentDump(command) ||
		/\bprintenv\b/i.test(command) ||
		/(?:^|[;&|]\s*)set\s*(?:[|;&]|$)/i.test(command) ||
		/\b(?:declare|typeset)\s+-p(?:x|a)?(?:\s|$)/i.test(command) ||
		/\bexport\s+-p\b/i.test(command)
	) {
		return "dumping process environment variables";
	}
	const protectedCommandPaths = protectedRoots.flatMap((path) => [path, path.replace(home, "~")]);
	if (protectedCommandPaths.some((path) => command.includes(path))) {
		return "direct access to protected credentials or keys";
	}
	if (/(?:^|[\s"'`/])\.env(?:\.(?!example(?:$|[\s"'`/]))[A-Za-z0-9_-]+)?(?=$|[\s"'`/])/i.test(command)) {
		return "direct access to a secret-looking file";
	}
	if (/\bkubectl\b[^;\n]*\bconfig\s+view\b[^;\n]*--raw\b/i.test(command)) {
		return "reading raw Kubernetes credentials";
	}
	if (/\bkubectl\b[^;\n]*\b(?:get|describe|edit|view)\b[^;\n]*\bsecrets?\b/i.test(command)) {
		return "reading or displaying Kubernetes secrets";
	}
	if (/\baws\b[^;\n]*\bconfigure\s+get\b[^;\n]*(?:secret|token|password|credential|access.?key|client.?secret|private.?key)/i.test(command)) {
		return "reading cloud credentials";
	}
	if (/\bsecurity\s+(?:find|find-generic-password)\b/i.test(command)) {
		return "reading a keychain credential";
	}
	if (/\bmise\s+run(?:\s+--silent)?\s+(?:(?:osx:)?(?:get-secret|ogs)|(?:aws-vault:)?(?:refresh|avr))\b/i.test(command)) {
		return "reading or exporting a credential through a Mise task";
	}
	return undefined;
}

export type SafetyCategory = "file_scope" | "credential" | "destructive_action" | "remote_access" | "delivery";

type ClassificationContext = CommandContext & { hasUI: boolean; deliveryAuthorization?: DeliveryAuthorization };

export type SafetyDecision =
	| { action: "allow" }
	| { action: "confirm"; category: SafetyCategory; reason: string; promptDetail: string }
	| { action: "block"; category: SafetyCategory; reason: string; needsAttention: boolean };

function categoryForRisk(command: string, reason: string): SafetyCategory {
	if (/outside the task worktree|unresolvable .*path|protected or secret-looking files|unresolved shell file operation/i.test(reason)) return "file_scope";
	if (/^(?:git\s+push|gh\s+pr\s+create|npm\s+publish|docker\s+push)\b/i.test(command) || /uploading data|publishing/i.test(reason)) {
		return "delivery";
	}
	if (/credential|secret|keychain|environment variable|authenticated|authenticating|private registry/i.test(reason)) return "credential";
	if (/delet|destructive|persistent data|cluster|permissions|ownership|elevated|tooling|dependencies|worktree|branch/i.test(reason)) {
		return "destructive_action";
	}
	return "remote_access";
}

function protectedPathCategory(reason: string): SafetyCategory {
	if (/secret|credential|private.key/i.test(reason)) return "credential";
	return "file_scope";
}

function safeProtectedPathReason(reason: string): string {
	return protectedPathCategory(reason) === "credential"
		? "accessing protected credential or secret material"
		: "accessing a protected file path";
}

export function classifyToolCall(toolName: string, input: ToolInput, context: ClassificationContext): SafetyDecision {
	const fileAccessTools = ["read", "write", "edit", "ls", "grep", "find"];
	if (fileAccessTools.includes(toolName)) {
		const inputPath = typeof input.path === "string" ? input.path : ".";
		const protectedReason = protectedPathReason(inputPath, context.cwd);
		if (protectedReason) {
			return { action: "block", category: protectedPathCategory(protectedReason), reason: safeProtectedPathReason(protectedReason), needsAttention: false };
		}

		const scopeReason = fileScopeReason(inputPath, context.cwd, context.worktreeRoot);
		if (scopeReason) {
			if (!context.hasUI) return { action: "block", category: "file_scope", reason: scopeReason, needsAttention: true };
			return { action: "confirm", category: "file_scope", reason: scopeReason, promptDetail: inputPath };
		}
	}

	if (toolName !== "bash" && toolName !== "powershell") return { action: "allow" };

	const command = commandFromInput(input);
	const sensitiveReason = sensitiveCommandReason(command);
	if (sensitiveReason) {
		return { action: "block", category: "credential", reason: sensitiveReason, needsAttention: false };
	}

	const reason = riskyCommandReason(command, context);
	if (!reason || (context.deliveryAuthorization && isAuthorizedDeliveryCommand(command, context.deliveryAuthorization))) return { action: "allow" };

	const category = categoryForRisk(command, reason);
	if (!context.hasUI) return { action: "block", category, reason, needsAttention: true };
	return { action: "confirm", category, reason, promptDetail: confirmationDetail(command) };
}

function commandFromInput(input: ToolInput): string {
	return String(input.command ?? input.script ?? "");
}

type SafetyGateEvent =
	| { phase: "approval_required" | "blocked"; category: SafetyCategory; reason: string }
	| { phase: "resolved"; category: SafetyCategory; reason: string; outcome: "approved" | "denied" };

export default function safetyGate(pi: ExtensionAPI): void {
	let deliveryBatchAuthorization: DeliveryAuthorization | undefined;
	let nextHerdrBlockId = 0;
	const activeHerdrBlocks = new Set<number>();
	const noUiHerdrBlocks = new Set<number>();

	function emitBestEffort(name: string, payload: unknown): void {
		try {
			pi.events?.emit(name, payload);
		} catch {
			// Observer failures must not change the gate decision.
		}
	}

	function emitDecision(event: SafetyGateEvent): void {
		emitBestEffort("safety-gate:decision", event);
	}

	function beginHerdrBlock(noUi: boolean): number {
		const id = ++nextHerdrBlockId;
		const wasInactive = activeHerdrBlocks.size === 0;
		activeHerdrBlocks.add(id);
		if (noUi) noUiHerdrBlocks.add(id);
		if (wasInactive) {
			emitBestEffort("herdr:blocked", { active: true, label: "Safety gate needs attention" });
		}
		return id;
	}

	function endHerdrBlock(id: number): void {
		noUiHerdrBlocks.delete(id);
		if (!activeHerdrBlocks.delete(id) || activeHerdrBlocks.size > 0) return;
		emitBestEffort("herdr:blocked", { active: false });
	}

	function clearNoUiBlocks(): void {
		for (const id of noUiHerdrBlocks) endHerdrBlock(id);
	}

	function clearAllHerdrBlocks(): void {
		for (const id of [...activeHerdrBlocks]) endHerdrBlock(id);
	}

	pi.on("input", (event) => {
		deliveryBatchAuthorization = explicitDeliveryAuthorization(event.text);
		clearNoUiBlocks();
	});

	pi.on("turn_start", clearNoUiBlocks);
	pi.on("agent_end", () => {
		deliveryBatchAuthorization = undefined;
		clearNoUiBlocks();
	});
	pi.on("session_shutdown", clearAllHerdrBlocks);

	pi.on("tool_call", async (event, ctx) => {
		const input = event.input as ToolInput;
		const commandCwd = typeof input.cwd === "string" ? resolveInputPath(input.cwd, ctx.cwd) : ctx.cwd;
		const decision = classifyToolCall(event.toolName, input, {
			worktreeRoot: ctx.cwd,
			cwd: commandCwd,
			hasUI: ctx.hasUI,
			deliveryAuthorization: deliveryBatchAuthorization,
		});

		if (decision.action === "allow") return;
		if (decision.action === "block") {
			emitDecision({ phase: "blocked", category: decision.category, reason: decision.reason });
			if (decision.needsAttention) beginHerdrBlock(true);
			const noUiReason = decision.needsAttention ? "; no interactive confirmation is available" : "";
			return { block: true, reason: `Safety gate blocked ${decision.reason}${noUiReason}.` };
		}

		emitDecision({ phase: "approval_required", category: decision.category, reason: decision.reason });
		const herdrBlockId = beginHerdrBlock(false);
		let allowed: boolean;
		try {
			allowed = await ctx.ui.confirm(`Allow ${decision.reason}?`, decision.promptDetail);
		} catch {
			emitDecision({ phase: "blocked", category: decision.category, reason: decision.reason });
			endHerdrBlock(herdrBlockId);
			return { block: true, reason: `Safety gate blocked ${decision.reason}; interactive confirmation failed.` };
		}

		emitDecision({
			phase: "resolved",
			category: decision.category,
			reason: decision.reason,
			outcome: allowed ? "approved" : "denied",
		});
		endHerdrBlock(herdrBlockId);
		if (!allowed) return { block: true, reason: `Safety gate blocked ${decision.reason}.` };
	});
}
