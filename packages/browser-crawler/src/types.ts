import type { Page, Browser, BrowserContext } from "@playwright/test";

export interface BrowserSession {
	browser?: Browser;
	context: BrowserContext;
	page: Page;
}

export interface BrowserOptions {
	headless?: boolean;
	browserName?: "chromium" | "firefox" | "webkit";
	viewport?: { width: number; height: number } | null;
	userAgent?: string;
	userDataDir?: string;
}

export interface SnapshotOptions {
	maxDepth?: number;
	includeBoxes?: boolean;
}

export interface ExtractContentOptions {
	text?: boolean;
	links?: boolean;
	images?: boolean;
	sources?: boolean;
	selectors?: string[];
}

export interface ExtractedContent {
	url: string;
	title: string;
	text?: string;
	links?: LinkInfo[];
	images?: ImageInfo[];
	sources?: SourceInfo[];
	metadata: PageMetadata;
}

export interface LinkInfo {
	text: string;
	href: string;
	isExternal: boolean;
}

export interface ImageInfo {
	src: string;
	alt: string;
}

export interface SourceInfo {
	text: string;
	url: string;
	title?: string;
}

export interface PageMetadata {
	loadTime: number;
	wordCount: number;
	linkCount: number;
	imageCount: number;
}

export interface ActionResult {
	success: boolean;
	error?: string;
	data?: unknown;
}
