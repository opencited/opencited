"use client";

import type { AppRouter } from "@opencited/trpc";
import {
	Badge,
	Card,
	CardContent,
	DataList,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Skeleton,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@opencited/ui";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { ExternalLink, Link, Quote } from "lucide-react";
import { useEffect, useState } from "react";
import { useTRPC } from "@/app/_trpc/client";
import { QueryCell } from "@/app/components/query-cell";
import { CitationDetailSheet } from "./citation-detail-sheet";
import { MentionTypeBadge } from "./mention-type-badge";
import { RelativePositionBadge } from "./relative-position-badge";

type CrawlSource =
	inferRouterOutputs<AppRouter>["aiVisibility"]["listCrawlSources"][number];
type BrandMention =
	inferRouterOutputs<AppRouter>["aiVisibility"]["listBrandMentions"][number];

interface CitationsTabProps {
	domainProjectId: string;
	selectedCrawl: { id: string; query: string; provider: string | null } | null;
	onSelectCrawl: (
		crawl: {
			id: string;
			query: string;
			provider: string | null;
		} | null,
	) => void;
}

export function CitationsTab({
	domainProjectId,
	selectedCrawl,
	onSelectCrawl,
}: CitationsTabProps) {
	const trpc = useTRPC();
	const [selectedSource, setSelectedSource] = useState<CrawlSource | null>(
		null,
	);
	const [activeSubTab, setActiveSubTab] = useState<"sources" | "mentions">(
		"sources",
	);

	const crawlsQuery = useQuery({
		...trpc.aiVisibility.listRunLogs.queryOptions({
			domainProjectId,
			status: "completed",
			limit: 100,
		}),
		enabled: !!domainProjectId,
	});

	const sourcesQuery = useQuery({
		...trpc.aiVisibility.listCrawlSources.queryOptions({
			crawlId: selectedCrawl?.id ?? "",
		}),
		enabled: !!selectedCrawl?.id,
	});

	const mentionsQuery = useQuery({
		...trpc.aiVisibility.listBrandMentions.queryOptions({
			crawlId: selectedCrawl?.id ?? "",
		}),
		enabled: !!selectedCrawl?.id,
	});

	const crawls = crawlsQuery.data?.runs ?? [];

	useEffect(() => {
		if (!selectedCrawl && crawls.length > 0) {
			const firstCrawl = crawls[0];
			if (firstCrawl) {
				onSelectCrawl({
					id: firstCrawl.id,
					query: firstCrawl.query,
					provider: firstCrawl.provider,
				});
			}
		}
	}, [selectedCrawl, crawls, onSelectCrawl]);

	return (
		<div className="space-y-4">
			<div>
				<label
					htmlFor="crawl-select"
					className="text-sm font-medium mb-2 block"
				>
					Select a Crawl
				</label>
				<Select
					value={selectedCrawl?.id ?? ""}
					onValueChange={(value: string) => {
						const crawl = crawls.find((c) => c.id === value);
						if (crawl) {
							onSelectCrawl({
								id: crawl.id,
								query: crawl.query,
								provider: crawl.provider,
							});
						}
					}}
				>
					<SelectTrigger id="crawl-select">
						<SelectValue placeholder="Choose a completed crawl" />
					</SelectTrigger>
					<SelectContent>
						{crawls.map((crawl) => (
							<SelectItem key={crawl.id} value={crawl.id}>
								{crawl.query}
								{crawl.provider && (
									<span className="text-muted-foreground ml-2">
										({crawl.provider})
									</span>
								)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{selectedCrawl && (
				<>
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<span>Viewing:</span>
						<Badge variant="outline">{selectedCrawl.query}</Badge>
						{selectedCrawl.provider && (
							<Badge variant="secondary">{selectedCrawl.provider}</Badge>
						)}
					</div>

					<Tabs
						value={activeSubTab}
						onValueChange={(v) => setActiveSubTab(v as "sources" | "mentions")}
					>
						<TabsList>
							<TabsTrigger value="sources">
								<Link className="h-3.5 w-3.5 mr-1" />
								Sources ({sourcesQuery.data?.length ?? 0})
							</TabsTrigger>
							<TabsTrigger value="mentions">
								<Quote className="h-3.5 w-3.5 mr-1" />
								Mentions ({mentionsQuery.data?.length ?? 0})
							</TabsTrigger>
						</TabsList>

						<TabsContent value="sources">
							<QueryCell
								query={sourcesQuery}
								loading={
									<div className="space-y-3">
										{[1, 2, 3].map((i) => (
											<Skeleton key={i} className="h-16 w-full rounded-lg" />
										))}
									</div>
								}
								error={() => (
									<Card>
										<CardContent className="py-8 text-center">
											<p className="text-destructive">
												Couldn&apos;t load sources. Try again.
											</p>
										</CardContent>
									</Card>
								)}
								success={(sources) => {
									if (!sources || sources.length === 0) {
										return (
											<Card variant="dashed">
												<CardContent className="py-16 text-center">
													<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
														<Link className="h-6 w-6 text-muted-foreground" />
													</div>
													<h3 className="text-lg font-semibold mb-2">
														No sources found
													</h3>
													<p className="text-muted-foreground max-w-md mx-auto">
														This crawl didn&apos;t return any citation sources.
													</p>
												</CardContent>
											</Card>
										);
									}

									return (
										<>
											<DataList<CrawlSource>
												items={sources}
												keyExtractor={(source) => source.id}
												emptyState={{
													title: "No sources",
													description: "No citation sources for this crawl.",
												}}
												renderItem={(source) => (
													<button
														type="button"
														className="flex-1 min-w-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-left"
														onClick={() => setSelectedSource(source)}
													>
														<div className="flex items-start justify-between gap-4">
															<div className="flex-1 min-w-0 space-y-1.5">
																<div className="flex items-center gap-2 flex-wrap">
																	<span className="text-sm font-medium truncate">
																		{source.title ?? source.domain}
																	</span>
																	{source.isOwnDomain === "true" && (
																		<Badge
																			variant="success"
																			className="text-xs"
																		>
																			Own
																		</Badge>
																	)}
																	{source.isCompetitorDomain === "true" && (
																		<Badge
																			variant="secondary"
																			className="text-xs"
																		>
																			Competitor
																		</Badge>
																	)}
																</div>
																<div className="flex items-center gap-4 text-xs text-muted-foreground">
																	<span className="truncate max-w-[300px]">
																		{source.url}
																	</span>
																	{source.position != null && (
																		<>
																			<span className="text-muted-foreground">
																				·
																			</span>
																			<span>Position #{source.position}</span>
																		</>
																	)}
																</div>
															</div>
															<div className="flex-shrink-0">
																<a
																	href={source.url}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors min-h-[44px] px-2"
																	onClick={(e) => e.stopPropagation()}
																>
																	<ExternalLink className="h-3 w-3" />
																</a>
															</div>
														</div>
													</button>
												)}
											/>

											<CitationDetailSheet
												open={!!selectedSource}
												onOpenChange={(open) => {
													if (!open) setSelectedSource(null);
												}}
												source={selectedSource}
											/>
										</>
									);
								}}
							/>
						</TabsContent>

						<TabsContent value="mentions">
							<QueryCell
								query={mentionsQuery}
								loading={
									<div className="space-y-3">
										{[1, 2, 3].map((i) => (
											<Skeleton key={i} className="h-20 w-full rounded-lg" />
										))}
									</div>
								}
								error={() => (
									<Card>
										<CardContent className="py-8 text-center">
											<p className="text-destructive">
												Couldn&apos;t load brand mentions. Try again.
											</p>
										</CardContent>
									</Card>
								)}
								success={(mentions) => {
									if (!mentions || mentions.length === 0) {
										return (
											<Card variant="dashed">
												<CardContent className="py-16 text-center">
													<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
														<Quote className="h-6 w-6 text-muted-foreground" />
													</div>
													<h3 className="text-lg font-semibold mb-2">
														No brand mentions
													</h3>
													<p className="text-muted-foreground max-w-md mx-auto">
														No brand mentions were detected in this crawl.
													</p>
												</CardContent>
											</Card>
										);
									}

									return (
										<DataList<BrandMention>
											items={mentions}
											keyExtractor={(mention) => mention.id}
											emptyState={{
												title: "No mentions",
												description: "No brand mentions for this crawl.",
											}}
											renderItem={(mention) => (
												<div className="flex-1 min-w-0 space-y-1.5">
													<div className="flex items-center gap-2 flex-wrap">
														<span className="text-sm font-medium">
															{mention.brandName}
														</span>
														<MentionTypeBadge type={mention.mentionType} />
														<RelativePositionBadge
															position={mention.relativePosition}
														/>
													</div>
													<p className="text-xs text-muted-foreground line-clamp-2">
														{mention.context}
													</p>
												</div>
											)}
										/>
									);
								}}
							/>
						</TabsContent>
					</Tabs>
				</>
			)}
		</div>
	);
}
