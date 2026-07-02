import { describe, expect, it } from "bun:test";
import { toMarkdown } from "../src/providers/turndown";

describe("ChatGPT turndown preprocessing", () => {
	describe("elements that are stripped", () => {
		it("strips <sup> elements", () => {
			const html = "<p>TypeScript<sup>1</sup> is great</p>";
			const md = toMarkdown(html);
			expect(md).toContain("TypeScript");
			expect(md).not.toContain("1");
			expect(md).not.toContain("sup");
		});

		it("strips <button> elements", () => {
			const html =
				"<p>Some content</p><button>Copy</button><p>More content</p>";
			const md = toMarkdown(html);
			expect(md).toContain("Some content");
			expect(md).toContain("More content");
			expect(md).not.toContain("Copy");
		});

		it("preserves aria-hidden divs (stripped by provider, not turndown)", () => {
			const html =
				'<p>Visible text</p><div aria-hidden="true">Hidden content</div>';
			const md = toMarkdown(html);
			expect(md).toContain("Visible text");
			expect(md).toContain("Hidden content");
		});

		it("preserves data-testid divs (stripped by provider, not turndown)", () => {
			const html = `
				<p>Response text here</p>
				<div data-testid="copy-turn-action-button">Copy</div>
				<div data-testid="thumbs-up-button">Good</div>
				<div data-testid="thumbs-down-button">Bad</div>
				<div data-testid="share-turn-action-button">Share</div>
			`;
			const md = toMarkdown(html);
			expect(md).toContain("Response text here");
			expect(md).toContain("Copy");
			expect(md).toContain("Good");
			expect(md).toContain("Bad");
			expect(md).toContain("Share");
		});

		it("strips <script> and <style> elements", () => {
			const html =
				'<p>Content</p><script>alert("xss")</script><style>.red{color:red}</style>';
			const md = toMarkdown(html);
			expect(md).toContain("Content");
			expect(md).not.toContain("alert");
			expect(md).not.toContain("color:red");
		});

		it("strips <img>, <figure>, <picture>, <video>, <iframe>", () => {
			const html = `
				<p>Before</p>
				<img src="photo.jpg" alt="A photo">
				<figure><img src="fig.png"></figure>
				<picture><img src="pic.webp"></picture>
				<video src="vid.mp4"></video>
				<iframe src="embed.html"></iframe>
				<p>After</p>
			`;
			const md = toMarkdown(html);
			expect(md).toContain("Before");
			expect(md).toContain("After");
			expect(md).not.toContain("photo.jpg");
			expect(md).not.toContain("fig.png");
			expect(md).not.toContain("pic.webp");
			expect(md).not.toContain("vid.mp4");
			expect(md).not.toContain("embed.html");
		});

		it("strips <nav>, <header>, <footer>", () => {
			const html = `
				<nav>Navigation links</nav>
				<header>Page header</header>
				<p>Main content</p>
				<footer>Page footer</footer>
			`;
			const md = toMarkdown(html);
			expect(md).toContain("Main content");
			expect(md).not.toContain("Navigation links");
			expect(md).not.toContain("Page header");
			expect(md).not.toContain("Page footer");
		});
	});

	describe("elements that are preserved", () => {
		it("preserves <p> paragraphs", () => {
			const html = "<p>First paragraph</p><p>Second paragraph</p>";
			const md = toMarkdown(html);
			expect(md).toContain("First paragraph");
			expect(md).toContain("Second paragraph");
		});

		it("preserves <table> with proper markdown formatting", () => {
			const html = `
				<table>
					<tr><th>Name</th><th>Price</th></tr>
					<tr><td>HubSpot</td><td>$45/mo</td></tr>
					<tr><td>Salesforce</td><td>$25/mo</td></tr>
				</table>
			`;
			const md = toMarkdown(html);
			expect(md).toContain("| Name | Price |");
			expect(md).toContain("| --- | --- |");
			expect(md).toContain("| HubSpot | $45/mo |");
			expect(md).toContain("| Salesforce | $25/mo |");
		});

		it("preserves <ul> unordered lists", () => {
			const html =
				"<ul><li>Item one</li><li>Item two</li><li>Item three</li></ul>";
			const md = toMarkdown(html);
			expect(md).toContain("Item one");
			expect(md).toContain("Item two");
			expect(md).toContain("Item three");
		});

		it("preserves <ol> ordered lists", () => {
			const html =
				"<ol><li>First step</li><li>Second step</li><li>Third step</li></ol>";
			const md = toMarkdown(html);
			expect(md).toContain("First step");
			expect(md).toContain("Second step");
			expect(md).toContain("Third step");
		});

		it("preserves <strong> as bold", () => {
			const html = "<p>This is <strong>important</strong> text</p>";
			const md = toMarkdown(html);
			expect(md).toContain("**important**");
		});

		it("preserves <em> as italic", () => {
			const html = "<p>This is <em>emphasized</em> text</p>";
			const md = toMarkdown(html);
			expect(md).toContain("*emphasized*");
		});

		it("preserves headings", () => {
			const html = "<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>";
			const md = toMarkdown(html);
			expect(md).toContain("# Title");
			expect(md).toContain("## Subtitle");
			expect(md).toContain("### Section");
		});

		it("preserves <code> inline and <pre> blocks", () => {
			const html =
				"<p>Use <code>console.log()</code></p><pre><code>const x = 1;</code></pre>";
			const md = toMarkdown(html);
			expect(md).toContain("`console.log()`");
			expect(md).toContain("```");
			expect(md).toContain("const x = 1;");
		});

		it("preserves <blockquote>", () => {
			const html = "<blockquote><p>This is a quote</p></blockquote>";
			const md = toMarkdown(html);
			expect(md).toContain("> This is a quote");
		});
	});

	describe("ChatGPT-specific turndown rules", () => {
		it("strips numeric anchor links like [1], [2]", () => {
			const html =
				'<p>TypeScript is great <a href="https://example.com">[1]</a> for many reasons <a href="https://other.com">[2]</a></p>';
			const md = toMarkdown(html);
			expect(md).toContain("TypeScript is great");
			expect(md).not.toContain("[1]");
			expect(md).not.toContain("[2]");
		});

		it("strips bare numeric link text", () => {
			const html = '<p>Reference <a href="https://example.com">1</a> here</p>';
			const md = toMarkdown(html);
			expect(md).toContain("Reference");
			expect(md).not.toContain("1");
		});

		it("strips carousel/gallery/slider/swiper divs", () => {
			const html = `
				<p>Before carousel</p>
				<div class="carousel-container"><img src="slide1.jpg"></div>
				<div class="gallery"><img src="photo.jpg"></div>
				<div class="slider-wrapper"><img src="slide2.jpg"></div>
				<div class="swiper-slide"><img src="slide3.jpg"></div>
				<p>After carousel</p>
			`;
			const md = toMarkdown(html);
			expect(md).toContain("Before carousel");
			expect(md).toContain("After carousel");
			expect(md).not.toContain("slide1.jpg");
			expect(md).not.toContain("photo.jpg");
			expect(md).not.toContain("slide2.jpg");
			expect(md).not.toContain("slide3.jpg");
		});

		it("collapses multiple newlines into double newlines", () => {
			const html = "<p>First</p>\n\n\n\n<p>Second</p>";
			const md = toMarkdown(html);
			expect(md).not.toContain("\n\n\n\n");
		});
	});
});
