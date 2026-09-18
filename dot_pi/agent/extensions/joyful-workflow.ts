import { resolve } from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

type Phase = "ask" | "plan" | "implement" | "verify" | "review" | "done" | "break";
type Workspace = "main" | "branch" | "worktree" | "worktrunk" | "existing";
type Action =
	| "start"
	| "status"
	| "prepare"
	| "advance"
	| "replan"
	| "mark-verified"
	| "mark-reviewed"
	| "finish"
	| "break";

type WorkflowState = {
	phase: Phase;
	goal?: string;
	reason?: string;
	worktree?: string;
	branch?: string;
	workspace?: Workspace;
	verificationPassed?: boolean;
	reviewPassed?: boolean;
	updatedAt: string;
};

const STATE_TYPE = "joyful-workflow-state";
const phases: Phase[] = ["ask", "plan", "implement", "verify", "review", "done", "break"];
const nextPhase: Partial<Record<Phase, Phase>> = {
	ask: "plan",
	plan: "implement",
	implement: "verify",
	verify: "review",
	review: "done",
};

const WorkflowParams = Type.Object({
	action: StringEnum([
		"start",
		"status",
		"prepare",
		"advance",
		"replan",
		"mark-verified",
		"mark-reviewed",
		"finish",
		"break",
	] as const),
	goal: Type.Optional(Type.String({ description: "Goal for a new workflow" })),
	workspace: Type.Optional(
		StringEnum(["main", "branch", "worktree", "worktrunk", "existing"] as const, {
			description: "Where to work; Worktrunk is optional",
		}),
	),
	allowExisting: Type.Optional(Type.Boolean({ description: "Use the current checkout without requiring Worktrunk" })),
	reason: Type.Optional(Type.String({ description: "Reason for the transition" })),
});

function initialState(): WorkflowState {
	return { phase: "ask", updatedAt: new Date().toISOString() };
}

function isPhase(value: unknown): value is Phase {
	return typeof value === "string" && phases.includes(value as Phase);
}

function isWorkspace(value: unknown): value is Workspace {
	return typeof value === "string" && ["main", "branch", "worktree", "worktrunk", "existing"].includes(value);
}

function reconstructState(ctx: ExtensionContext): WorkflowState {
	let result = initialState();
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "custom" || entry.customType !== STATE_TYPE) continue;
		const data = entry.data as (Partial<WorkflowState> & { base?: unknown }) | undefined;
		if (data && isPhase(data.phase)) {
			result = {
				phase: data.phase,
				goal: typeof data.goal === "string" ? data.goal : undefined,
				reason: typeof data.reason === "string" ? data.reason : undefined,
				worktree: typeof data.worktree === "string" ? data.worktree : undefined,
				branch: typeof data.branch === "string" ? data.branch : undefined,
				workspace: isWorkspace(data.workspace)
					? data.workspace
					: typeof data.base === "string"
						? "worktrunk"
						: undefined,
				verificationPassed: data.verificationPassed === true,
				reviewPassed: data.reviewPassed === true,
				updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
			};
		}
	}
	return result;
}

function result(text: string, details: Record<string, unknown> = {}) {
	return { content: [{ type: "text" as const, text }], details };
}

export default function joyfulWorkflow(pi: ExtensionAPI): void {
	let state = initialState();

	function persist(next: WorkflowState): void {
		state = { ...next, updatedAt: new Date().toISOString() };
		pi.appendEntry(STATE_TYPE, state);
	}

	function statusText(): string {
		const goal = state.goal ? `\nGoal: ${state.goal}` : "";
		const location = state.worktree
			? `\nWorktree: ${state.worktree}\nBranch: ${state.branch}\nWorkspace: ${state.workspace}`
			: "\nWorkspace: not prepared";
		const evidence = `\nVerification: ${state.verificationPassed ? "passed" : "pending"}\nReview: ${state.reviewPassed ? "passed" : "pending"}`;
		const reason = state.reason ? `\nReason: ${state.reason}` : "";
		return `Joyful workflow phase: ${state.phase}${goal}${location}${evidence}${reason}`;
	}

	async function prepare(ctx: ExtensionContext, workspaceInput: string | undefined, allowExisting = false) {
		if (!state.goal) return { ok: false, text: "Start a workflow with a goal before preparing it." };
		if (!ctx.hasUI) return { ok: false, text: "Cannot prepare a joyful workflow without an interactive UI." };

		const requested = workspaceInput?.trim().toLowerCase();
		if (requested && !isWorkspace(requested)) {
			return { ok: false, text: "Choose a workspace: main, branch, worktree, worktrunk, or existing." };
		}

		const [worktreeResult, branchResult, statusResult, gitDirResult, commonDirResult] = await Promise.all([
			pi.exec("git", ["rev-parse", "--show-toplevel"], { cwd: ctx.cwd }),
			pi.exec("git", ["branch", "--show-current"], { cwd: ctx.cwd }),
			pi.exec("git", ["status", "--porcelain"], { cwd: ctx.cwd }),
			pi.exec("git", ["rev-parse", "--git-dir"], { cwd: ctx.cwd }),
			pi.exec("git", ["rev-parse", "--git-common-dir"], { cwd: ctx.cwd }),
		]);
		if ([worktreeResult, branchResult, statusResult, gitDirResult, commonDirResult].some((item) => item.code !== 0)) {
			return { ok: false, text: "Could not inspect the current Git checkout." };
		}

		const worktree = worktreeResult.stdout.trim();
		const branch = branchResult.stdout.trim();
		const dirty = statusResult.stdout.trim();
		const linkedWorktree = resolve(ctx.cwd, gitDirResult.stdout.trim()) !== resolve(ctx.cwd, commonDirResult.stdout.trim());
		const isMain = branch === "main" || branch === "master";
		let workspace: Workspace | undefined;
		if (allowExisting || requested === "existing") workspace = "existing";
		else if (requested) workspace = requested as Workspace;
		else if (!isMain) workspace = "branch";

		if (!workspace) {
			return { ok: false, text: "You are on the base branch. Choose explicitly: main, branch, worktree, worktrunk, or existing." };
		}
		if (!branch) return { ok: false, text: "A checked-out branch is required; detached HEAD is not supported." };
		if (workspace === "main" && !isMain) return { ok: false, text: "Workspace main requires the main or master branch." };
		if (workspace === "branch" && isMain) return { ok: false, text: "Workspace branch requires a non-main branch. Create or switch to one first." };
		if (workspace === "worktree" && !linkedWorktree) return { ok: false, text: "Workspace worktree requires a linked Git worktree. Create or switch to one first." };
		if (workspace === "worktrunk") {
			const wt = await pi.exec("wt", ["list"], { cwd: ctx.cwd });
			if (wt.code !== 0) return { ok: false, text: `Worktrunk is unavailable: ${wt.stderr || "wt list failed"}` };
			if (!linkedWorktree || isMain) return { ok: false, text: "Workspace worktrunk requires a linked worktree on a non-main branch." };
		}
		if (dirty) return { ok: false, text: "The selected checkout is not clean; commit or discard changes before starting." };

		const approved = await ctx.ui.confirm(
			`Use the ${workspace} workspace?`,
			`Continue in ${worktree} on ${branch}. No workspace will be created or switched automatically.`,
		);
		if (!approved) return { ok: false, text: "Workspace preparation cancelled by user." };

		persist({
			...state,
			worktree,
			branch,
			workspace,
			verificationPassed: false,
			reviewPassed: false,
			reason: `${workspace} workspace prepared.`,
			updatedAt: new Date().toISOString(),
		});
		return { ok: true, text: `Workspace prepared.\nWorkspace: ${workspace}\nWorktree: ${worktree}\nBranch: ${branch}` };
	}

	async function moveTo(target: Phase, reason: string | undefined, ctx: ExtensionContext) {
		if (state.phase === target) return { ok: true, text: `Already in phase: ${target}` };

		const expected = nextPhase[state.phase];
		const isReplan = target === "plan" && state.phase !== "ask";
		const isBreak = target === "break";
		const isValid = isBreak || isReplan || expected === target;
		if (!isValid) {
			return {
				ok: false,
				text: `Cannot move from ${state.phase} to ${target}. Expected ${expected ?? "start a new workflow or break"}.`,
			};
		}
		if (target === "plan" && (!state.worktree || !state.branch || !state.workspace)) {
			return { ok: false, text: "Prepare a workspace before entering Plan." };
		}
		if (target === "review" && !state.verificationPassed) {
			return { ok: false, text: "Mark verification passed before entering Review." };
		}
		if (target === "done" && (!state.verificationPassed || !state.reviewPassed)) {
			return { ok: false, text: "Mark verification and review passed before finishing." };
		}
		if (!ctx.hasUI) return { ok: false, text: `Cannot confirm ${state.phase} → ${target} without an interactive UI.` };

		const approved = await ctx.ui.confirm(
			`Joyful workflow: ${state.phase} → ${target}?`,
			reason || `Continue the workflow in the ${target} phase.`,
		);
		if (!approved) return { ok: false, text: "Phase transition cancelled by user." };

		persist({
			...state,
			phase: target,
			reason,
			verificationPassed: target === "plan" ? false : state.verificationPassed,
			reviewPassed: target === "plan" ? false : state.reviewPassed,
			updatedAt: new Date().toISOString(),
		});
		return { ok: true, text: `Moved to ${target}.` };
	}

	async function markEvidence(kind: "verificationPassed" | "reviewPassed", ctx: ExtensionContext) {
		const expectedPhase = kind === "verificationPassed" ? "verify" : "review";
		if (state.phase !== expectedPhase) return { ok: false, text: `Evidence can only be marked in ${expectedPhase}.` };
		if (!ctx.hasUI) return { ok: false, text: "Cannot record evidence without an interactive UI." };
		const label = kind === "verificationPassed" ? "verification" : "review";
		const approved = await ctx.ui.confirm(`Mark ${label} passed?`, `Only confirm after the ${label} evidence has been reported.`);
		if (!approved) return { ok: false, text: `${label} evidence was not marked passed.` };
		persist({ ...state, [kind]: true, reason: `${label} evidence recorded.`, updatedAt: new Date().toISOString() });
		return { ok: true, text: `${label} marked passed.` };
	}

	async function handleAction(
		action: Action,
		goal: string | undefined,
		workspace: string | undefined,
		allowExisting: boolean | undefined,
		reason: string | undefined,
		ctx: ExtensionContext,
	) {
		if (action === "status") return { ok: true, text: statusText() };
		if (action === "start") {
			if (!goal?.trim()) return { ok: false, text: "A goal is required to start a joyful workflow." };
			persist({ phase: "ask", goal: goal.trim(), reason: undefined, updatedAt: new Date().toISOString() });
			return { ok: true, text: `Workflow started in ask phase.\nGoal: ${goal.trim()}\nChoose a workspace before Plan (main, branch, worktree, worktrunk, or existing).` };
		}
		if (action === "prepare") return prepare(ctx, workspace, allowExisting === true);
		if (action === "mark-verified") return markEvidence("verificationPassed", ctx);
		if (action === "mark-reviewed") return markEvidence("reviewPassed", ctx);
		if (action === "advance") {
			const target = nextPhase[state.phase];
			if (!target) return { ok: false, text: `No automatic next phase from ${state.phase}.` };
			return moveTo(target, reason, ctx);
		}
		if (action === "replan") return moveTo("plan", reason || "Replan after verification or review feedback.", ctx);
		if (action === "finish") return moveTo("done", reason || "Verification and review are complete.", ctx);
		return moveTo("break", reason || "Stop the workflow.", ctx);
	}

	pi.on("session_start", async (_event, ctx) => {
		state = reconstructState(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		state = reconstructState(ctx);
	});

	pi.on("tool_call", async (event) => {
		if (!["write", "edit"].includes(event.toolName)) return;
		if (state.phase === "implement") return;
		return {
			block: true,
			reason: `Joyful workflow is in ${state.phase}; move to implement before changing files.`,
		};
	});

	pi.registerTool({
		name: "joyful_workflow",
		label: "Joyful Workflow",
		description: "Start, prepare, inspect, and advance the Ask → Plan → Implement → Verify → Review workflow with user confirmation.",
		promptSnippet: "Advance the joyful development workflow with explicit user confirmation",
		parameters: WorkflowParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const outcome = await handleAction(
				params.action,
				params.goal,
				params.workspace,
				params.allowExisting,
				params.reason,
				ctx,
			);
			return result(outcome.text, {
				phase: state.phase,
				ok: outcome.ok,
				goal: state.goal,
				worktree: state.worktree,
				branch: state.branch,
				workspace: state.workspace,
				verificationPassed: state.verificationPassed,
				reviewPassed: state.reviewPassed,
			});
		},
	});

	pi.registerCommand("joyful", {
		description: "Show or advance the joyful development workflow",
		handler: async (args, ctx) => {
			const [command = "status", ...rest] = args.trim().split(/\s+/);
			const text = rest.join(" ").trim();
			if (command === "start") {
				const outcome = await handleAction("start", text, undefined, undefined, undefined, ctx);
				ctx.ui.notify(outcome.text, outcome.ok ? "info" : "error");
				return;
			}
			if (command === "prepare") {
				const useExisting = text === "existing";
				const outcome = await handleAction("prepare", undefined, useExisting ? undefined : text || undefined, useExisting, undefined, ctx);
				ctx.ui.notify(outcome.text, outcome.ok ? "info" : "error");
				return;
			}
			const action = command === "next" ? "advance" : command === "verified" ? "mark-verified" : command === "reviewed" ? "mark-reviewed" : command;
			if (!["status", "advance", "replan", "mark-verified", "mark-reviewed", "finish", "break"].includes(action)) {
				ctx.ui.notify("Usage: /joyful status|start <goal>|prepare [main|branch|worktree|worktrunk|existing]|next|verified|reviewed|replan|finish|break", "error");
				return;
			}
			const outcome = await handleAction(
				action as Exclude<Action, "start" | "prepare">,
				undefined,
				undefined,
				false,
				text || undefined,
				ctx,
			);
			ctx.ui.notify(outcome.text, outcome.ok ? "info" : "error");
		},
	});
}
