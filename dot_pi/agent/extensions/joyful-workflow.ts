import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

type Phase = "ask" | "plan" | "implement" | "verify" | "review" | "done" | "break";
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
	base?: string;
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
	base: Type.Optional(Type.String({ description: "Base ref, default origin/main" })),
	allowExisting: Type.Optional(Type.Boolean({ description: "Use an explicitly requested existing worktree" })),
	reason: Type.Optional(Type.String({ description: "Reason for the transition" })),
});

function initialState(): WorkflowState {
	return { phase: "ask", updatedAt: new Date().toISOString() };
}

function isPhase(value: unknown): value is Phase {
	return typeof value === "string" && phases.includes(value as Phase);
}

function reconstructState(ctx: ExtensionContext): WorkflowState {
	let result = initialState();
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "custom" || entry.customType !== STATE_TYPE) continue;
		const data = entry.data as Partial<WorkflowState> | undefined;
		if (data && isPhase(data.phase)) {
			result = {
				phase: data.phase,
				goal: typeof data.goal === "string" ? data.goal : undefined,
				reason: typeof data.reason === "string" ? data.reason : undefined,
				worktree: typeof data.worktree === "string" ? data.worktree : undefined,
				branch: typeof data.branch === "string" ? data.branch : undefined,
				base: typeof data.base === "string" ? data.base : undefined,
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

function parseBase(base: string): { remote: string; branch: string; ref: string } {
	const slash = base.indexOf("/");
	if (slash <= 0 || slash === base.length - 1) {
		return { remote: "origin", branch: base, ref: `origin/${base}` };
	}
	return { remote: base.slice(0, slash), branch: base.slice(slash + 1), ref: base };
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
			? `\nWorktree: ${state.worktree}\nBranch: ${state.branch}\nBase: ${state.base}`
			: "\nWorktree: not prepared";
		const evidence = `\nVerification: ${state.verificationPassed ? "passed" : "pending"}\nReview: ${state.reviewPassed ? "passed" : "pending"}`;
		const reason = state.reason ? `\nReason: ${state.reason}` : "";
		return `Joyful workflow phase: ${state.phase}${goal}${location}${evidence}${reason}`;
	}

	async function prepare(ctx: ExtensionContext, baseInput: string | undefined, allowExisting = false) {
		if (!state.goal) return { ok: false, text: "Start a workflow with a goal before preparing it." };
		if (!ctx.hasUI) return { ok: false, text: "Cannot prepare a Worktrunk workflow without an interactive UI." };

		const base = allowExisting ? { remote: "", branch: "", ref: "existing" } : parseBase(baseInput?.trim() || "main");
		const approved = await ctx.ui.confirm(
			allowExisting ? "Use the explicitly requested existing Worktrunk?" : `Prepare joyful workflow from ${base.ref}?`,
			allowExisting
				? "Verify this is a clean, dedicated, non-main Worktrunk worktree."
				: `Fetch ${base.remote}/${base.branch} and verify this is a clean, fresh Worktrunk worktree.`,
		);
		if (!approved) return { ok: false, text: "Worktrunk preparation cancelled by user." };

		if (!allowExisting) {
			const fetch = await pi.exec("git", ["fetch", base.remote, base.branch], { cwd: ctx.cwd });
			if (fetch.code !== 0) {
				return { ok: false, text: `Could not fetch ${base.ref}: ${fetch.stderr || "git fetch failed"}` };
			}
		}

		const baseResultPromise = allowExisting
			? Promise.resolve({ code: 0, stdout: "", stderr: "" })
			: pi.exec("git", ["rev-parse", base.ref], { cwd: ctx.cwd });
		const [worktreeResult, branchResult, headResult, baseResult, statusResult, wtResult] = await Promise.all([
			pi.exec("git", ["rev-parse", "--show-toplevel"], { cwd: ctx.cwd }),
			pi.exec("git", ["branch", "--show-current"], { cwd: ctx.cwd }),
			pi.exec("git", ["rev-parse", "HEAD"], { cwd: ctx.cwd }),
			baseResultPromise,
			pi.exec("git", ["status", "--porcelain"], { cwd: ctx.cwd }),
			pi.exec("wt", ["list"], { cwd: ctx.cwd }),
		]);

		if (wtResult.code !== 0) return { ok: false, text: `Worktrunk is unavailable: ${wtResult.stderr || "wt list failed"}` };
		if ([worktreeResult, branchResult, headResult, baseResult, statusResult].some((item) => item.code !== 0)) {
			return { ok: false, text: "Could not inspect the current Git worktree." };
		}

		const worktree = worktreeResult.stdout.trim();
		const branch = branchResult.stdout.trim();
		const head = headResult.stdout.trim();
		const baseHead = baseResult.stdout.trim();
		const dirty = statusResult.stdout.trim();

		if (!branch || branch === "main" || branch === "master") {
			return { ok: false, text: "Start Pi inside a dedicated Worktrunk branch, not the base branch." };
		}
		if (dirty) return { ok: false, text: "The selected Worktrunk is not clean; commit or discard changes before starting." };
		if (!allowExisting && head !== baseHead) {
			return { ok: false, text: `The worktree is not fresh from ${base.ref}; create a new Worktrunk from the fetched base.` };
		}

		persist({
			...state,
			worktree,
			branch,
			base: allowExisting ? "existing" : base.ref,
			verificationPassed: false,
			reviewPassed: false,
			reason: allowExisting ? "Existing Worktrunk preflight passed." : "Fresh Worktrunk preflight passed.",
			updatedAt: new Date().toISOString(),
		});
		return { ok: true, text: `Worktrunk preflight passed.\nWorktree: ${worktree}\nBranch: ${branch}\nBase: ${allowExisting ? "existing" : base.ref}` };
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
		if (target === "plan" && (!state.worktree || !state.branch || !state.base)) {
			return { ok: false, text: "Run Worktrunk preflight before entering Plan." };
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
		base: string | undefined,
		allowExisting: boolean | undefined,
		reason: string | undefined,
		ctx: ExtensionContext,
	) {
		if (action === "status") return { ok: true, text: statusText() };
		if (action === "start") {
			if (!goal?.trim()) return { ok: false, text: "A goal is required to start a joyful workflow." };
			persist({ phase: "ask", goal: goal.trim(), reason: undefined, updatedAt: new Date().toISOString() });
			return { ok: true, text: `Workflow started in ask phase.\nGoal: ${goal.trim()}\nRun Worktrunk preflight before Plan.` };
		}
		if (action === "prepare") return prepare(ctx, base, allowExisting === true);
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
			const outcome = await handleAction(params.action, params.goal, params.base, params.allowExisting, params.reason, ctx);
			return result(outcome.text, {
				phase: state.phase,
				ok: outcome.ok,
				goal: state.goal,
				worktree: state.worktree,
				branch: state.branch,
				base: state.base,
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
				ctx.ui.notify("Usage: /joyful status|start <goal>|prepare [base]|next|verified|reviewed|replan|finish|break", "error");
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
