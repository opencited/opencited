"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { PageShell } from "@/app/components/page-shell";
import { QueryCell } from "@/app/components/query-cell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@opencited/ui";
import {
	EntityCard,
	EntityCardHeader,
	EntityCardTitle,
	EntityCardValue,
	EntityCardContent,
	EntityCardSkeleton,
} from "@opencited/ui";
import { Target, Users, TrendingUp } from "lucide-react";
import { CompetitorIntelligence } from "./_components/competitor-intelligence";
import { EmptyState } from "./_components/empty-state";
import { VisibilityTable } from "./_components/visibility-table";
import { useState } from "react";

function TabStatCard({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ElementType;
	label: string;
	value: React.ReactNode;
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
		</EntityCard>
	);
}

export default function AIVisibilityPage() {
	const trpc = useTRPC();
	const [activeTab, setActiveTab] = useState("queries");

	const domainProjectQuery = useQuery(trpc.domainProject.get.queryOptions());
	const domainProject = domainProjectQuery.data;

	const overviewQuery = useQuery({
		...trpc.aiVisibility.getVisibilityOverview.queryOptions({
			domainProjectId: domainProject?.id ?? "",
		}),
		enabled: !!domainProject?.id,
	});

	const competitorQuery = useQuery({
		...trpc.aiVisibility.getCompetitorIntelligence.queryOptions({
			domainProjectId: domainProject?.id ?? "",
		}),
		enabled: !!domainProject?.id && activeTab === "competitors",
	});

	if (!domainProject) {
		return (
			<PageShell title="AI Visibility">
				<div className="flex items-center justify-center py-12">
					<p className="text-muted-foreground">
						Please create a domain project first
					</p>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell title="AI Visibility">
			<p className="text-sm text-muted-foreground mb-6">
				Track where your brand appears in AI answers
			</p>
			<QueryCell
				query={overviewQuery}
				loading={
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-12 bg-muted rounded-lg" />
						))}
					</div>
				}
				success={(data) => {
					if (!data || data.length === 0) {
						return <EmptyState />;
					}

					const totalQueries = data.length;
					const citedCount = data.filter((r) => r.cited).length;

					return (
						<Tabs
							value={activeTab}
							onValueChange={setActiveTab}
							className="space-y-6"
						>
							<TabsList className="justify-start w-fit">
								<TabsTrigger value="queries">Queries</TabsTrigger>
								<TabsTrigger value="competitors">Competitors</TabsTrigger>
							</TabsList>

							<TabsContent value="queries" className="mt-0 space-y-4">
								<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
									<TabStatCard
										icon={Target}
										label="Total Queries"
										value={totalQueries}
									/>
									<TabStatCard
										icon={TrendingUp}
										label="Cited Count"
										value={citedCount}
									/>
								</div>
								<VisibilityTable
									data={data}
									domainProjectId={domainProject.id}
								/>
							</TabsContent>

							<TabsContent value="competitors" className="mt-0 space-y-4">
								<QueryCell
									query={competitorQuery}
									loading={
										<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
											{[1, 2].map((i) => (
												<EntityCardSkeleton key={i} />
											))}
										</div>
									}
									success={(competitors) => {
										const totalCompetitors = competitors?.length ?? 0;
										const beforeYouCount =
											competitors?.reduce(
												(sum, c) => sum + c.appearsBeforeYouCount,
												0,
											) ?? 0;

										return (
											<>
												<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
													<TabStatCard
														icon={Users}
														label="Total Competitors"
														value={totalCompetitors}
													/>
													<TabStatCard
														icon={TrendingUp}
														label="Before You"
														value={beforeYouCount}
													/>
												</div>
												<CompetitorIntelligence
													domainProjectId={domainProject.id}
												/>
											</>
										);
									}}
								/>
							</TabsContent>
						</Tabs>
					);
				}}
			/>
		</PageShell>
	);
}
