import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		AXIOM_TOKEN: z.string().optional(),
		AXIOM_DATASET: z.string().optional(),
		AXIOM_TRANSPORT_ENABLED: z
			.enum(["true", "false"])
			.default("false")
			.transform((v) => v === "true"),
		LOGGER_LEVEL: z
			.enum(["debug", "info", "warn", "error", "off"])
			.default("info"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
