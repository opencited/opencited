"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { PageShell } from "@/app/components/page-shell";
import { DataList, DataListAction } from "@opencited/ui";
import { PriorityBadge } from "@opencited/ui";
import { QueryCell } from "@/app/components/query-cell";
import { TimeAgo } from "@/app/components/time-ago";
import { ChangeFreqBadge } from "@/app/components/change-freq-badge";
import { CrawlStatusBadge } from "@/app/components/crawl-status-badge";
import { CrawlAllButton } from "@/app/components/crawl-all-button";
import { RunButton } from "@/app/components/run-button";
import { PageDetailsSheet } from "@/app/components/page-details-sheet";
import { ExternalLink } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";

type RouterOutput = inferRouterOutputs<AppRouter>;
type SitemapUrlList = RouterOutput["sitemap"]["listUrls"];
type SitemapUrlItem = SitemapUrlList["urls"][number];
type CrawlStatus = "pending" | "fetched" | "analyzed" | "error";

export default function SitemapDetailPage() {
	const trpc = useTRPC();
	const params = useParams();
	const sitemapId = params.sitemapId as string;
	const [selectedUrl, setSelectedUrl] = useState<{
		id: string;
		url: string;
	} | null>(null);

	const urlListQuery = useQuery(
		trpc.sitemap.listUrls.queryOptions({ sitemapId }),
	);

	return (
		<PageShell
			title="Sitemap URLs"
			backHref="/app/sitemaps"
			backLabel="Back to Sitemaps"
			action={
				<CrawlAllButton
					sitemapId={sitemapId}
					sitemapActiveCrawlRunId={
						urlListQuery.data?.sitemapActiveCrawlRunId ?? null
					}
					isBusy={urlListQuery.isPending}
				/>
			}
		>
			<QueryCell<SitemapUrlList>
				query={urlListQuery}
				success={(urlList) => (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<p className="text-sm text-muted-foreground">
								{urlList.urls.length} URL{urlList.urls.length !== 1 ? "s" : ""}{" "}
								in this sitemap
							</p>
						</div>
						<DataList<SitemapUrlItem>
							items={urlList.urls}
							keyExtractor={(urlItem) => urlItem.id}
							renderItem={(urlItem) => (
								<div className="flex items-start justify-between gap-4 w-full">
									<button
										type="button"
										onClick={() =>
											setSelectedUrl({ id: urlItem.id, url: urlItem.url })
										}
										className="flex flex-col flex-1 min-w-0 gap-1 text-left cursor-pointer hover:opacity-80 transition-opacity"
									>
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
											{urlItem.changefreq && (
												<ChangeFreqBadge value={urlItem.changefreq} />
											)}
											<CrawlStatusBadge
												status={urlItem.crawlStatus as CrawlStatus | null}
											/>
											<TimeAgo
												date={urlItem.fetchedAt ?? urlItem.updatedAt}
												label="Crawled"
											/>
										</div>
									</button>
									<div className="flex items-center gap-2 shrink-0">
										<RunButton
											sitemapUrlId={urlItem.id}
											url={urlItem.url}
											sitemapId={sitemapId}
											activeCrawlRunId={urlItem.activeCrawlRunId}
											sitemapActiveCrawlRunId={urlList.sitemapActiveCrawlRunId}
										/>
										<DataListAction
											href={urlItem.url}
											target="_blank"
											rel="noopener noreferrer"
											icon={<ExternalLink className="h-4 w-4" />}
										>
											Open
										</DataListAction>
									</div>
								</div>
							)}
							emptyState={{
								title: "No URLs found",
								description:
									"This sitemap has no URLs. It may still be crawling or the sitemap is empty.",
							}}
						/>
						{selectedUrl && (
							<PageDetailsSheet
								sitemapUrlId={selectedUrl.id}
								url={selectedUrl.url}
								sitemapId={sitemapId}
								open={!!selectedUrl}
								onOpenChange={(open) => {
									if (!open) setSelectedUrl(null);
								}}
							/>
						)}
					</div>
				)}
			/>
		</PageShell>
	);
}
