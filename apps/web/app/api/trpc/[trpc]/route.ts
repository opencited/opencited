import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createTRPCContext } from "@opencited/trpc";

export const maxDuration = 30;

const handler = (req: Request) =>
	fetchRequestHandler({
		endpoint: "/api/trpc",
		req,
		router: appRouter,
		createContext: () =>
			createTRPCContext({
				ip:
					req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
					undefined,
			}),
	});

export { handler as GET, handler as POST };
