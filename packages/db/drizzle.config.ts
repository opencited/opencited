import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { env } from "./src/env";

export default defineConfig({
	schema: "./src/schema/index.ts",
	dialect: "postgresql",
	out: "./drizzle",
	dbCredentials: {
		url: env.DATABASE_URL,
	},
});
