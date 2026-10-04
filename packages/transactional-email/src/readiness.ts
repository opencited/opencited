export const READINESS_STYLES: Record<
	string,
	{ label: string; color: string; background: string }
> = {
	ready: { label: "Ready", color: "#166534", background: "#dcfce7" },
	"needs-work": {
		label: "Needs work",
		color: "#a16207",
		background: "#fef9c3",
	},
	"not-ready": {
		label: "Not ready",
		color: "#991b1b",
		background: "#fee2e2",
	},
};

export function readinessStyle(readiness: string) {
	return (
		READINESS_STYLES[readiness] ?? {
			label: readiness,
			color: "#3f3f46",
			background: "#f4f4f5",
		}
	);
}
