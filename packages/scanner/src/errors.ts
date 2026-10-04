export class ScanTargetError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ScanTargetError";
	}
}

export class FetchError extends Error {
	readonly url: string;

	constructor(url: string, message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "FetchError";
		this.url = url;
	}
}
