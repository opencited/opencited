import { useState, useCallback } from "react";
import { crawlSitemap } from "@opencited/crawler";
import type { CrawledUrl } from "@opencited/crawler";
import { discoverSitemap } from "../utils/discovery";

export interface UseCrawlReturn {
	input: string;
	setInput: (value: string | ((prev: string) => string)) => void;
	inputModeIndex: number;
	setInputModeIndex: (value: number | ((prev: number) => number)) => void;
	loading: boolean;
	loadingText: string;
	error: string | null;
	results: CrawledUrl[] | null;
	setResults: (value: CrawledUrl[] | null) => void;
	discoveredUrl: string | null;
	setDiscoveredUrl: (value: string | null) => void;
	scrollIndex: number;
	setScrollIndex: (value: number | ((prev: number) => number)) => void;
	crawl: (inputModeIndex: number) => Promise<boolean>;
	reset: () => void;
}

export function useCrawl(): UseCrawlReturn {
	const [input, setInputState] = useState("");
	const [inputModeIndex, setInputModeIndexState] = useState(0);
	const [loading, setLoading] = useState(false);
	const [loadingText, setLoadingText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [results, setResults] = useState<CrawledUrl[] | null>(null);
	const [discoveredUrl, setDiscoveredUrl] = useState<string | null>(null);
	const [scrollIndex, setScrollIndexState] = useState(0);

	const setInput = useCallback((value: string | ((prev: string) => string)) => {
		setInputState((prev) =>
			typeof value === "function" ? value(prev) : value,
		);
	}, []);

	const setInputModeIndex = useCallback(
		(value: number | ((prev: number) => number)) => {
			setInputModeIndexState((prev) =>
				typeof value === "function" ? value(prev) : value,
			);
		},
		[],
	);

	const setScrollIndex = useCallback(
		(value: number | ((prev: number) => number)) => {
			setScrollIndexState((prev) =>
				typeof value === "function" ? value(prev) : value,
			);
		},
		[],
	);

	const crawl = useCallback(
		async (modeIndex: number): Promise<boolean> => {
			if (!input.trim()) return false;

			setLoading(true);
			setLoadingText("Discovering sitemap");
			setError(null);
			setDiscoveredUrl(null);

			try {
				let sitemapUrl = input.trim();

				if (modeIndex === 0) {
					setLoadingText("Searching for sitemap.xml");
					const discovered = await discoverSitemap(sitemapUrl);
					if (!discovered) {
						setError("No sitemap.xml found. Use URL mode instead.");
						setLoading(false);
						return false;
					}
					setDiscoveredUrl(discovered);
					sitemapUrl = discovered;
				}

				setLoadingText("Fetching sitemap");
				const result = await crawlSitemap(sitemapUrl);
				setResults(result.urls);
				setScrollIndex(0);
				return true;
			} catch (e) {
				setError(e instanceof Error ? e.message : "Failed to crawl sitemap");
				return false;
			} finally {
				setLoading(false);
			}
		},
		[input, setScrollIndex],
	);

	const reset = useCallback(() => {
		setInputState("");
		setInputModeIndexState(0);
		setLoading(false);
		setLoadingText("");
		setError(null);
		setResults(null);
		setDiscoveredUrl(null);
		setScrollIndexState(0);
	}, []);

	return {
		input,
		setInput,
		inputModeIndex,
		setInputModeIndex,
		loading,
		loadingText,
		error,
		results,
		setResults,
		discoveredUrl,
		setDiscoveredUrl,
		scrollIndex,
		setScrollIndex,
		crawl,
		reset,
	};
}
