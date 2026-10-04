export function emailHostForScanDomain(domain: string): string {
	return domain
		.trim()
		.toLowerCase()
		.replace(/^www\./, "");
}

export function buildReportEmail(
	localPart: string,
	scanDomain: string,
): string {
	const local = localPart.trim();
	if (!local || local.includes("@") || /\s/.test(local)) {
		return "";
	}
	return `${local}@${emailHostForScanDomain(scanDomain)}`;
}
