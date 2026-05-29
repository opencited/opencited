"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { makeQueryClient } from "./query-client";
import type { AppRouter } from "@opencited/trpc";
import { env } from "@/env";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
	if (typeof window === "undefined") {
		return makeQueryClient();
	}
	if (!browserQueryClient) browserQueryClient = makeQueryClient();
	return browserQueryClient;
}

function getUrl() {
	if (typeof window !== "undefined") return "";
	if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
	return "http://localhost:3000";
}

export function TRPCReactProvider({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const queryClient = getQueryClient();
	const [trpcClient] = useState(() =>
		createTRPCClient<AppRouter>({
			links: [httpBatchStreamLink({ url: `${getUrl()}/api/trpc` })],
		}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
				{children}
			</TRPCProvider>
			<TanStackDevtools
				config={{ position: "bottom-right", hideUntilHover: true }}
				eventBusConfig={{ connectToServerBus: true }}
				plugins={[
					{
						name: "TanStack Query",
						render: <ReactQueryDevtoolsPanel />,
						defaultOpen: true,
					},
				]}
			/>
		</QueryClientProvider>
	);
}
