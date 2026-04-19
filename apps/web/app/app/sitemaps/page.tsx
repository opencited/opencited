"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PageShell } from "@/app/components/page-shell";
import { useTRPC } from "@/app/_trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@opencited/ui";
import { QueryCell } from "@/app/components/query-cell";
import { Globe, Plus } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";
import { TimeAgo } from "@/app/components/time-ago";
import { AddSitemapDialog } from "./_components/add-sitemap-dialog";
import { Button } from "@opencited/ui";

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
						Updated <TimeAgo date={sitemap.updatedAt} />
					</p>
				</CardContent>
			</Card>
		</Link>
	);
}

export default function SitemapsPage() {
	const trpc = useTRPC();
	const [showAddDialog, setShowAddDialog] = useState(false);

	const sitemapsQuery = useQuery(trpc.sitemap.list.queryOptions({}));

	const existingSitemapUrls = new Set(
		sitemapsQuery.data?.map((s) => s.url) ?? [],
	);

	const domainProjectId = sitemapsQuery.data?.[0]?.domainProjectId ?? "";
	const domain = sitemapsQuery.data?.[0]?.url
		? (sitemapsQuery.data[0].url.replace(/^https?:\/\//, "").split("/")[0] ??
			"")
		: "";

	return (
		<PageShell
			title="Sitemaps"
			action={
				<Button onClick={() => setShowAddDialog(true)} className="gap-2">
					<Plus className="h-4 w-4" />
					Add Sitemap
				</Button>
			}
		>
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
							Couldn't load sitemaps. Try again.
						</CardContent>
					</Card>
				)}
				success={(sitemapList) => {
					if (!sitemapList || sitemapList.length === 0) {
						return (
							<Card>
								<CardContent className="py-8 text-center text-muted-foreground">
									No sitemaps yet. Add your first sitemap to get started.
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

			{domainProjectId && (
				<AddSitemapDialog
					open={showAddDialog}
					onOpenChange={setShowAddDialog}
					domainProjectId={domainProjectId}
					domain={domain}
					existingSitemapUrls={existingSitemapUrls}
					onSuccess={() => {
						sitemapsQuery.refetch();
					}}
				/>
			)}
		</PageShell>
	);
}
