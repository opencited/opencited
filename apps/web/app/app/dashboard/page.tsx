"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageShell } from "../../components/page-shell";
import { useTRPC } from "@/app/_trpc/client";
import { Button } from "@opencited/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@opencited/ui";
import { Database, Globe, Hash, ExternalLink, ArrowRight } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";

type RouterOutput = inferRouterOutputs<AppRouter>;
type DomainProject = RouterOutput["domainProject"]["get"];
type SitemapList = RouterOutput["sitemap"]["list"];
type UrlCount = RouterOutput["sitemap"]["getUrlCount"];

export default function DashboardPage() {
	const trpc = useTRPC();

	const { data: domainProject } = useQuery(
		trpc.domainProject.get.queryOptions(),
	);

	const { data: sitemaps } = useQuery(trpc.sitemap.list.queryOptions({}));

	const { data: urlCount } = useQuery(trpc.sitemap.getUrlCount.queryOptions());

	return (
		<PageShell title="Dashboard">
			<div className="space-y-6">
				<div>
					<h2 className="text-lg font-medium mb-2">Project Overview</h2>
					<div className="grid gap-4 md:grid-cols-3">
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium flex items-center gap-2">
									<Globe className="h-4 w-4" />
									Domain
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{(domainProject as DomainProject)?.domain || "N/A"}
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium flex items-center gap-2">
									<Database className="h-4 w-4" />
									Sitemaps
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{(sitemaps as SitemapList)?.length ?? 0}
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium flex items-center gap-2">
									<Hash className="h-4 w-4" />
									Total URLs
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{(urlCount as UrlCount)?.count.toLocaleString() ?? 0}
								</div>
							</CardContent>
						</Card>
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

					{sitemaps && (sitemaps as SitemapList).length > 0 ? (
						<div className="border rounded-lg divide-y">
							{(sitemaps as SitemapList)
								.slice(0, 5)
								.map((sitemap: SitemapList[number]) => (
									<div
										key={sitemap.id}
										className="p-4 flex items-center justify-between"
									>
										<div className="flex items-center gap-3 min-w-0">
											<Globe className="h-5 w-5 text-muted-foreground shrink-0" />
											<span className="font-mono text-sm truncate">
												{sitemap.url}
											</span>
										</div>
										<Button variant="ghost" size="sm" asChild>
											<Link href={`/app/sitemaps/${sitemap.id}`}>
												View URLs
												<ExternalLink className="ml-1 h-4 w-4" />
											</Link>
										</Button>
									</div>
								))}
						</div>
					) : (
						<Card>
							<CardContent className="py-8 text-center text-muted-foreground">
								No sitemaps yet. Go to onboarding to add one.
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</PageShell>
	);
}
