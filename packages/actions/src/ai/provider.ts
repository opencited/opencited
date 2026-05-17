import { createOpenAI } from "@ai-sdk/openai";
import { groq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

type ProviderType = "groq" | "openai" | "openai-compatible";

interface LLMProviderConfig {
	provider: ProviderType;
	baseURL?: string;
	apiKey?: string;
	model: string;
}

const groqStructuredOutputsModels = new Set([
	"openai/gpt-oss-20b",
	"openai/gpt-oss-120b",
	"openai/gpt-oss-safeguard-20b",
	"meta-llama/llama-4-scout-17b-16e-instruct",
]);

export function getProviderConfig(): LLMProviderConfig {
	const provider = (process.env.LLM_PROVIDER as ProviderType) ?? "openai";
	const baseURL = process.env.LLM_BASE_URL;
	const apiKey = process.env.LLM_API_KEY;
	const model = process.env.LLM_MODEL;

	if (!model) {
		throw new Error(
			"LLM_MODEL environment variable is required. Please set it to your model identifier (e.g., 'qwen/qwen3-32b', 'gpt-4o-mini').",
		);
	}

	if (!["groq", "openai", "openai-compatible"].includes(provider)) {
		throw new Error(
			`Unsupported LLM provider: ${provider}. Supported: 'groq', 'openai', 'openai-compatible'.`,
		);
	}

	if (provider === "openai-compatible" && !baseURL) {
		throw new Error(
			"LLM_BASE_URL is required when LLM_PROVIDER is 'openai-compatible'.",
		);
	}

	return { provider, baseURL, apiKey, model };
}

export function createProvider(): {
	model: LanguageModel;
	providerOptions: unknown;
} {
	const config = getProviderConfig();

	if (config.provider === "groq") {
		const supportsStructuredOutputs = groqStructuredOutputsModels.has(
			config.model,
		);
		return {
			model: groq(config.model),
			providerOptions: {
				groq: {
					structuredOutputs: supportsStructuredOutputs,
					strictJsonSchema: supportsStructuredOutputs,
				},
			},
		};
	}

	if (config.provider === "openai") {
		return {
			model: createOpenAI({ apiKey: config.apiKey })(config.model),
			providerOptions: undefined,
		};
	}

	return {
		model: createOpenAI({
			baseURL: config.baseURL,
			apiKey: config.apiKey,
		})(config.model),
		providerOptions: undefined,
	};
}
