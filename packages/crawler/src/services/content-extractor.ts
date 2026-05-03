import * as cheerio from "cheerio";
import { z } from "zod";

export const headingStructureSchema = z.object({
	h1: z.array(z.string()),
	h2: z.array(z.string()),
	h3: z.array(z.string()),
	h4: z.array(z.string()),
	h5: z.array(z.string()),
	h6: z.array(z.string()),
});
export type HeadingStructure = z.infer<typeof headingStructureSchema>;

export interface ExtractContentResult {
	wordCount: number;
	textHtmlRatio: string;
	headingStructure: HeadingStructure;
	imagesTotal: number;
	imagesWithAlt: number;
	internalLinks: number;
	externalLinks: number;
	domDepthAvg: string;
	extractedText: string;
}

export function extractContent(
	html: string,
	pageUrl: string,
): ExtractContentResult {
	const $ = cheerio.load(html);

	const textContent = getTextContent($);
	const wordCount = countWords(textContent);
	const textHtmlRatio = computeTextHtmlRatio(textContent, html);
	const headingStructure = extractHeadings($);
	const { imagesTotal, imagesWithAlt } = countImages($);
	const { internalLinks, externalLinks } = countLinks($, pageUrl);
	const domDepthAvg = computeDomDepth($);
	const extractedText = textContent;

	return {
		wordCount,
		textHtmlRatio,
		headingStructure,
		imagesTotal,
		imagesWithAlt,
		internalLinks,
		externalLinks,
		domDepthAvg,
		extractedText,
	};
}

function getTextContent($: cheerio.CheerioAPI): string {
	return $("body").text().replace(/\s+/g, " ").trim();
}

function countWords(text: string): number {
	if (!text) return 0;
	return text.split(/\s+/).filter(Boolean).length;
}

function computeTextHtmlRatio(text: string, html: string): string {
	if (!html || html.length === 0) return "0";
	const ratio = text.length / html.length;
	return ratio.toFixed(4);
}

function extractHeadings($: cheerio.CheerioAPI): HeadingStructure {
	const headings: HeadingStructure = {
		h1: [],
		h2: [],
		h3: [],
		h4: [],
		h5: [],
		h6: [],
	};

	for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"] as const) {
		$(tag).each((_, el) => {
			const text = $(el).text().trim();
			if (text) {
				headings[tag].push(text);
			}
		});
	}

	return headings;
}

function countImages($: cheerio.CheerioAPI): {
	imagesTotal: number;
	imagesWithAlt: number;
} {
	let imagesTotal = 0;
	let imagesWithAlt = 0;

	$("img").each((_, el) => {
		imagesTotal++;
		const alt = $(el).attr("alt");
		if (alt && alt.trim().length > 0) {
			imagesWithAlt++;
		}
	});

	return { imagesTotal, imagesWithAlt };
}

function countLinks(
	$: cheerio.CheerioAPI,
	pageUrl: string,
): { internalLinks: number; externalLinks: number } {
	let internalLinks = 0;
	let externalLinks = 0;

	let pageDomain: string;
	try {
		pageDomain = new URL(pageUrl).hostname;
	} catch {
		pageDomain = "";
	}

	$("a[href]").each((_, el) => {
		const href = $(el).attr("href") ?? "";
		if (
			href.startsWith("#") ||
			href.startsWith("mailto:") ||
			href.startsWith("tel:")
		) {
			return;
		}

		try {
			const linkUrl = new URL(href, pageUrl);
			if (linkUrl.hostname === pageDomain) {
				internalLinks++;
			} else {
				externalLinks++;
			}
		} catch {
			// invalid URL, skip
		}
	});

	return { internalLinks, externalLinks };
}

function computeDomDepth($: cheerio.CheerioAPI): string {
	const depths: number[] = [];

	$("*").each((_, el) => {
		const getParent = (node: unknown): unknown =>
			(node as { parent: unknown }).parent;

		let depth = 0;
		// biome-ignore lint/suspicious/noExplicitAny: cheerio element types don't expose parent for traversal
		let current: any = el;
		while (getParent(current) != null) {
			depth++;
			current = getParent(current);
		}
		depths.push(depth);
	});

	if (depths.length === 0) return "0";
	const avg = depths.reduce((a, b) => a + b, 0) / depths.length;
	return avg.toFixed(2);
}
