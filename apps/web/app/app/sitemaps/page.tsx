"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageShell } from "../../components/page-shell";
import { useTRPC } from "@/app/_trpc/client";
import { Button } from "@opencited/ui";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@opencited/ui";
import { ExternalLink, Globe, Loader2 } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";

type RouterOutput = inferRouterOutputs<AppRouter>;
type SitemapList = RouterOutput["sitemap"]["list"];

export default function SitemapsPage() {
	const trpc = useTRPC();

	const { data: sitemaps, isLoading } = useQuery(
		trpc.sitemap.list.queryOptions({}),
	);

	if (isLoading) {
		return (
			<PageShell title="Sitemaps">
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			</PageShell>
		);
	}

	const sitemapList = sitemaps as SitemapList | undefined;

	if (!sitemapList || sitemapList.length === 0) {
		return (
			<PageShell title="Sitemaps">
				<Card>
					<CardHeader>
						<CardTitle>No Sitemaps Yet</CardTitle>
						<CardDescription>
							You haven&apos;t added any sitemaps to your project yet.
						</CardDescription>
					</CardHeader>
				</Card>
			</PageShell>
		);
	}

	return (
		<PageShell title="Sitemaps">
			<div className="space-y-4">
				<p className="text-sm text-muted-foreground">
					{sitemapList.length} sitemap{sitemapList.length !== 1 ? "s" : ""} in
					your project
				</p>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{sitemapList.map((sitemap: SitemapList[number]) => (
						<Card
							key={sitemap.id}
							className="hover:bg-muted/50 transition-colors"
						>
							<CardHeader className="pb-2">
								<CardTitle className="text-base flex items-center gap-2">
									<Globe className="h-4 w-4" />
									<span className="truncate">{sitemap.url}</span>
								</CardTitle>
								<CardDescription className="truncate">
									{sitemap.id}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Button asChild className="w-full">
									<Link href={`/app/sitemaps/${sitemap.id}`}>
										View URLs
										<ExternalLink className="ml-2 h-4 w-4" />
									</Link>
								</Button>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		</PageShell>
	);
}
