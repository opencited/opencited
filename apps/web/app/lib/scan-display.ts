export type ScanReadiness = "ready" | "needs-work" | "not-ready";

export type ScanStatusBadgeVariant = "success" | "warning" | "outline";

export const READINESS_LABELS: Record<ScanReadiness, string> = {
	ready: "Passes checklist",
	"needs-work": "Checklist has gaps",
	"not-ready": "Checklist needs fixes",
};

export const READINESS_BADGE_VARIANTS: Record<
	ScanReadiness,
	ScanStatusBadgeVariant
> = {
	ready: "success",
	"needs-work": "warning",
	"not-ready": "warning",
};

export const READINESS_STROKE_CLASSES: Record<ScanReadiness, string> = {
	ready: "stroke-emerald-600",
	"needs-work": "stroke-amber-600",
	"not-ready": "stroke-muted-foreground",
};

export function scanErrorMessage(message: string | undefined): string {
	if (
		message &&
		message !== "Internal server error" &&
		!message.startsWith("[")
	) {
		return message;
	}
	if (message?.startsWith("[")) {
		return "Enter a domain like example.com and try again.";
	}
	return "Something went wrong while scanning. Please try again.";
}

export function formatScanDuration(durationMs: number): string {
	return `${(Math.max(durationMs, 100) / 1000).toFixed(1)}s`;
}
