// Show Pi's active context usage above the editor, independent of footer extensions.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "smart-zone";
const SMART_ZONE_LIMIT = 125_000;
const REFOCUS_LIMIT = 150_000;
const LARGE_CONTEXT_WINDOW = 200_000;

function formatStatus(ctx: ExtensionContext): string {
	const usage = ctx.getContextUsage();
	const tokens = usage?.tokens;
	if (tokens === undefined || tokens === null || !Number.isFinite(tokens) || tokens < 0) {
		return "CONTEXT USAGE PENDING";
	}

	const count = `${tokens.toLocaleString("en-US")} tokens`;
	const window = usage?.contextWindow;
	if (typeof window !== "number" || !Number.isFinite(window) || window <= 0) return `CONTEXT LIMIT UNKNOWN · ${count}`;
	if (window < LARGE_CONTEXT_WINDOW) {
		// The early warning indicates capacity, not model quality or Pi's compaction threshold.
		const capacity = `${tokens.toLocaleString("en-US")} / ${window.toLocaleString("en-US")} tokens (${Math.floor(tokens / window * 100)}%)`;
		const warning = tokens >= window / 2 ? " — consider /compact or /new" : "";
		return `CONTEXT CAPACITY (estimate) · ${capacity}${warning}`;
	}
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
