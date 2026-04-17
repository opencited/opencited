"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { PageShell } from "@/app/components/page-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@opencited/ui";
import { Badge } from "@opencited/ui";
import { ExternalLink, Loader2, Calendar, RefreshCw, Hash } from "lucide-react";
import { useParams } from "next/navigation";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";

type RouterOutput = inferRouterOutputs<AppRouter>;
type SitemapUrlList = RouterOutput["sitemap"]["listUrls"];

export default function SitemapDetailPage() {
	const trpc = useTRPC();
	const params = useParams();
	const sitemapId = params.sitemapId as string;

	const { data: urls, isLoading } = useQuery(
		trpc.sitemap.listUrls.queryOptions({ sitemapId }),
	);

	if (isLoading) {
		return (
			<PageShell title="Sitemap URLs">
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			</PageShell>
		);
	}

	const urlList = urls as SitemapUrlList | undefined;

	return (
		<PageShell
			title="Sitemap URLs"
			backHref="/app/sitemaps"
			backLabel="Back to Sitemaps"
		>
			<div className="space-y-4">
				<p className="text-sm text-muted-foreground">
					{urlList?.length ?? 0} URL{urlList?.length !== 1 ? "s" : ""} in this
					sitemap
				</p>

				{!urlList || urlList.length === 0 ? (
					<Card>
						<CardHeader>
							<CardTitle>No URLs Found</CardTitle>
							<CardDescription>
								This sitemap doesn&apos;t contain any URLs yet.
							</CardDescription>
						</CardHeader>
					</Card>
				) : (
					<div className="border rounded-lg divide-y">
						{urlList.map((urlItem: SitemapUrlList[number]) => (
							<div
								key={urlItem.id}
								className="p-4 flex items-start justify-between gap-4"
							>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-1">
										<a
											href={urlItem.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-sm font-mono truncate hover:text-primary"
										>
											{urlItem.url}
										</a>
										<a
											href={urlItem.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-muted-foreground hover:text-primary shrink-0"
										>
											<ExternalLink className="h-4 w-4" />
										</a>
									</div>
									<div className="flex flex-wrap gap-2 mt-2">
										{urlItem.lastmod && (
											<Badge variant="secondary" className="text-xs gap-1">
												<Calendar className="h-3 w-3" />
												{urlItem.lastmod}
											</Badge>
										)}
										{urlItem.changefreq && (
											<Badge variant="secondary" className="text-xs gap-1">
												<RefreshCw className="h-3 w-3" />
												{urlItem.changefreq}
											</Badge>
										)}
										{urlItem.priority && (
											<Badge variant="secondary" className="text-xs gap-1">
												<Hash className="h-3 w-3" />
												{urlItem.priority}
											</Badge>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</PageShell>
	);
}
