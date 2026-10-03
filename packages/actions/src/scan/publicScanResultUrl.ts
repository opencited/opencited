export function publicScanResultUrl(origin: string, scanId: string): string {
	const base = origin.replace(/\/$/, "");
	return `${base}/scan/${scanId}`;
}
