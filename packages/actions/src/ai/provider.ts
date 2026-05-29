import { createOpenAI } from "@ai-sdk/openai";
import { groq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import { env } from "../env";

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
	const provider = env.LLM_PROVIDER;
	const baseURL = env.LLM_BASE_URL;
	const model = env.LLM_MODEL;

	if (!model) {
		throw new Error(
			"LLM_MODEL environment variable is required. Please set it to your model identifier (e.g., 'qwen/qwen3-32b', 'gpt-4o-mini').",
		);
	}

	const apiKey =
		provider === "groq"
			? (env.GROQ_API_KEY ?? env.LLM_API_KEY)
			: provider === "openai"
				? (env.OPENAI_API_KEY ?? env.LLM_API_KEY)
				: env.LLM_API_KEY;

	if (!apiKey) {
		throw new Error(
			`API key is required for provider '${provider}'. Set ${provider === "groq" ? "GROQ_API_KEY or LLM_API_KEY" : provider === "openai" ? "OPENAI_API_KEY or LLM_API_KEY" : "LLM_API_KEY"}.`,
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
