/** Product-specific status lines — rotate while public scan runs. */
export const SCAN_LOADING_LINES = [
	"Fetching robots.txt and AI crawler rules…",
	"Checking HTTPS, redirects, and canonical host…",
	"Scanning for sitemap and structured data…",
	"Reviewing homepage signals and llms.txt…",
] as const;

/** Shown while the live Perplexity probe runs (between queries). */
export const PERPLEXITY_LOADING_LINES = [
	"Submitting prompts to Perplexity…",
	"Capturing answers and citation links…",
	"Checking whether your domain appears in each answer…",
] as const;
