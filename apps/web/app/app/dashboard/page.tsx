"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import {
	Button,
	Skeleton,
	EntityCard,
	EntityCardHeader,
	EntityCardTitle,
	EntityCardValue,
	EntityCardContent,
	EntityCardFooter,
} from "@opencited/ui";
import { DataList } from "@opencited/ui";
import { QueryCell } from "@/app/components/query-cell";
import { Globe, Database, Hash, ArrowRight } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";
import Link from "next/link";
import { PageShell } from "@/app/components/page-shell";
import { timeAgo } from "@/lib/time-ago";

type RouterOutput = inferRouterOutputs<AppRouter>;
type DomainProject = RouterOutput["domainProject"]["get"];
type SitemapList = RouterOutput["sitemap"]["list"];
type UrlCount = RouterOutput["sitemap"]["getUrlCount"];

function StatCard({
	icon: Icon,
	label,
	value,
	description,
	isLoading,
}: {
	icon: React.ElementType;
	label: string;
	value: React.ReactNode;
	description?: string;
	isLoading?: boolean;
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
				{isLoading ? (
					<Skeleton className="h-8 w-20 mt-3" />
				) : (
					<EntityCardValue size="md">{value}</EntityCardValue>
				)}
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
	const sitemapsQuery = useQuery(trpc.sitemap.list.queryOptions({}));
	const urlCountQuery = useQuery(trpc.sitemap.getUrlCount.queryOptions());

	return (
		<PageShell title="Dashboard">
			<div className="space-y-6">
				<div>
					<h2 className="text-lg font-medium mb-2">Project Overview</h2>
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[repeat(5,200px)]">
						<QueryCell
							query={domainProjectQuery}
							success={(domainProject) => (
								<StatCard
									icon={Globe}
									label="Domain"
									value={(domainProject as DomainProject)?.domain || "N/A"}
									description="Your project domain"
								/>
							)}
						/>
						<QueryCell
							query={sitemapsQuery}
							success={(sitemaps) => (
								<StatCard
									icon={Database}
									label="Sitemaps"
									value={(sitemaps as SitemapList)?.length ?? 0}
									description="Sitemaps indexed"
								/>
							)}
						/>
						<QueryCell
							query={urlCountQuery}
							success={(urlCount) => (
								<StatCard
									icon={Hash}
									label="Total URLs"
									value={(urlCount as UrlCount)?.count.toLocaleString() ?? 0}
									description="URLs discovered"
								/>
							)}
						/>
					</div>
				</div>

				<div>
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium">Recent Sitemaps</h2>
						<Button variant="ghost" size="sm" asChild>
							<Link href="/app/sitemaps">
								View All
								<ArrowRight className="ml-1 h-4 w-4" />
							</Link>
						</Button>
					</div>

					<QueryCell<SitemapList>
						query={sitemapsQuery}
						success={(sitemaps) => (
							<DataList
								items={sitemaps.slice(0, 5)}
								keyExtractor={(sitemap) => sitemap.id}
								renderItem={(sitemap) => (
									<Link
										href={`/app/sitemaps/${sitemap.id}`}
										className="flex items-center justify-between gap-4 w-full"
									>
										<div className="flex items-center gap-3 min-w-0">
											<Globe className="h-5 w-5 text-muted-foreground shrink-0" />
											<span className="font-mono text-sm truncate text-foreground">
												{sitemap.url}
											</span>
										</div>
										<span className="text-xs text-muted-foreground shrink-0">
											{timeAgo(sitemap.createdAt)}
										</span>
									</Link>
								)}
								emptyState={{
									title: "No sitemaps yet",
									description: "Go to onboarding to add one.",
								}}
							/>
						)}
					/>
				</div>
			</div>
		</PageShell>
	);
}
