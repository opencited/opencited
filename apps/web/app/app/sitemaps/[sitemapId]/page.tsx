"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { PageShell } from "@/app/components/page-shell";
import { DataList, DataListAction, MetadataGroup } from "@opencited/ui";
import { QueryCell } from "@/app/components/query-cell";
import { Calendar, RefreshCw, Hash, ExternalLink } from "lucide-react";
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
										<MetadataGroup
											items={
												[
													urlItem.lastmod && {
														icon: <Calendar className="h-3 w-3" />,
														label: urlItem.lastmod,
													},
													urlItem.changefreq && {
														icon: <RefreshCw className="h-3 w-3" />,
														label: urlItem.changefreq,
													},
													urlItem.priority && {
														icon: <Hash className="h-3 w-3" />,
														label: urlItem.priority,
													},
												].filter(Boolean) as Array<{
													icon: React.ReactNode;
													label: string;
												}>
											}
										/>
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
								title: "No URLs Found",
								description: "This sitemap doesn't contain any URLs yet.",
							}}
						/>
					</div>
				)}
			/>
		</PageShell>
	);
}
