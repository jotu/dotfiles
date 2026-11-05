// Reports Pi's turns to Rex through the Program Status Protocol (OSC 7501):
// https://www.superlogical.com/rex/docs/build/program-status.md
// Rex shows the state on the tab and in the session picker. Active only inside
// a Rex terminal (REX_SESSION set) and only in TUI mode.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type State = "idle" | "working" | "done" | "blocked" | "clear";
type Kind = "permission" | "question";

const b64 = (text: string): string => Buffer.from(text, "utf8").toString("base64");

export function sequence(state: State, kind?: Kind, msg?: string): string {
	const pairs = [`state=${state}`];
	if (kind && state === "blocked") pairs.push(`kind=${kind}`);
	if (state !== "clear") pairs.push("app=pi");
	if (msg) pairs.push(`msg=${b64(msg.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").slice(0, 200))}`);
	return `\x1b]7501;${pairs.join(":")}\x1b\\`;
}

export default function rexAgentState(pi: ExtensionAPI): void {
	if (!process.env.REX_SESSION) return;
	let tui = false;
	const emit = (state: State, kind?: Kind, msg?: string): void => {
		if (!tui) return;
		try {
			process.stdout.write(sequence(state, kind, msg));
		} catch {
			// Reporting must never break Pi.
		}
	};

	pi.on("session_start", (_event, ctx) => {
		tui = ctx?.mode === "tui";
		emit(ctx?.isIdle?.() === false ? "working" : "idle");
	});
	pi.on("agent_start", () => emit("working", undefined, "Working"));
	pi.on("agent_settled", (_event, ctx) => {
		if (ctx?.isIdle?.() !== false) emit("done", undefined, "Finished");
	});
	pi.on("ui_prompt_start", (event: { kind?: unknown; title?: unknown }) => {
		const kind: Kind = event?.kind === "confirm" ? "permission" : "question";
		emit("blocked", kind, typeof event?.title === "string" && event.title ? event.title : "Waiting for you");
	});
	pi.on("ui_prompt_end", (_event, ctx) => {
		emit(ctx?.isIdle?.() === false ? "working" : "idle", undefined, ctx?.isIdle?.() === false ? "Working" : undefined);
	});
	pi.on("session_shutdown", () => {
		emit("clear");
		tui = false;
	});
}
