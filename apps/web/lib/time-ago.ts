export function timeAgo(date: Date | string | null): string {
	if (!date) return "Unknown";

	const now = new Date();
	const then = new Date(date);
	const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

	if (seconds < 60) return "just now";
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
	if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;

	return then.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: now.getFullYear() !== then.getFullYear() ? "numeric" : undefined,
	});
}
