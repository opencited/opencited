import type {
	PromptTemplateIndustry,
	PromptTemplateCategory,
} from "./schema/promptTemplate";

export const industries = [
	"SaaS",
	"E-commerce",
	"Healthcare",
	"Finance",
	"Media & Publishing",
	"Education",
	"Travel & Hospitality",
	"Real Estate",
	"Legal Services",
	"Marketing & Advertising",
] as const;

export const categories = [
	"competitor-analysis",
	"brand-monitoring",
	"visibility",
	"content-optimization",
	"pricing-intelligence",
	"feature-comparison",
] as const;

export const allTags = [
	"competitors",
	"pricing",
	"comparison",
	"brand-mentions",
	"sentiment",
	"ai-overview",
	"source-citations",
	"visibility",
	"seo",
	"content",
	"features",
	"reviews",
	"alternatives",
	"market-position",
] as const;

export interface PromptTemplateData {
	id: string;
	title: string;
	description: string;
	text: string;
	industry: PromptTemplateIndustry;
	category: PromptTemplateCategory;
	tags: string[];
}

export const promptTemplates: PromptTemplateData[] = [
	{
		id: "saas-competitor-alternatives",
		title: "SaaS Alternatives Comparison",
		description:
			"Checks how AI answer engines position {brandName} against competitors when users search for alternatives.",
		text: "What are the best alternatives to {brandName} for project management? Compare features, pricing, and user reviews of {brandName} with its top competitors in the SaaS market.",
		industry: "SaaS",
		category: "competitor-analysis",
		tags: ["alternatives", "competitors", "comparison", "features"],
	},
	{
		id: "saas-brand-visibility",
		title: "SaaS Brand Visibility Check",
		description:
			"Tests how prominently {brandName} appears in AI-generated answers for category-defining queries.",
		text: "Who are the leading providers in the SaaS project management space? List the top companies and describe what makes {brandName} stand out compared to other solutions.",
		industry: "SaaS",
		category: "visibility",
		tags: ["brand-mentions", "ai-overview", "market-position"],
	},
	{
		id: "saas-pricing-intel",
		title: "SaaS Pricing Intelligence",
		description:
			"Monitors how AI engines compare {brandName}'s pricing against similar products.",
		text: "Compare the pricing plans of {brandName} with similar SaaS platforms. Which offers the best value for small teams, and how does {brandName}'s pricing model stack up?",
		industry: "SaaS",
		category: "pricing-intelligence",
		tags: ["pricing", "comparison", "competitors"],
	},
	{
		id: "ecommerce-product-comparison",
		title: "E-commerce Product Comparison",
		description:
			"Checks how AI answer engines compare {brandName}'s products with competing brands in shopping queries.",
		text: "Compare {brandName} products with similar items from competing brands. What do customers say about {brandName} in reviews, and how does the quality and pricing compare?",
		industry: "E-commerce",
		category: "competitor-analysis",
		tags: ["comparison", "reviews", "pricing", "competitors"],
	},
	{
		id: "ecommerce-brand-mentions",
		title: "E-commerce Brand Mentions",
		description:
			"Tracks how often and in what context {brandName} appears in AI-generated shopping recommendations.",
		text: "What are the best online stores for electronics? Is {brandName} a reputable brand to buy from? Summarize customer sentiment and how {brandName} compares to other retailers.",
		industry: "E-commerce",
		category: "brand-monitoring",
		tags: ["brand-mentions", "sentiment", "ai-overview"],
	},
	{
		id: "healthcare-provider-comparison",
		title: "Healthcare Provider Comparison",
		description:
			"Monitors how AI engines present {brandName} alongside other healthcare providers or services.",
		text: "Compare {brandName} with other healthcare providers in the telemedicine space. What services does {brandName} offer, and how do patients rate their experience compared to alternatives?",
		industry: "Healthcare",
		category: "competitor-analysis",
		tags: ["comparison", "competitors", "reviews", "features"],
	},
	{
		id: "healthcare-trust-visibility",
		title: "Healthcare Trust & Visibility",
		description:
			"Checks how AI engines describe {brandName}'s credibility and trustworthiness in health-related queries.",
		text: "Is {brandName} a legitimate and trusted healthcare provider? What do medical professionals and patients say about the quality of care at {brandName}?",
		industry: "Healthcare",
		category: "visibility",
		tags: ["brand-mentions", "sentiment", "ai-overview", "visibility"],
	},
	{
		id: "finance-service-comparison",
		title: "Financial Service Comparison",
		description:
			"Tests how AI engines compare {brandName}'s financial products or services with competitors.",
		text: "Compare {brandName}'s financial services with other major providers. What are the interest rates, fees, and customer satisfaction scores for {brandName} compared to its competitors?",
		industry: "Finance",
		category: "competitor-analysis",
		tags: ["comparison", "competitors", "pricing", "features"],
	},
	{
		id: "media-content-optimization",
		title: "Media Content Optimization",
		description:
			"Checks how well {brandName}'s content is cited and referenced by AI answer engines.",
		text: "What are the most authoritative sources for news about technology trends? Does {brandName} provide reliable coverage, and how often is {brandName} cited as a source in AI-generated answers?",
		industry: "Media & Publishing",
		category: "content-optimization",
		tags: ["seo", "source-citations", "visibility", "content"],
	},
	{
		id: "education-course-comparison",
		title: "Education Platform Comparison",
		description:
			"Monitors how AI engines position {brandName} against other educational platforms and providers.",
		text: "Compare {brandName} with other online learning platforms. What courses does {brandName} offer, and how do student outcomes and pricing compare to competitors like Coursera or Udemy?",
		industry: "Education",
		category: "competitor-analysis",
		tags: ["comparison", "competitors", "pricing", "features"],
	},
	{
		id: "travel-destination-mentions",
		title: "Travel Brand Mentions",
		description:
			"Tracks how {brandName} appears in AI-generated travel recommendations and destination guides.",
		text: "What are the best travel booking platforms for international trips? How does {brandName} compare to other travel agencies in terms of pricing, customer service, and destination coverage?",
		industry: "Travel & Hospitality",
		category: "brand-monitoring",
		tags: ["brand-mentions", "comparison", "competitors", "pricing"],
	},
	{
		id: "realestate-listing-visibility",
		title: "Real Estate Listing Visibility",
		description:
			"Checks how AI engines present {brandName} in property search and real estate queries.",
		text: "What are the top real estate platforms for finding homes? How does {brandName} compare to Zillow or Redfin in terms of listing accuracy, search features, and user experience?",
		industry: "Real Estate",
		category: "visibility",
		tags: ["visibility", "comparison", "competitors", "features"],
	},
	{
		id: "legal-firm-comparison",
		title: "Legal Service Comparison",
		description:
			"Monitors how AI engines compare {brandName} with other legal service providers.",
		text: "Compare {brandName} with other legal service providers. What areas of law does {brandName} specialize in, and how do client reviews and success rates compare to competing firms?",
		industry: "Legal Services",
		category: "competitor-analysis",
		tags: ["comparison", "competitors", "reviews", "features"],
	},
	{
		id: "marketing-agency-features",
		title: "Marketing Agency Feature Comparison",
		description:
			"Tests how AI engines describe {brandName}'s marketing capabilities relative to competitors.",
		text: "What marketing services does {brandName} offer? Compare {brandName}'s approach to digital marketing with other top agencies, including SEO, content strategy, and paid advertising capabilities.",
		industry: "Marketing & Advertising",
		category: "feature-comparison",
		tags: ["features", "comparison", "competitors", "seo", "content"],
	},
	{
		id: "saas-feature-deep-dive",
		title: "SaaS Feature Deep Dive",
		description:
			"Checks how AI engines describe {brandName}'s specific features and capabilities in detail.",
		text: "What are the key features of {brandName}? Provide a detailed breakdown of {brandName}'s capabilities, integrations, and how it compares to industry standards for SaaS platforms.",
		industry: "SaaS",
		category: "feature-comparison",
		tags: ["features", "comparison", "content"],
	},
	{
		id: "ecommerce-seo-optimization",
		title: "E-commerce SEO Optimization",
		description:
			"Monitors how well {brandName}'s product pages and content are surfaced by AI answer engines.",
		text: "What are the best practices for e-commerce SEO in 2024? How well does {brandName} optimize its product pages for search, and what improvements could {brandName} make to appear more prominently in AI-generated answers?",
		industry: "E-commerce",
		category: "content-optimization",
		tags: ["seo", "content", "visibility", "source-citations"],
	},
];
