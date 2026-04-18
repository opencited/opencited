"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { PageShell } from "@/app/components/page-shell";
import { DataList, DataListAction } from "@opencited/ui";
import { PriorityBadge } from "@opencited/ui";
import { QueryCell } from "@/app/components/query-cell";
import { TimeAgo } from "@/app/components/time-ago";
import { ChangeFreqBadge } from "@/app/components/change-freq-badge";
import { ExternalLink } from "lucide-react";
import { useParams } from "next/navigation";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";

type RouterOutput = inferRouterOutputs<AppRouter>;
type SitemapUrlList = RouterOutput["sitemap"]["listUrls"];

export default function SitemapDetailPage() {
	const trpc = useTRPC();
	const params = useParams();
	const sitemapId = params.sitemapId as string;

	const urlListQuery = useQuery(
		trpc.sitemap.listUrls.queryOptions({ sitemapId }),
	);

	return (
		<PageShell
			title="Sitemap URLs"
			backHref="/app/sitemaps"
			backLabel="Back to Sitemaps"
		>
			<QueryCell<SitemapUrlList>
				query={urlListQuery}
				success={(urlList) => (
					<div className="space-y-4">
						<p className="text-sm text-muted-foreground">
							{urlList.length} URL{urlList.length !== 1 ? "s" : ""} in this
							sitemap
						</p>
						<DataList<SitemapUrlList[number]>
							items={urlList}
							keyExtractor={(url) => url.id}
							renderItem={(urlItem) => (
								<div className="flex items-start justify-between gap-4 w-full">
									<div className="flex flex-col flex-1 min-w-0 gap-1">
										<span className="text-sm font-mono truncate">
											{urlItem.url}
										</span>
										<div className="flex flex-wrap items-center gap-3">
											{urlItem.lastmod && (
												<TimeAgo date={urlItem.lastmod} label="Modified" />
											)}
											{urlItem.priority && (
												<PriorityBadge priority={urlItem.priority} />
											)}
											<TimeAgo date={urlItem.updatedAt} label="Crawled" />
											{urlItem.changefreq && (
												<ChangeFreqBadge value={urlItem.changefreq} />
											)}
										</div>
									</div>
									<DataListAction
										href={urlItem.url}
										target="_blank"
										rel="noopener noreferrer"
										icon={<ExternalLink className="h-4 w-4" />}
									>
										Open
									</DataListAction>
								</div>
							)}
							emptyState={{
								title: "No URLs found",
								description:
									"This sitemap has no URLs. It may still be crawling or the sitemap is empty.",
							}}
						/>
					</div>
				)}
			/>
		</PageShell>
	);
}
