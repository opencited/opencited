export const sampleScanReport = {
	domain: "convoform.com",
	score: 75,
	readiness: "ready" as const,
	issues: [
		{
			check: "json-ld",
			issue: "No valid schema.org JSON-LD found on the homepage",
			howToFix:
				'Add a script type="application/ld+json" block to your homepage with Organization and WebSite schema describing your brand.',
		},
		{
			check: "llms-txt",
			issue: "No llms.txt found at /llms.txt",
			howToFix:
				"Add an /llms.txt file in markdown that summarises your key pages, products, and docs so language models can understand what you offer.",
		},
	],
};

export const sampleVerification = {
	domain: "convoform.com",
	code: "482913",
};
