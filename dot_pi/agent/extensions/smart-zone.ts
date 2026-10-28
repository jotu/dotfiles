// Show Pi's active context usage above the editor, independent of footer extensions.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "smart-zone";
const SMART_ZONE_LIMIT = 125_000;
const REFOCUS_LIMIT = 150_000;

function formatStatus(ctx: ExtensionContext): string {
	const tokens = ctx.getContextUsage()?.tokens;
	if (tokens === undefined || tokens === null) {
		return "CONTEXT USAGE PENDING";
	}

	const count = `${tokens.toLocaleString("en-US")} tokens`;
	if (tokens < SMART_ZONE_LIMIT) {
		return `SMART ZONE · ${count}`;
	}
	if (tokens <= REFOCUS_LIMIT) {
		return `FOCUS DRIFT · ${count}`;
	}
	return `REFOCUS · ${count} — /compact or /new`;
}

function updateWidget(ctx: ExtensionContext): void {
	if (ctx.hasUI) {
		ctx.ui.setWidget(STATUS_KEY, [formatStatus(ctx)], { placement: "aboveEditor" });
	}
}

export default function smartZone(pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => updateWidget(ctx));
	pi.on("turn_end", (_event, ctx) => updateWidget(ctx));
	pi.on("model_select", (_event, ctx) => updateWidget(ctx));
	pi.on("session_compact", (_event, ctx) => updateWidget(ctx));
	pi.on("session_tree", (_event, ctx) => updateWidget(ctx));
	pi.on("session_shutdown", (_event, ctx) => {
		if (ctx.hasUI) {
			ctx.ui.setWidget(STATUS_KEY, undefined);
		}
	});
}
