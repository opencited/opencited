import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatDuration(
	startedAt: Date | string | null | undefined,
	completedAt: Date | string | null | undefined,
): string {
	if (!startedAt || !completedAt) return "—";

	const start = typeof startedAt === "string" ? new Date(startedAt) : startedAt;
	const end =
		typeof completedAt === "string" ? new Date(completedAt) : completedAt;
	const ms = Math.abs(end.getTime() - start.getTime());

	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;

	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;

	if (minutes < 60) {
		return remainingSeconds > 0
			? `${minutes}m ${remainingSeconds}s`
			: `${minutes}m`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
