import type { CrawledUrl } from "@opencited/crawler";

export type ScreenType = "main" | "crawl" | "results";

export type InputMode = "domain" | "url";

export interface MenuItem {
	id: string;
	label: string;
}

export interface InputModeOption {
	label: string;
	description: string;
}

export interface CrawlState {
	input: string;
	inputModeIndex: number;
	loading: boolean;
	loadingText: string;
	error: string | null;
	results: CrawledUrl[] | null;
	discoveredUrl: string | null;
	scrollIndex: number;
}

export interface AppState {
	mode: ScreenType;
	selectedIndex: number;
	crawl: CrawlState;
}
