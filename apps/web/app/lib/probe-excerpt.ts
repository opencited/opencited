const EXCERPT_PREVIEW_LENGTH = 180;

export function stripProbeMarkdown(text: string): string {
	return text
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/\[([^\]]+)\]/g, "$1")
		.replace(/\s+/g, " ")
		.trim();
}

export function truncateAtWordBoundary(
	text: string,
	maxLength: number,
): string {
	if (text.length <= maxLength) {
		return text;
	}
	const slice = text.slice(0, maxLength);
	const lastSpace = slice.lastIndexOf(" ");
	if (lastSpace <= 0) {
		return `${slice.trimEnd()}…`;
	}
	return `${slice.slice(0, lastSpace).trimEnd()}…`;
}

export function formatProbeExcerpt(
	raw: string,
	expanded: boolean,
): { preview: string; isTruncated: boolean; full: string } {
	const full = stripProbeMarkdown(raw);
	if (expanded) {
		return { preview: full, isTruncated: false, full };
	}
	const isTruncated = full.length > EXCERPT_PREVIEW_LENGTH;
	const preview = isTruncated
		? truncateAtWordBoundary(full, EXCERPT_PREVIEW_LENGTH)
		: full;
	return { preview, isTruncated, full };
}
