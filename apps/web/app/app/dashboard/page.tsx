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
import {
	Target,
	MessageSquare,
	FileText,
	CheckCircle,
	Type,
	AlertCircle,
} from "lucide-react";
import { PageShell } from "@/app/components/page-shell";

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

	const domainProjectQuery = useQuery(trpc.domainProject.get.queryOptions());
	const domainProject = domainProjectQuery.data;

	const visibilityMetricsQuery = useQuery({
		...trpc.dashboard.getVisibilityMetrics.queryOptions({
			domainProjectId: domainProject?.id ?? "",
		}),
		enabled: !!domainProject?.id,
	});

	const contentHealthQuery = useQuery({
		...trpc.dashboard.getContentHealth.queryOptions({
			domainProjectId: domainProject?.id ?? "",
		}),
		enabled: !!domainProject?.id,
	});

	return (
		<PageShell title="Dashboard">
			<div className="space-y-6">
				<div>
					<h2 className="text-lg font-medium mb-2">AI Visibility</h2>
					<QueryCell
						query={visibilityMetricsQuery}
						loading={
							<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[repeat(4,200px)]">
								{[1, 2].map((i) => (
									<EntityCardSkeleton key={i} hasFooter />
								))}
							</div>
						}
						success={(metrics) => {
							if (!metrics) return null;
							return (
								<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[repeat(4,200px)]">
									<StatCard
										icon={Target}
										label="Cited in queries"
										value={
											<span>
												<span>{metrics.citedInRatio.cited}</span>
												<span className="text-sm text-muted-foreground ml-1">
													of {metrics.citedInRatio.total}
												</span>
											</span>
										}
										description="Queries where your brand appears"
									/>
									<StatCard
										icon={MessageSquare}
										label="Brand mentions"
										value={metrics.brandMentionCount}
										description="Total target mentions"
									/>
								</div>
							);
						}}
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
