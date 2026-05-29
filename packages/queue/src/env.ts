import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
	server: {
		REDIS_URL: z.string().url(),
	},
	runtimeEnv: process.env,
});
