"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, useEffect } from "react";
import { PageShell } from "@/app/components/page-shell";
import { useTRPC } from "@/app/_trpc/client";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Button,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	TooltipProvider,
	Kbd,
} from "@opencited/ui";
import { QueryCell } from "@/app/components/query-cell";
import { Globe, Plus } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";
import { TimeAgo } from "@/app/components/time-ago";
import { AddSitemapDialog } from "./_components/add-sitemap-dialog";
import { SitemapStatusBadge } from "./_components/sitemap-status-badge";

type RouterOutput = inferRouterOutputs<AppRouter>;
type SitemapList = RouterOutput["sitemap"]["list"];

function formatSitemapUrl(url: string): {
	domain: string;
	path: string;
} {
	try {
		const parsed = new URL(url);
		return {
			domain: parsed.hostname,
			path: parsed.pathname,
		};
	} catch {
		const withoutProtocol = url.replace(/^https?:\/\//, "");
		const slashIndex = withoutProtocol.indexOf("/");
		if (slashIndex === -1) {
			return { domain: withoutProtocol, path: "" };
		}
		return {
			domain: withoutProtocol.slice(0, slashIndex),
			path: withoutProtocol.slice(slashIndex),
		};
	}
}

function SitemapCard({ sitemap }: { sitemap: SitemapList[number] }) {
	const { domain, path } = formatSitemapUrl(sitemap.url);

	return (
		<Link href={`/app/sitemaps/${sitemap.id}`}>
			<Card className="h-full transition-colors hover:bg-muted/50">
				<CardHeader className="pb-2">
					<CardTitle className="flex items-start justify-between gap-2 text-sm font-medium">
						<div className="flex items-center gap-2 min-w-0 flex-1">
							<Globe className="h-4 w-4 text-muted-foreground shrink-0" />
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-1.5">
									<span className="truncate font-mono text-foreground">
										{domain}
									</span>
									{path && (
										<span className="truncate font-mono text-muted-foreground">
											{path}
										</span>
									)}
								</div>
							</div>
						</div>
						<SitemapStatusBadge status={sitemap.status} className="shrink-0" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-3 text-xs text-muted-foreground">
						{sitemap.urlCount > 0 && (
							<span>
								{sitemap.urlCount.toLocaleString()} URL
								{sitemap.urlCount !== 1 ? "s" : ""}
							</span>
						)}
						<span>
							Updated <TimeAgo date={sitemap.updatedAt} />
						</span>
					</div>
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

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "n" || e.key === "N") {
				const target = e.target as HTMLElement;
				if (
					target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable
				) {
					return;
				}
				e.preventDefault();
				setShowAddDialog(true);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	return (
		<TooltipProvider>
			<PageShell
				title="Sitemaps"
				action={
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<Button
									onClick={() => setShowAddDialog(true)}
									disabled={!domainProjectId}
									className="gap-2"
								>
									<Plus className="h-4 w-4" />
									Add Sitemap
									<Kbd className="ml-auto text-[9px] pointer-events-none">
										N
									</Kbd>
								</Button>
							</span>
						</TooltipTrigger>
						{!domainProjectId && (
							<TooltipContent>
								<p>Add a domain project first to create sitemaps.</p>
							</TooltipContent>
						)}
					</Tooltip>
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
								Couldn&apos;t load sitemaps. Try again.
							</CardContent>
						</Card>
					)}
					success={(sitemapList) => {
						if (!sitemapList || sitemapList.length === 0) {
							return (
								<Card>
									<CardContent className="py-8 text-center text-muted-foreground">
										No sitemaps yet. Add your first sitemap to track URLs in AI
										answer engines.
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
			</PageShell>
		</TooltipProvider>
	);
}
