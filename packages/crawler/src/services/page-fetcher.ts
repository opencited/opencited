export interface FetchPageResult {
	html: string;
	httpStatus: number;
	contentLength: number;
	fetchedAt: string;
}

export async function fetchPage(url: string): Promise<FetchPageResult> {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(10_000),
		redirect: "follow",
		headers: {
			Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"User-Agent":
				"Mozilla/5.0 (compatible; OpenCitedBot/1.0; +https://opencited.ai)",
		},
	});

	const httpStatus = response.status;
	const html = await response.text();

	const contentLength = httpStatus === 200 ? html.length : 0;
	const fetchedAt = new Date().toISOString();

	return {
		html,
		httpStatus,
		contentLength,
		fetchedAt,
	};
}
