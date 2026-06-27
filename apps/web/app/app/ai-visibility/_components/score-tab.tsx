"use client";

import type { ReactNode } from "react";
import {
	Badge,
	Button,
	Spinner,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@opencited/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/app/_trpc/client";
import { QueryCell } from "@/app/components/query-cell";

interface ScoreTabProps {
	crawlId: string;
}

interface SubScoreRowProps {
	label: string;
	value: number;
	tooltip: string;
	badge?: ReactNode;
	footer?: ReactNode;
}

const TIER_CLASSES = {
	high: "bg-emerald-500/10 dark:bg-emerald-500/20",
	mid: "bg-amber-500/10 dark:bg-amber-500/20",
	low: "bg-muted",
} as const;

function getScoreTier(value: number): "high" | "mid" | "low" {
	if (value >= 70) return "high";
	if (value >= 40) return "mid";
	return "low";
}

function InfoButton({ label }: { label: string }) {
	return (
		<TooltipProvider delayDuration={0}>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						aria-label={`More info about ${label}`}
						className="p-1.5 text-muted-foreground hover:text-foreground active:opacity-60 transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					>
						<Info className="h-3 w-3" />
					</button>
				</TooltipTrigger>
				<TooltipContent side="right" className="max-w-[200px]">
					<p>{label}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function SubScoreRow({
	label,
	value,
	tooltip,
	badge,
	footer,
}: SubScoreRowProps) {
	const tier = getScoreTier(value);

	return (
		<div className="py-2.5 grid grid-cols-[minmax(100px,auto)_1fr_auto] items-center gap-x-3">
			<div className="flex items-center gap-1.5">
				<span className="text-sm">{label}</span>
				<InfoButton label={tooltip} />
				{badge}
			</div>
			<div
				className="h-1.5 rounded-full bg-muted overflow-hidden"
				role="progressbar"
				aria-valuenow={value}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={`${label} score: ${value} out of 100`}
			>
				<div
					className={`h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none ${TIER_CLASSES[tier]}`}
					style={{ width: `${value}%` }}
				/>
			</div>
			<span className="text-sm font-medium tabular-nums w-9 text-right">
				{value}
			</span>
			{footer && <div className="col-start-2 col-span-2 mt-2">{footer}</div>}
		</div>
	);
}

export function ScoreTab({ crawlId }: ScoreTabProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const scoreQuery = useQuery({
		...trpc.aiVisibility.getCrawlScore.queryOptions({ crawlId }),
	});

	const retryMutation = useMutation(
		trpc.aiVisibility.retrySentiment.mutationOptions({
			onMutate: async () => {
				await queryClient.cancelQueries({
					queryKey: trpc.aiVisibility.getCrawlScore.queryKey({
						crawlId,
					}),
				});

				const previous = queryClient.getQueryData(
					trpc.aiVisibility.getCrawlScore.queryKey({ crawlId }),
				);

				if (previous) {
					queryClient.setQueryData(
						trpc.aiVisibility.getCrawlScore.queryKey({ crawlId }),
						{
							...previous,
							sentimentIsFallback: false,
						},
					);
				}

				return { previous };
			},
			onSuccess: (data) => {
				const queryKey = trpc.aiVisibility.getCrawlScore.queryKey({
					crawlId,
				});
				const prev = queryClient.getQueryData(queryKey);
				if (prev) {
					queryClient.setQueryData(queryKey, {
						...prev,
						...data.row,
					});
				}
				if (data.recovered) {
					toast.success("Sentiment analysis updated");
				} else {
					toast.error("Sentiment analysis still pending", {
						description: "The retry did not recover a definitive label.",
					});
				}
			},
			onError: (error) => {
				toast.error("Retry failed", {
					description: error.message,
				});
			},
			onSettled: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.aiVisibility.getCrawlScore.queryKey({
						crawlId,
					}),
				});
			},
		}),
	);

	return (
		<QueryCell
			query={scoreQuery}
			loading={
				<div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
					<Spinner className="size-4" />
					<span>Loading score...</span>
				</div>
			}
			success={(data) => {
				if (!data) {
					return (
						<div className="py-12 text-center">
							<p className="text-sm text-muted-foreground mb-1">
								No score available yet
							</p>
							<p className="text-xs text-muted-foreground">
								Scores are calculated after a crawl completes
							</p>
						</div>
					);
				}

				const sentimentFooter = data.sentimentIsFallback ? (
					<Button
						variant="outline"
						size="sm"
						className="gap-2"
						disabled={retryMutation.isPending}
						onClick={() => retryMutation.mutate({ crawlId })}
					>
						{retryMutation.isPending ? (
							<>
								<Spinner className="h-3 w-3" />
								Retrying...
							</>
						) : (
							<>
								<RefreshCw className="h-3 w-3" />
								Retry sentiment analysis
							</>
						)}
					</Button>
				) : null;

				return (
					<div>
						<div className="flex items-baseline justify-between">
							<div>
								<p className="text-xs text-muted-foreground mb-0.5">
									Composite Score
								</p>
								<div className="flex items-baseline gap-2">
									<span className="text-2xl font-semibold tabular-nums">
										{data.visibilityScore}
									</span>
									<span className="text-xs text-muted-foreground font-mono">
										{data.formulaVersion}
									</span>
								</div>
							</div>
							<TooltipProvider delayDuration={0}>
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											type="button"
											aria-label="More info about composite score formula"
											className="p-1.5 text-muted-foreground hover:text-foreground active:opacity-60 transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
										>
											<Info className="h-4 w-4" />
										</button>
									</TooltipTrigger>
									<TooltipContent side="left" className="max-w-[240px]">
										<p className="mb-1.5">Weighted average of 5 sub-scores:</p>
										<ul className="space-y-0.5 text-xs">
											<li>Mention (35%)</li>
											<li>Position (25%)</li>
											<li>Citation (20%)</li>
											<li>Sentiment (10%)</li>
											<li>Co-mention (10%)</li>
										</ul>
										<p className="text-xs text-muted-foreground mt-2">
											Range: 0-100
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>

						<div className="mt-5">
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
								Sub-scores
							</p>
							<div className="divide-y divide-border/60">
								<SubScoreRow
									label="Mention"
									value={data.mentionScore}
									tooltip="Whether your brand appears in the response at all"
								/>
								<SubScoreRow
									label="Position"
									value={data.positionScore}
									tooltip="How prominently your brand is positioned (earlier = better)"
								/>
								<SubScoreRow
									label="Citation"
									value={data.citationScore}
									tooltip="Whether your domain is cited as a source"
								/>
								<SubScoreRow
									label="Sentiment"
									value={data.sentimentScore}
									tooltip="Whether the response tone toward your brand is positive, neutral, or negative"
									badge={
										data.sentimentIsFallback ? (
											<Badge variant="warning" size="sm">
												Pending retry
											</Badge>
										) : undefined
									}
									footer={sentimentFooter}
								/>
								<SubScoreRow
									label="Co-mention"
									value={data.coMentionScore}
									tooltip="The ratio of your brand mentions vs. competitor mentions"
								/>
							</div>
						</div>
					</div>
				);
			}}
		/>
	);
}
