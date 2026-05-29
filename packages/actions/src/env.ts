import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
	server: {
		LLM_PROVIDER: z
			.enum(["groq", "openai", "openai-compatible"])
			.default("openai"),
		LLM_MODEL: z.string().min(1),
		LLM_BASE_URL: z.string().url().optional(),
		LLM_API_KEY: z.string().min(1).optional(),
		GROQ_API_KEY: z.string().min(1).optional(),
		OPENAI_API_KEY: z.string().min(1).optional(),
	},
	runtimeEnv: process.env,
});
