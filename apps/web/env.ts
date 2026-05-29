import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

// Eagerly validate all package env files at startup.
// Next.js only loads modules on demand, so without these imports,
// missing env vars in packages would only surface on the first page request.
import "../../packages/db/src/env";
import "../../packages/queue/src/env";
import "../../packages/actions/src/env";
import "../../packages/browser-crawler/src/env";

export const env = createEnv({
	server: {
		CLERK_SECRET_KEY: z.string().min(1),
		VERCEL_URL: z.string().optional(),
	},
	client: {
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
	},
	experimental__runtimeEnv: {
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
			process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
	},
});
