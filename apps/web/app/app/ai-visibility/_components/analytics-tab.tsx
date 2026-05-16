"use client";

import type { AppRouter } from "@opencited/trpc";
import {
	Badge,
	Card,
	CardContent,
	EntityCard,
	EntityCardContent,
	EntityCardFooter,
	EntityCardHeader,
	EntityCardTitle,
	EntityCardValue,
	EntityCardSkeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@opencited/ui";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { AlertCircle, CheckCircle, Link, Quote, Target } from "lucide-react";
import { useTRPC } from "@/app/_trpc/client";
import { PromptQueryCrawlStatusBadge } from "@/app/components/prompt-query-crawl-status-badge";
import { QueryCell } from "@/app/components/query-cell";
import { TimeAgo } from "@/app/components/time-ago";
import { AnswerFormatBadge } from "./answer-format-badge";

type RouterOutput = inferRouterOutputs<AppRouter>;
type RunLog = RouterOutput["aiVisibility"]["listRunLogs"]["runs"][number];

interface AnalyticsTabProps {
	domainProjectId: string;
}

export function AnalyticsTab({ domainProjectId }: AnalyticsTabProps) {
	const trpc = useTRPC();

	const runLogsQuery = useQuery({
		...trpc.aiVisibility.listRunLogs.queryOptions({
			domainProjectId,
			limit: 100,
		}),
		enabled: !!domainProjectId,
	});

	return (
		<div className="space-y-6">
			<QueryCell
				query={runLogsQuery}
				loading={
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
						<EntityCardSkeleton hasFooter />
						<EntityCardSkeleton hasFooter />
						<EntityCardSkeleton hasFooter />
						<EntityCardSkeleton hasFooter />
					</div>
				}
				success={(data) => {
					const completedCrawls =
						data.runs.filter((r: RunLog) => r.status === "completed") ?? [];
					const failedCrawls =
						data.runs.filter((r: RunLog) => r.status === "failed") ?? [];
					const totalCrawls = data.runs.length ?? 0;

					const avgSources =
						completedCrawls.length > 0
							? Math.round(
									completedCrawls.reduce(
										(sum: number, r: RunLog) => sum + (r.sourceCount ?? 0),
										0,
									) / completedCrawls.length,
								)
							: 0;

					const avgMentions =
						completedCrawls.length > 0
							? Math.round(
									completedCrawls.reduce(
										(sum: number, r: RunLog) =>
											sum + (r.brandMentionCount ?? 0),
										0,
									) / completedCrawls.length,
								)
							: 0;

					const successRate =
						totalCrawls > 0
							? Math.round((completedCrawls.length / totalCrawls) * 100)
							: 0;

					const answerFormatDistribution = completedCrawls.reduce<
						Record<string, number>
					>((acc: Record<string, number>, crawl: RunLog) => {
						const fmt = crawl.answerFormat ?? "unknown";
						acc[fmt] = (acc[fmt] ?? 0) + 1;
						return acc;
					}, {});

					return (
						<>
							<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
								<EntityCard size="md">
									<EntityCardContent size="md">
										<EntityCardHeader
											icon={<Target className="h-4 w-4" />}
											iconPosition="right"
										>
											<EntityCardTitle>Total Crawls</EntityCardTitle>
										</EntityCardHeader>
										<EntityCardValue size="md">{totalCrawls}</EntityCardValue>
									</EntityCardContent>
									<EntityCardFooter size="md">All time</EntityCardFooter>
								</EntityCard>

								<EntityCard size="md">
									<EntityCardContent size="md">
										<EntityCardHeader
											icon={<Link className="h-4 w-4" />}
											iconPosition="right"
										>
											<EntityCardTitle>Avg Sources</EntityCardTitle>
										</EntityCardHeader>
										<EntityCardValue size="md">{avgSources}</EntityCardValue>
									</EntityCardContent>
									<EntityCardFooter size="md">
										Per completed crawl
									</EntityCardFooter>
								</EntityCard>

								<EntityCard size="md">
									<EntityCardContent size="md">
										<EntityCardHeader
											icon={<Quote className="h-4 w-4" />}
											iconPosition="right"
										>
											<EntityCardTitle>Avg Mentions</EntityCardTitle>
										</EntityCardHeader>
										<EntityCardValue size="md">{avgMentions}</EntityCardValue>
									</EntityCardContent>
									<EntityCardFooter size="md">
										Per completed crawl
									</EntityCardFooter>
								</EntityCard>

								<EntityCard size="md">
									<EntityCardContent size="md">
										<EntityCardHeader
											icon={<CheckCircle className="h-4 w-4" />}
											iconPosition="right"
										>
											<EntityCardTitle>Success Rate</EntityCardTitle>
										</EntityCardHeader>
										<EntityCardValue size="md">{successRate}%</EntityCardValue>
									</EntityCardContent>
									<EntityCardFooter size="md">
										{failedCrawls.length > 0 && (
											<span className="flex items-center gap-1">
												<AlertCircle className="h-3 w-3" />
												{failedCrawls.length} failed
											</span>
										)}
									</EntityCardFooter>
								</EntityCard>
							</div>

							{Object.keys(answerFormatDistribution).length > 0 && (
								<div>
									<h3 className="text-lg font-medium mb-3">
										Answer Format Distribution
									</h3>
									<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
										{Object.entries(answerFormatDistribution)
											.sort(
												([, a]: [string, number], [, b]: [string, number]) =>
													b - a,
											)
											.map(([fmt, count]) => (
												<Card key={fmt}>
													<CardContent className="p-4 flex items-center justify-between">
														<AnswerFormatBadge format={fmt} />
														<span className="text-2xl font-semibold">
															{count}
														</span>
													</CardContent>
												</Card>
											))}
									</div>
								</div>
							)}

							<div>
								<h3 className="text-lg font-medium mb-3">Recent Crawls</h3>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Query</TableHead>
											<TableHead>Provider</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-center">Sources</TableHead>
											<TableHead className="text-center">Mentions</TableHead>
											<TableHead>Format</TableHead>
											<TableHead className="text-right">Date</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{data.runs.slice(0, 20).map((run: RunLog) => (
											<TableRow key={run.id}>
												<TableCell className="font-medium max-w-[200px] truncate">
													{run.query}
												</TableCell>
												<TableCell>
													{run.provider ? (
														<Badge variant="outline">{run.provider}</Badge>
													) : (
														<span className="text-muted-foreground">N/A</span>
													)}
												</TableCell>
												<TableCell>
													<PromptQueryCrawlStatusBadge status={run.status} />
												</TableCell>
												<TableCell className="text-center">
													{run.sourceCount ?? 0}
												</TableCell>
												<TableCell className="text-center">
													{run.brandMentionCount ?? 0}
												</TableCell>
												<TableCell>
													<AnswerFormatBadge format={run.answerFormat} />
												</TableCell>
												<TableCell className="text-right text-xs text-muted-foreground">
													<TimeAgo date={run.createdAt} />
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</>
					);
				}}
			/>
		</div>
	);
}
