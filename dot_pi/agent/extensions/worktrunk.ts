import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

async function markActivity(
	pi: ExtensionAPI,
	cwd: string,
	args: ["set", string] | ["clear"],
): Promise<void> {
	try {
		await pi.exec("wt", ["config", "state", "marker", ...args], { cwd });
	} catch {
		// Worktrunk activity tracking must never interrupt a Pi session.
	}
}

export default function worktrunkActivity(pi: ExtensionAPI): void {
	pi.on("agent_start", async (_event, ctx) => {
		await markActivity(pi, ctx.cwd, ["set", "🤖"]);
	});

	pi.on("agent_end", async (_event, ctx) => {
		await markActivity(pi, ctx.cwd, ["set", "💬"]);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		await markActivity(pi, ctx.cwd, ["clear"]);
	});
}
