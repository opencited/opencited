import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
	server: {
		LOGGER_LEVEL: z.enum(["silent", "info", "debug"]).default("info"),
		HEADLESS: z
			.union([z.literal("true"), z.literal("false"), z.literal("virtual")])
			.default("true")
			.transform((v: string) => {
				if (v === "virtual") return "virtual" as const;
				return v === "true";
			}),
		DEBUG_PAUSE_ON_FAILURE: z.coerce.boolean().default(false),
		DEBUG_PAUSE_DURATION_MS: z.coerce.number().default(60000),
	},
	runtimeEnv: process.env,
});
