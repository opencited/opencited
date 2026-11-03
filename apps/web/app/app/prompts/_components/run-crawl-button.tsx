"use client";

import { Button, Spinner } from "@opencited/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/app/_trpc/client";
import { AnswerEnginePicker } from "@/app/components/answer-engine-picker";
import { useActiveCrawls } from "@/app/hooks/use-active-crawls";
import {
	type AnswerEngine,
	useAnswerEngines,
} from "@/app/hooks/use-answer-engines";
import { useConfirmation } from "@/app/hooks/use-confirmation";

interface RunCrawlButtonProps {
	promptQueryId: string;
	domainProjectId: string;
}

export function RunCrawlButton({
	promptQueryId,
	domainProjectId,
}: RunCrawlButtonProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectedProvider, setSelectedProvider] = useState<
		AnswerEngine["key"] | null
	>(null);
	const { confirm, dialog } = useConfirmation();
	const { engines, defaultEngine, allEnginesDisabled, query } =
		useAnswerEngines();

	const { activeCrawls } = useActiveCrawls({
		domainProjectId,
	});

	const isRunning = activeCrawls.some(
		(crawl) => crawl.promptQueryId === promptQueryId,
	);

	useEffect(() => {
		if (!engines) return;
		const selected = engines.find((engine) => engine.key === selectedProvider);
		if (selected?.enabled) return;
		setSelectedProvider(defaultEngine?.key ?? null);
	}, [engines, selectedProvider, defaultEngine]);

	const startCrawlMutation = useMutation(
		trpc.promptQueryCrawl.start.mutationOptions({
			onMutate: async () => {
				setIsSubmitting(true);
			},
			onSuccess: async () => {
				toast.success("Crawl started", {
					description: "Running crawl in background...",
				});
				queryClient.invalidateQueries({
					queryKey: trpc.promptQueryCrawl.list.queryKey({
						domainProjectId,
						status: ["pending", "running"],
					}),
				});
			},
			onSettled: () => {
				setIsSubmitting(false);
			},
			onError: (error) => {
				toast.error("Failed to start crawl", {
					description: error.message,
				});
			},
		}),
	);

	const handleClick = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isRunning || isSubmitting || allEnginesDisabled || !selectedProvider) {
			return;
		}

		const selected = engines?.find((engine) => engine.key === selectedProvider);
		if (!selected?.enabled) {
			toast.error("This engine is unavailable", {
				description: selected?.disabledReason ?? undefined,
			});
			return;
		}

		const confirmed = await confirm({
			title: "Run Crawl",
			description:
				"Are you sure you want to run a crawl for this prompt? This will fetch data from AI answer engines and may take a few moments.",
			confirmLabel: "Run Crawl",
		});

		if (!confirmed) return;
		startCrawlMutation.mutate({
			promptQueryId,
			provider: selected.key,
		});
	};

	const runsPaused = allEnginesDisabled || query.isError;
	const canRun =
		!isRunning &&
		!isSubmitting &&
		!runsPaused &&
		selectedProvider !== null &&
		!query.isLoading;

	return (
		<>
			<div className="flex items-center gap-2">
				{engines && engines.length > 0 ? (
					<AnswerEnginePicker
						engines={engines}
						value={selectedProvider}
						onChange={setSelectedProvider}
					/>
				) : null}
				<Button
					variant="outline"
					size="sm"
					onClick={handleClick}
					onKeyDown={(e) => e.stopPropagation()}
					disabled={!canRun}
					className="gap-2 run-crawl-btn"
				>
					{(isRunning || isSubmitting) && <Spinner className="h-3 w-3" />}
					{isRunning || isSubmitting ? "Running..." : "Run Crawl"}
				</Button>
			</div>
			{dialog}
		</>
	);
}
