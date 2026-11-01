import type { Metadata } from "next";

export const LANDING_CANONICAL_URL = "https://www.opencited.com/";

export const LANDING_TITLE =
	"OpenCited — See what AI tells your buyers about you";

export const LANDING_DESCRIPTION =
	"OpenCited runs your buyers' questions on ChatGPT and Perplexity and shows where you're mentioned, cited, or losing out to competitors.";

export const landingMetadata: Metadata = {
	metadataBase: new URL(LANDING_CANONICAL_URL),
	title: LANDING_TITLE,
	description: LANDING_DESCRIPTION,
	alternates: {
		canonical: LANDING_CANONICAL_URL,
	},
	openGraph: {
		type: "website",
		url: LANDING_CANONICAL_URL,
		siteName: "OpenCited",
		title: LANDING_TITLE,
		description: LANDING_DESCRIPTION,
	},
	twitter: {
		card: "summary_large_image",
		title: LANDING_TITLE,
		description: LANDING_DESCRIPTION,
	},
};

export type LandingFaqItem = {
	question: string;
	answer: string;
};

/**
 * Every answer here was checked against the code when the landing page shipped.
 * Do not add scheduled-run, absolute-privacy or license claims.
 */
export const LANDING_FAQ: readonly LandingFaqItem[] = [
	{
		question: "Which AI engines does OpenCited check?",
		answer:
			"ChatGPT and Perplexity today. More engines are coming, and we'll add them as they're ready.",
	},
	{
		question: "How is this different from SEO tools?",
		answer:
			"SEO tools track where your pages rank in search results. OpenCited reads the answers AI engines actually give to your buyers' questions: whether your brand is named, whether your pages are cited as sources, and which competitors show up instead.",
	},
	{
		question: "How often do my questions run?",
		answer:
			"Whenever you want. Run one question or all of them from your dashboard in a click, and OpenCited keeps every result so you can see how the answers change over time. Scheduled automatic runs are on the roadmap.",
	},
	{
		question: "What's the difference between a mention and a citation?",
		answer:
			"A mention is when an answer names your brand. A citation is when an answer links to one of your pages as a source. You can be mentioned without being cited, and cited without being mentioned, so OpenCited tracks both.",
	},
	{
		question: "Is my data private?",
		answer:
			"Your project data is private to your workspace, and we never sell or share it. Because OpenCited is open source, you can read exactly what it stores, or run it yourself and keep everything on your own servers.",
	},
	{
		question: "How much does it cost?",
		answer: "OpenCited is free during beta.",
	},
	{
		question: "Can I self-host OpenCited?",
		answer:
			"Yes. The code is on GitHub, and the README has a self-hosting guide. You run the web app and a Docker-based worker, and bring your own Postgres, Redis, Clerk account and OpenAI-compatible API key.",
	},
];
