import { defineConfig } from "@trigger.dev/sdk/v3";
import { playwright } from "@trigger.dev/build/extensions/playwright";

export default defineConfig({
	project: "proj_ltacdxbnugurdrodhdwx",
	runtime: "node",
	logLevel: "log",
	maxDuration: 3600,
	retries: {
		enabledInDev: true,
		default: {
			maxAttempts: 3,
			minTimeoutInMs: 1000,
			maxTimeoutInMs: 10000,
			factor: 2,
			randomize: true,
		},
	},
	dirs: ["trigger"],
	build: {
		external: ["playwright", "@playwright/test"],
		extensions: [
			playwright({
				browsers: ["chromium"],
				headless: true,
			}),
		],
	},
});
