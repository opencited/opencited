export class ScanReportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ScanReportError";
	}
}
