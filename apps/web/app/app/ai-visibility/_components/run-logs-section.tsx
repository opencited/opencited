"use client";

import type { AppRouter } from "@opencited/trpc";
import {
	Badge,
	Button,
	Card,
	CardContent,
	DataList,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Skeleton,
} from "@opencited/ui";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { format } from "date-fns";
import { AlertCircle, Calendar, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/app/_trpc/client";
import { PromptQueryCrawlStatusBadge } from "@/app/components/prompt-query-crawl-status-badge";
import { QueryCell } from "@/app/components/query-cell";
import { TimeAgo } from "@/app/components/time-ago";
import { CrawlDetailSheet } from "./crawl-detail-sheet";

type RunLog =
	inferRouterOutputs<AppRouter>["aiVisibility"]["listRunLogs"]["runs"][number];

interface RunLogsSectionProps {
	domainProjectId: string;
}

export function RunLogsSection({ domainProjectId }: RunLogsSectionProps) {
	const trpc = useTRPC();
	const [selectedRun, setSelectedRun] = useState<RunLog | null>(null);
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [providerFilter, setProviderFilter] = useState<string>("all");

	const runLogsQuery = useQuery({
		...trpc.aiVisibility.listRunLogs.queryOptions({
			domainProjectId,
			status:
				statusFilter !== "all"
					? (statusFilter as "pending" | "running" | "completed" | "failed")
					: undefined,
			provider: providerFilter !== "all" ? providerFilter : undefined,
			limit: 100,
		}),
		enabled: !!domainProjectId,
	});

	const providers = [
		...new Set(
			(runLogsQuery.data?.runs ?? [])
				.map((r) => r.provider)
				.filter(Boolean) as string[],
		),
	];

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<Select value={statusFilter} onValueChange={setStatusFilter}>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Filter by status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Statuses</SelectItem>
						<SelectItem value="completed">Completed</SelectItem>
						<SelectItem value="running">Running</SelectItem>
						<SelectItem value="pending">Pending</SelectItem>
						<SelectItem value="failed">Failed</SelectItem>
					</SelectContent>
				</Select>

				{providers.length > 0 && (
					<Select value={providerFilter} onValueChange={setProviderFilter}>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Filter by provider" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Providers</SelectItem>
							{providers.map((p) => (
								<SelectItem key={p} value={p}>
									{p}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}

				<Button
					variant="ghost"
					size="sm"
					onClick={() => runLogsQuery.refetch()}
					className="ml-auto"
				>
					<RefreshCw
						className={`h-3.5 w-3.5 ${runLogsQuery.isFetching ? "animate-spin" : ""}`}
					/>
					Refresh
				</Button>
			</div>

			<QueryCell
				query={runLogsQuery}
				loading={
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-20 w-full rounded-lg" />
						))}
					</div>
				}
				error={() => (
					<Card>
						<CardContent className="py-8 text-center">
							<p className="text-destructive">
								Couldn&apos;t load run logs. Try again.
							</p>
						</CardContent>
					</Card>
				)}
				success={(data) => {
					if (!data.runs || data.runs.length === 0) {
						return (
							<Card variant="dashed">
								<CardContent className="py-16 text-center">
									<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
										<AlertCircle className="h-6 w-6 text-muted-foreground" />
									</div>
									<h3 className="text-lg font-semibold mb-2">No run logs</h3>
									<p className="text-muted-foreground max-w-md mx-auto">
										{statusFilter !== "all" || providerFilter !== "all"
											? "No runs match your current filters. Try adjusting them."
											: "Run a prompt crawl to start seeing run logs here."}
									</p>
								</CardContent>
							</Card>
						);
					}

					return (
						<>
							<DataList<RunLog>
								items={data.runs}
								keyExtractor={(run) => run.id}
								emptyState={{
									title: "No runs match your filters",
									description: "Try adjusting the status or provider filter.",
								}}
								renderItem={(run) => (
									<button
										type="button"
										className="flex-1 min-w-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-left"
										onClick={() => setSelectedRun(run)}
									>
										<div className="flex items-start justify-between gap-4">
											<div className="flex-1 min-w-0 space-y-1.5">
												<div className="flex items-center gap-2 flex-wrap">
													<PromptQueryCrawlStatusBadge status={run.status} />
													<span className="text-sm font-medium truncate">
														{run.query}
													</span>
													{run.provider && (
														<Badge variant="outline" className="text-xs">
															{run.provider}
														</Badge>
													)}
												</div>
												<div className="flex items-center gap-4 text-xs text-muted-foreground">
													<div className="flex items-center gap-1">
														<Calendar className="h-3 w-3" />
														<span>
															{format(new Date(run.createdAt), "MMM d, h:mm a")}
														</span>
													</div>
													{run.completedAt && (
														<>
															<span className="text-muted-foreground">·</span>
															<span>
																Completed <TimeAgo date={run.completedAt} />
															</span>
														</>
													)}
													{run.status === "failed" && run.error && (
														<>
															<span className="text-muted-foreground">·</span>
															<span className="text-destructive truncate max-w-[200px]">
																{run.error}
															</span>
														</>
													)}
												</div>
											</div>
										</div>
									</button>
								)}
							/>

							{selectedRun && (
								<CrawlDetailSheet
									crawlId={selectedRun.id}
									queryId={selectedRun.promptQueryId}
									domainProjectId={domainProjectId}
									open={!!selectedRun}
									onOpenChange={(open) => {
										if (!open) setSelectedRun(null);
									}}
								/>
							)}
						</>
					);
				}}
			/>
		</div>
	);
}
