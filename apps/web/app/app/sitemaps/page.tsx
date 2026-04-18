"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageShell } from "@/app/components/page-shell";
import { useTRPC } from "@/app/_trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@opencited/ui";
import { QueryCell } from "@/app/components/query-cell";
import { Globe } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";
import { timeAgo } from "@/lib/time-ago";

type RouterOutput = inferRouterOutputs<AppRouter>;
type SitemapList = RouterOutput["sitemap"]["list"];

function SitemapCard({ sitemap }: { sitemap: SitemapList[number] }) {
	return (
		<Link href={`/app/sitemaps/${sitemap.id}`}>
			<Card className="h-full transition-colors hover:bg-muted/50">
				<CardHeader className="pb-2">
					<CardTitle className="flex items-center gap-2 text-sm font-medium">
						<Globe className="h-4 w-4 text-muted-foreground shrink-0" />
						<span className="truncate font-mono">{sitemap.url}</span>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-xs text-muted-foreground">
						Updated {timeAgo(sitemap.updatedAt)}
					</p>
				</CardContent>
			</Card>
		</Link>
	);
}

export default function SitemapsPage() {
	const trpc = useTRPC();

	const sitemapsQuery = useQuery(trpc.sitemap.list.queryOptions({}));

	return (
		<PageShell title="Sitemaps">
			<QueryCell
				query={sitemapsQuery}
				loading={
					<div className="flex items-center justify-center py-12 text-muted-foreground">
						Loading sitemaps...
					</div>
				}
				error={(_error) => (
					<Card>
						<CardContent className="py-8 text-center text-destructive">
							Failed to load sitemaps
						</CardContent>
					</Card>
				)}
				success={(sitemapList) => {
					if (!sitemapList || sitemapList.length === 0) {
						return (
							<Card>
								<CardContent className="py-8 text-center text-muted-foreground">
									You haven&apos;t added any sitemaps to your project yet.
								</CardContent>
							</Card>
						);
					}

					return (
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								{sitemapList.length} sitemap
								{sitemapList.length !== 1 ? "s" : ""} in your project
							</p>
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{sitemapList.map((sitemap: SitemapList[number]) => (
									<SitemapCard key={sitemap.id} sitemap={sitemap} />
								))}
							</div>
						</div>
					);
				}}
			/>
		</PageShell>
	);
}
