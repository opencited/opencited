"use client";

import type { AppRouter } from "@opencited/trpc";
import {
	Badge,
	Button,
	Card,
	CardContent,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@opencited/ui";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { format } from "date-fns";
import {
	AlertCircle,
	AtSign,
	Calendar,
	Check,
	Clock,
	FileText,
	RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/app/_trpc/client";
import { PromptQueryCrawlStatusBadge } from "@/app/components/prompt-query-crawl-status-badge";
import { QueryCell } from "@/app/components/query-cell";
import { formatDuration } from "@/lib/utils";
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

	const runLogsQuery = useQuery({
		...trpc.aiVisibility.listRunLogs.queryOptions({
			domainProjectId,
			status:
				statusFilter !== "all"
					? (statusFilter as "pending" | "running" | "completed" | "failed")
					: undefined,
			limit: 100,
		}),
		enabled: !!domainProjectId,
	});

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
					<div className="border border-border/40 rounded-lg overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[120px] whitespace-nowrap">
										Created
									</TableHead>
									<TableHead className="w-[100px]">Status</TableHead>
									<TableHead className="w-[70px]">Cited</TableHead>
									<TableHead>Query</TableHead>
									<TableHead className="w-[100px]">Provider</TableHead>
									<TableHead className="w-[90px] text-right">Sources</TableHead>
									<TableHead className="w-[100px] text-right">
										Mentions
									</TableHead>
									<TableHead className="w-[90px] text-right">
										Duration
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{[1, 2, 3].map((i) => (
									<TableRow key={i}>
										<TableCell>
											<Skeleton className="h-4 w-24" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-6 w-20 rounded-full" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-4" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-full max-w-[300px]" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-6 w-16 rounded-full" />
										</TableCell>
										<TableCell className="text-right">
											<Skeleton className="h-4 w-8 ml-auto" />
										</TableCell>
										<TableCell className="text-right">
											<Skeleton className="h-4 w-8 ml-auto" />
										</TableCell>
										<TableCell className="text-right">
											<Skeleton className="h-4 w-12 ml-auto" />
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
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
										{statusFilter !== "all"
											? "No runs match your current filters. Try adjusting them."
											: "Run a prompt crawl to start seeing run logs here."}
									</p>
								</CardContent>
							</Card>
						);
					}

					return (
						<>
							<div className="border border-border/40 rounded-lg overflow-hidden">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-[120px] whitespace-nowrap">
												Created
											</TableHead>
											<TableHead className="w-[100px]">Status</TableHead>
											<TableHead className="w-[70px]">Cited</TableHead>
											<TableHead>Query</TableHead>
											<TableHead className="w-[100px]">Provider</TableHead>
											<TableHead className="w-[90px] text-right">
												Sources
											</TableHead>
											<TableHead className="w-[100px] text-right">
												Mentions
											</TableHead>
											<TableHead className="w-[90px] text-right">
												Duration
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{data.runs.map((run) => (
											<TableRow
												key={run.id}
												className="cursor-pointer"
												onClick={() => setSelectedRun(run)}
											>
												<TableCell className="whitespace-nowrap">
													<div className="flex items-center gap-1.5 text-muted-foreground">
														<Calendar className="h-3.5 w-3.5 shrink-0" />
														<span className="text-sm">
															{format(new Date(run.createdAt), "MMM d, h:mm a")}
														</span>
													</div>
												</TableCell>
												<TableCell>
													<PromptQueryCrawlStatusBadge status={run.status} />
												</TableCell>
												<TableCell>
													{run.cited && (
														<Check className="h-4 w-4 text-emerald-500" />
													)}
												</TableCell>
												<TableCell className="font-medium max-w-[300px]">
													<span className="truncate block" title={run.query}>
														{run.query}
													</span>
												</TableCell>
												<TableCell>
													{run.provider && (
														<Badge variant="outline" className="text-xs">
															{run.provider}
														</Badge>
													)}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-1.5 text-muted-foreground">
														<FileText className="h-3.5 w-3.5" />
														<span className="tabular-nums text-sm">
															{run.sourceCount ?? 0}
														</span>
													</div>
												</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-1.5 text-muted-foreground">
														<AtSign className="h-3.5 w-3.5" />
														<span className="tabular-nums text-sm">
															{run.brandMentionCount ?? 0}
														</span>
													</div>
												</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-1.5 text-muted-foreground">
														<Clock className="h-3.5 w-3.5" />
														<span className="tabular-nums text-sm">
															{formatDuration(run.startedAt, run.completedAt)}
														</span>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

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
