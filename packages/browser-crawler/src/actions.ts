import type { BrowserSession } from "./types";
import type {
	ExtractContentOptions,
	ExtractedContent,
	LinkInfo,
	ImageInfo,
} from "./types";

export async function click(
	session: BrowserSession,
	selector: string,
): Promise<boolean> {
	try {
		await session.page.click(selector);
		console.log(`✅ Clicked: ${selector}`);
		return true;
	} catch (error) {
		console.error(`❌ Failed to click ${selector}:`, error);
		return false;
	}
}

export async function type(
	session: BrowserSession,
	selector: string,
	text: string,
): Promise<boolean> {
	try {
		await session.page.fill(selector, text);
		console.log(`✅ Typed "${text}" into: ${selector}`);
		return true;
	} catch (error) {
		console.error(`❌ Failed to type into ${selector}:`, error);
		return false;
	}
}

export async function press(
	session: BrowserSession,
	key: string,
): Promise<boolean> {
	try {
		await session.page.keyboard.press(key);
		console.log(`✅ Pressed: ${key}`);
		return true;
	} catch (error) {
		console.error(`❌ Failed to press ${key}:`, error);
		return false;
	}
}

export async function hover(
	session: BrowserSession,
	selector: string,
): Promise<boolean> {
	try {
		await session.page.hover(selector);
		console.log(`✅ Hovered: ${selector}`);
		return true;
	} catch (error) {
		console.error(`❌ Failed to hover ${selector}:`, error);
		return false;
	}
}

export async function waitFor(
	session: BrowserSession,
	selector: string,
	timeout?: number,
): Promise<boolean> {
	try {
		await session.page.waitForSelector(selector, {
			state: "visible",
			timeout,
		});
		return true;
	} catch (error) {
		console.error(`❌ Element not found: ${selector}`, error);
		return false;
	}
}

export async function extractContent(
	session: BrowserSession,
	options: ExtractContentOptions = {},
): Promise<ExtractedContent> {
	const {
		text = true,
		links = true,
		images = true,
		sources = false,
		selectors,
	} = options;

	const startTime = Date.now();

	const extracted = await session.page.evaluate(
		(opts) => {
			const getTextContent = () => {
				if (opts.selectors && opts.selectors.length > 0) {
					return opts.selectors
						.map((sel) => {
							const el = document.querySelector(sel);
							return el?.textContent ?? "";
						})
						.join("\n");
				}
				return document.body.innerText;
			};

			const getLinks = () => {
				const currentHost = window.location.hostname;
				return Array.from(document.querySelectorAll("a"))
					.map((a) => ({
						text: (a.textContent ?? "").trim(),
						href: a.href,
						isExternal: !a.href.includes(currentHost),
					}))
					.filter((link) => link.text && link.href);
			};

			const getImages = () => {
				return Array.from(document.querySelectorAll("img")).map((img) => ({
					src: img.src,
					alt: img.alt || "",
				}));
			};

			const getSources = () => {
				const sourceSelectors = [
					'[class*="source"]',
					'[class*="citation"]',
					'[class*="reference"]',
					"cite",
					"blockquote",
				];
				return sourceSelectors
					.flatMap((selector) =>
						Array.from(document.querySelectorAll(selector)),
					)
					.map((el) => ({
						text: (el.textContent ?? "").trim(),
						url: el.getAttribute("data-url") || "",
						title: el.getAttribute("title") || "",
					}))
					.filter((source) => source.text);
			};

			return {
				text: opts.text ? getTextContent() : undefined,
				links: opts.links ? getLinks() : undefined,
				images: opts.images ? getImages() : undefined,
				sources: opts.sources ? getSources() : undefined,
			};
		},
		{ text, links, images, sources, selectors },
	);

	const loadTime = Date.now() - startTime;

	const metadata = await session.page.evaluate(() => {
		const text = document.body.innerText;
		const words = text.split(/\s+/).filter((w) => w.length > 0);
		const links = document.querySelectorAll("a");
		const images = document.querySelectorAll("img");

		return {
			loadTime: 0,
			wordCount: words.length,
			linkCount: links.length,
			imageCount: images.length,
		};
	});

	return {
		url: session.page.url(),
		title: await session.page.title(),
		text: extracted.text,
		links: extracted.links as LinkInfo[] | undefined,
		images: extracted.images as ImageInfo[] | undefined,
		sources: extracted.sources,
		metadata: {
			...metadata,
			loadTime,
		},
	};
}

export async function evaluate(
	session: BrowserSession,
	pageFunction: string,
): Promise<unknown> {
	try {
		const result = await session.page.evaluate(pageFunction);
		return result;
	} catch (error) {
		console.error(`❌ Evaluation failed:`, error);
		throw error;
	}
}

export async function getHtml(
	session: BrowserSession,
	selector?: string,
): Promise<string> {
	if (selector) {
		return await session.page.innerHTML(selector);
	}
	return await session.page.content();
}

export async function getText(
	session: BrowserSession,
	selector?: string,
): Promise<string> {
	if (selector) {
		return (await session.page.textContent(selector)) ?? "";
	}
	return await session.page.evaluate(() => document.body.innerText);
}

export async function getClipboard(session: BrowserSession): Promise<string> {
	try {
		await session.context.grantPermissions([
			"clipboard-read",
			"clipboard-write",
		]);
		return await session.page.evaluate(() => navigator.clipboard.readText());
	} catch (error) {
		console.error("❌ Failed to read clipboard:", error);
		return "";
	}
}
