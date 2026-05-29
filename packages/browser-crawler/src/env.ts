import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
	server: {
		LOGGER_LEVEL: z.enum(["silent", "info", "debug"]).default("info"),
		HEADLESS: z
			.enum(["true", "false"])
			.default("true")
			.transform((v: string) => v === "true"),
	},
	runtimeEnv: process.env,
});
