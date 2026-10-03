export function emailHostForScanDomain(domain: string): string {
	return domain
		.trim()
		.toLowerCase()
		.replace(/^www\./, "");
}

export function emailMatchesScanDomain(
	email: string,
	scanDomain: string,
): boolean {
	const normalized = email.trim().toLowerCase();
	const at = normalized.lastIndexOf("@");
	if (at <= 0 || at === normalized.length - 1) {
		return false;
	}
	const host = normalized.slice(at + 1);
	return host === emailHostForScanDomain(scanDomain);
}

export function buildReportEmail(
	localPart: string,
	scanDomain: string,
): string {
	const local = localPart.trim();
	if (!local || local.includes("@") || /\s/.test(local)) {
		throw new Error("Enter the part before @ in your work email.");
	}
	return `${local}@${emailHostForScanDomain(scanDomain)}`;
}
