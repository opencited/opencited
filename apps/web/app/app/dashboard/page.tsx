"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import {
	EntityCard,
	EntityCardHeader,
	EntityCardTitle,
	EntityCardValue,
	EntityCardContent,
	EntityCardFooter,
	EntityCardSkeleton,
} from "@opencited/ui";
import { QueryCell } from "@/app/components/query-cell";
import { Target, FileText, CheckCircle, Type, AlertCircle } from "lucide-react";
import { PageShell } from "@/app/components/page-shell";
import { useDomainProject } from "@/app/components/domain-project-provider";
import { VisibilityScoreCard } from "./visibility-score-card";

function StatCard({
	icon: Icon,
	label,
	value,
	description,
}: {
	icon: React.ElementType;
	label: string;
	value: React.ReactNode;
	description?: string;
}) {
	return (
		<EntityCard size="md">
			<EntityCardContent size="md">
				<EntityCardHeader
					icon={<Icon className="h-4 w-4" />}
					iconPosition="right"
				>
					<EntityCardTitle>{label}</EntityCardTitle>
				</EntityCardHeader>
				<EntityCardValue size="md">{value}</EntityCardValue>
			</EntityCardContent>
			{description && (
				<EntityCardFooter size="md">{description}</EntityCardFooter>
			)}
		</EntityCard>
	);
}

export default function DashboardPage() {
	const trpc = useTRPC();
	const domainProject = useDomainProject();

	const visibilityAggregateQuery = useQuery({
		...trpc.dashboard.getVisibilityAggregate.queryOptions({
			domainProjectId: domainProject.id,
		}),
		refetchInterval: 30000,
	});

	const visibilityMetricsQuery = useQuery({
		...trpc.dashboard.getVisibilityMetrics.queryOptions({
			domainProjectId: domainProject.id,
		}),
	});

	const contentHealthQuery = useQuery({
		...trpc.dashboard.getContentHealth.queryOptions({
			domainProjectId: domainProject.id,
		}),
	});

	return (
		<PageShell title="Dashboard">
			<div className="space-y-6">
				<div>
					<h2 className="text-lg font-medium mb-2">AI Visibility</h2>
					<QueryCell
						query={visibilityAggregateQuery}
						loading={
							<div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-[360px_200px]">
								<EntityCardSkeleton />
								<EntityCardSkeleton hasFooter />
							</div>
						}
						success={(aggregate) => (
							<div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-[360px_200px]">
								<VisibilityScoreCard
									crossEngineScore={aggregate.crossEngineScore}
									perBrandPerEngineScores={aggregate.perBrandPerEngineScores}
									trend={aggregate.trend}
									totalCompletedCrawls={aggregate.totalCompletedCrawls}
									activeCompetitorCount={aggregate.activeCompetitorCount}
									maxCrawlsPerEngine={aggregate.maxCrawlsPerEngine}
								/>
								<StatCard
									icon={Target}
									label="Cited in queries"
									value={
										visibilityMetricsQuery.data ? (
											<span>
												<span>
													{visibilityMetricsQuery.data.citedInRatio.cited}
												</span>
												<span className="text-sm text-muted-foreground ml-1">
													of {visibilityMetricsQuery.data.citedInRatio.total}
												</span>
											</span>
										) : (
											"—"
										)
									}
									description="Queries where your brand appears"
								/>
							</div>
						)}
					/>
				</div>

				<div>
					<h2 className="text-lg font-medium mb-2">Content Health</h2>
					<QueryCell
						query={contentHealthQuery}
						loading={
							<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[repeat(4,200px)]">
								{[1, 2, 3, 4].map((i) => (
									<EntityCardSkeleton key={i} hasFooter />
								))}
							</div>
						}
						success={(metrics) => {
							if (!metrics) return null;
							return (
								<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[repeat(4,200px)]">
									<StatCard
										icon={FileText}
										label="Pages Crawled"
										value={metrics.pagesCrawled}
										description="Pages fetched or analyzed"
									/>
									<StatCard
										icon={CheckCircle}
										label="Crawl Success Rate"
										value={
											metrics.crawlSuccessRate !== null
												? `${metrics.crawlSuccessRate}%`
												: "—"
										}
										description="Of attempted pages"
									/>
									<StatCard
										icon={Type}
										label="Avg Word Count"
										value={
											metrics.avgWordCount !== null
												? Math.round(metrics.avgWordCount).toLocaleString()
												: "—"
										}
										description="Per analyzed page"
									/>
									<StatCard
										icon={AlertCircle}
										label="Errors"
										value={metrics.errorCount}
										description="Pages that failed to crawl"
									/>
								</div>
							);
						}}
					/>
				</div>
			</div>
		</PageShell>
	);
}
