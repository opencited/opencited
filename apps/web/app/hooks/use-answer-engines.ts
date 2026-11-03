"use client";

import type { AppRouter } from "@opencited/trpc";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useTRPC } from "@/app/_trpc/client";

export type AnswerEngine =
	inferRouterOutputs<AppRouter>["answerEngine"]["list"][number];

/**
 * The query stays fresh for 30 seconds and refetches on that interval and on
 * window focus. Together with the worker's 30 second cache, a database edit
 * shows up within about 60 seconds with no redeploy.
 */
export function useAnswerEngines() {
	const trpc = useTRPC();
	const query = useQuery({
		...trpc.answerEngine.list.queryOptions(),
		staleTime: 30_000,
		refetchOnWindowFocus: true,
		refetchInterval: 30_000,
	});

	const engines = query.data;
	const enabledEngines = engines?.filter((engine) => engine.enabled) ?? [];
	const defaultEngine = enabledEngines[0] ?? null;
	const allEnginesDisabled =
		engines !== undefined && enabledEngines.length === 0;

	return {
		query,
		engines,
		enabledEngines,
		defaultEngine,
		allEnginesDisabled,
	};
}
