"use client";

import {
	Badge,
	Button,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Spinner,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@opencited/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/app/_trpc/client";
import { useActiveCrawls } from "@/app/hooks/use-active-crawls";
import {
	type AnswerEngine,
	useAnswerEngines,
} from "@/app/hooks/use-answer-engines";
import { useConfirmation } from "@/app/hooks/use-confirmation";

function stopCardActivation(event: React.SyntheticEvent) {
	event.stopPropagation();
}

function PromptEngineSelect({
	engines,
	value,
	onChange,
}: {
	engines: AnswerEngine[];
	value: AnswerEngine["key"] | null;
	onChange: (key: AnswerEngine["key"]) => void;
}) {
	const orderedEngines = [...engines].sort(
		(a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key),
	);

	return (
		<Select
			value={value ?? ""}
			onValueChange={(next) => {
				const engine = orderedEngines.find((item) => item.key === next);
				if (!engine?.enabled) return;
				onChange(engine.key);
			}}
		>
			<SelectTrigger
				aria-label="Answer engine"
				className="h-8 w-[120px] shrink-0 px-2 text-xs"
			>
				<SelectValue placeholder="Engine" />
			</SelectTrigger>
			<SelectContent position="item-aligned" className="w-[260px]">
				<TooltipProvider delayDuration={0}>
					{orderedEngines.map((engine) =>
						engine.enabled ? (
							<SelectItem key={engine.key} value={engine.key}>
								{engine.displayName}
							</SelectItem>
						) : (
							<SelectItem
								key={engine.key}
								value={engine.key}
								disabled
								className="data-[disabled]:cursor-default data-[disabled]:pointer-events-auto data-[disabled]:opacity-100"
							>
								<span className="flex w-full items-center justify-between gap-2">
									<span className="flex min-w-0 items-center gap-2">
										<span className="truncate text-muted-foreground">
											{engine.displayName}
										</span>
										<Badge variant="secondary" size="sm">
											Unavailable
										</Badge>
									</span>
									{engine.disabledReason ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<span className="absolute top-1/2 right-2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-muted-foreground">
													<Info aria-hidden="true" className="h-3.5 w-3.5" />
													<span className="sr-only">
														{engine.disabledReason}
													</span>
												</span>
											</TooltipTrigger>
											<TooltipContent side="right">
												<p className="max-w-xs text-xs">
													{engine.disabledReason}
												</p>
											</TooltipContent>
										</Tooltip>
									) : null}
								</span>
							</SelectItem>
						),
					)}
				</TooltipProvider>
			</SelectContent>
		</Select>
	);
}

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

	const handleClick = async () => {
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
			<div
				className="flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2"
				onClick={stopCardActivation}
				onPointerDown={stopCardActivation}
				onKeyDown={stopCardActivation}
			>
				{engines && engines.length > 0 ? (
					<PromptEngineSelect
						engines={engines}
						value={selectedProvider}
						onChange={setSelectedProvider}
					/>
				) : null}
				<Button
					variant="outline"
					size="sm"
					onClick={handleClick}
					disabled={!canRun}
					className="shrink-0 gap-2 run-crawl-btn"
				>
					{(isRunning || isSubmitting) && <Spinner className="h-3 w-3" />}
					{isRunning || isSubmitting ? "Running..." : "Run Crawl"}
				</Button>
			</div>
			{dialog}
		</>
	);
}
