"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { QueryCell } from "@/app/components/query-cell";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	Badge,
	Tabs,
	TabsList,
	TabsTrigger,
	TabsContent,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
	Button,
} from "@opencited/ui";
import { CrawlStatusBadge } from "@/app/components/crawl-status-badge";
import {
	Clock,
	FileText,
	Image,
	Link2,
	Layers,
	Brain,
	Layout,
	Type,
	ExternalLink,
	RefreshCw,
	Loader2,
	Info,
} from "lucide-react";
import { useState } from "react";

interface PageDetailsSheetProps {
	sitemapUrlId: string;
	url: string;
	sitemapId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function PageDetailsSheet({
	sitemapUrlId,
	url,
	sitemapId,
	open,
	onOpenChange,
}: PageDetailsSheetProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [isReCrawling, setIsReCrawling] = useState(false);

	const pageQuery = useQuery(
		trpc.crawl.get.queryOptions(
			{ sitemapUrlId },
			{ enabled: open && !!sitemapUrlId },
		),
	);

	const crawlMutation = useMutation(
		trpc.crawl.triggerSingleCrawl.mutationOptions({
			onMutate: () => setIsReCrawling(true),
			onSettled: () => {
				setIsReCrawling(false);
				queryClient.invalidateQueries(
					trpc.crawl.get.queryOptions({ sitemapUrlId }),
				);
				queryClient.invalidateQueries(
					trpc.sitemap.listUrls.queryOptions({ sitemapId }),
				);
			},
		}),
	);

	const handleReCrawl = () => {
		crawlMutation.mutate({ sitemapUrlId, url });
	};

	const handleOpenLink = () => {
		window.open(url, "_blank", "noopener,noreferrer");
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-3xl w-[95vw] flex flex-col p-0 gap-0">
				<SheetHeader className="px-6 pt-5 pb-4 space-y-3 border-b border-border/40">
					<SheetTitle className="text-sm font-mono break-all leading-relaxed flex-1 text-left">
						{url}
					</SheetTitle>
					<SheetDescription className="flex items-center justify-between gap-2">
						<div>
							{pageQuery.data?.page?.crawledPage ? (
								<CrawlStatusBadge
									status={
										pageQuery.data.page.crawledPage.crawlStatus as
											| "pending"
											| "fetched"
											| "analyzed"
											| "error"
									}
								/>
							) : (
								<Badge
									variant="outline"
									className="border-amber-500/50 text-amber-600 dark:text-amber-400"
								>
									Not Crawled
								</Badge>
							)}
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<Button
								variant="ghost"
								size="sm"
								onClick={handleOpenLink}
								className="h-8 px-2.5 text-muted-foreground hover:text-foreground gap-1.5"
							>
								<ExternalLink className="h-3.5 w-3.5" />
								Open
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleReCrawl}
								disabled={isReCrawling || crawlMutation.isPending}
								className="h-8 px-2.5 text-muted-foreground hover:text-foreground gap-1.5"
							>
								{isReCrawling || crawlMutation.isPending ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<RefreshCw className="h-3.5 w-3.5" />
								)}
								Re-crawl
							</Button>
						</div>
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto">
					<QueryCell
						query={pageQuery}
						loading={
							<div className="px-6 py-12 flex items-center justify-center">
								<div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
							</div>
						}
						success={(data) => {
							if (!data.page) {
								return (
									<div className="px-6 py-16 text-center space-y-4">
										<div className="mx-auto w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
											<FileText className="h-7 w-7 text-muted-foreground" />
										</div>
										<div>
											<p className="text-sm font-medium">
												This page hasn't been crawled yet
											</p>
											<p className="text-sm text-muted-foreground mt-1">
												Run a crawl to analyze this page and see detailed
												insights.
											</p>
										</div>
										<div className="flex justify-center">
											<Button
												variant="default"
												size="sm"
												onClick={handleReCrawl}
												disabled={isReCrawling || crawlMutation.isPending}
												className="gap-2"
											>
												{isReCrawling || crawlMutation.isPending ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<RefreshCw className="h-4 w-4" />
												)}
												Start Crawl
											</Button>
										</div>
									</div>
								);
							}

							const { crawledPage, analysis } = data.page;

							if (
								crawledPage.crawlStatus === "error" &&
								crawledPage.fetchError
							) {
								return (
									<div className="px-6 py-12 space-y-4">
										<div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
											<p className="text-sm font-medium text-destructive">
												Crawl Failed
											</p>
											<p className="text-sm text-muted-foreground mt-1 font-mono break-all">
												{crawledPage.fetchError}
											</p>
										</div>
										<div className="flex justify-center">
											<Button
												variant="default"
												size="sm"
												onClick={handleReCrawl}
												disabled={isReCrawling || crawlMutation.isPending}
												className="gap-2"
											>
												{isReCrawling || crawlMutation.isPending ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<RefreshCw className="h-4 w-4" />
												)}
												Retry Crawl
											</Button>
										</div>
									</div>
								);
							}

							const hasAnalysis = !!analysis;
							const hasCrawlInfo = !!crawledPage.httpStatus;

							return (
								<TooltipProvider>
									<Tabs defaultValue="overview" className="flex flex-col">
										<div className="px-6 pt-4">
											<TabsList className="w-full justify-start h-auto p-0 bg-transparent gap-1">
												<TabsTrigger
													value="overview"
													className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-muted data-[state=active]:shadow-none"
												>
													<Layout className="h-3.5 w-3.5 mr-2" />
													Overview
												</TabsTrigger>

												{hasAnalysis && (
													<TabsTrigger
														value="structure"
														className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-muted data-[state=active]:shadow-none"
													>
														<Type className="h-3.5 w-3.5 mr-2" />
														Structure
													</TabsTrigger>
												)}
												{analysis?.extractedText && (
													<TabsTrigger
														value="content"
														className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-muted data-[state=active]:shadow-none"
													>
														<FileText className="h-3.5 w-3.5 mr-2" />
														Content
													</TabsTrigger>
												)}
												{hasAnalysis && (
													<TabsTrigger
														value="analysis"
														className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-muted data-[state=active]:shadow-none"
													>
														<Brain className="h-3.5 w-3.5 mr-2" />
														Analysis
													</TabsTrigger>
												)}
											</TabsList>
										</div>

										<div className="flex-1 overflow-y-auto">
											<TabsContent
												value="overview"
												className="mt-0 p-6 space-y-8"
											>
												{hasCrawlInfo && (
													<Section title="Crawl Info">
														<Grid>
															{crawledPage.httpStatus && (
																<Field
																	label="HTTP Status"
																	value={
																		<HttpStatusBadge
																			status={crawledPage.httpStatus}
																		/>
																	}
																/>
															)}
															{crawledPage.contentLength && (
																<Field
																	label="Content Length"
																	value={formatBytes(crawledPage.contentLength)}
																/>
															)}
															{crawledPage.fetchedAt && (
																<Field
																	label="Fetched"
																	value={
																		<span className="flex items-center gap-1.5 text-sm">
																			<Clock className="h-3.5 w-3.5 text-muted-foreground" />
																			{formatDate(crawledPage.fetchedAt)}
																		</span>
																	}
																/>
															)}
															{crawledPage.contentHash && (
																<Field
																	label="Content Hash"
																	value={
																		<span className="font-mono text-xs text-muted-foreground break-all">
																			{crawledPage.contentHash}
																		</span>
																	}
																/>
															)}
														</Grid>
													</Section>
												)}

												{analysis && (
													<Section title="Content & SEO">
														<Grid>
															{analysis.wordCount && (
																<FieldWithTooltip
																	label="Word Count"
																	value={analysis.wordCount.toLocaleString()}
																	tooltip="Total number of words in the page content"
																/>
															)}
															{analysis.textHtmlRatio && (
																<FieldWithTooltip
																	label="Text/HTML Ratio"
																	value={
																		<span className="text-sm">
																			{analysis.textHtmlRatio}%
																		</span>
																	}
																	tooltip="Percentage of text content vs HTML markup. Higher is better for SEO (aim for 25-70%)"
																/>
															)}
															{(analysis.imagesTotal ||
																analysis.imagesWithAlt) && (
																<FieldWithTooltip
																	label="Images"
																	value={
																		<span className="flex items-center gap-1.5 text-sm">
																			<Image className="h-3.5 w-3.5 text-muted-foreground" />
																			{analysis.imagesWithAlt ?? 0} /{" "}
																			{analysis.imagesTotal ?? 0} with alt
																		</span>
																	}
																	tooltip="Images with alt text vs total images. Alt text improves accessibility and SEO"
																/>
															)}
															{(analysis.internalLinks ||
																analysis.externalLinks) && (
																<FieldWithTooltip
																	label="Links"
																	value={
																		<span className="flex items-center gap-1.5 text-sm">
																			<Link2 className="h-3.5 w-3.5 text-muted-foreground" />
																			{analysis.internalLinks ?? 0} internal,{" "}
																			{analysis.externalLinks ?? 0} external
																		</span>
																	}
																	tooltip="Number of internal links (same domain) and external links (other domains)"
																/>
															)}
															{analysis.domDepthAvg && (
																<FieldWithTooltip
																	label="Avg DOM Depth"
																	value={
																		<span className="flex items-center gap-1.5 text-sm">
																			<Layers className="h-3.5 w-3.5 text-muted-foreground" />
																			{analysis.domDepthAvg}
																		</span>
																	}
																	tooltip="Average depth of DOM elements. Lower values indicate simpler, faster-rendering pages"
																/>
															)}
														</Grid>
													</Section>
												)}

												{!analysis && crawledPage.crawlStatus === "fetched" && (
													<div className="p-4 rounded-lg bg-muted/30 border border-border/40">
														<p className="text-sm font-medium">
															Analysis Pending
														</p>
														<p className="text-sm text-muted-foreground mt-1">
															This page has been fetched but AI analysis hasn't
															run yet.
														</p>
													</div>
												)}
											</TabsContent>

											{analysis && (
												<TabsContent
													value="analysis"
													className="mt-0 p-6 space-y-6"
												>
													{(analysis.tone ||
														analysis.sentiment ||
														analysis.perceivedPageType) && (
														<Section title="AI Analysis">
															<Grid>
																{analysis.tone && (
																	<Field
																		label="Tone"
																		value={
																			<Badge variant="secondary">
																				{analysis.tone}
																			</Badge>
																		}
																	/>
																)}
																{analysis.sentiment && (
																	<Field
																		label="Sentiment"
																		value={
																			<span className="flex items-center gap-2">
																				<Badge variant="secondary">
																					{analysis.sentiment}
																				</Badge>
																				{analysis.sentimentScore && (
																					<span className="text-xs text-muted-foreground">
																						{analysis.sentimentScore}/100
																					</span>
																				)}
																			</span>
																		}
																	/>
																)}
																{analysis.subjectivity && (
																	<Field
																		label="Subjectivity"
																		value={
																			<Badge variant="secondary">
																				{analysis.subjectivity}
																			</Badge>
																		}
																	/>
																)}
																{analysis.perceivedPageType && (
																	<Field
																		label="Page Type"
																		value={
																			<Badge variant="secondary">
																				{analysis.perceivedPageType}
																			</Badge>
																		}
																	/>
																)}
																{analysis.perceivedIntent && (
																	<Field
																		label="Intent"
																		value={
																			<Badge variant="secondary">
																				{analysis.perceivedIntent}
																			</Badge>
																		}
																	/>
																)}
																{analysis.perceivedAudience && (
																	<Field
																		label="Audience"
																		value={
																			<Badge variant="secondary">
																				{analysis.perceivedAudience}
																			</Badge>
																		}
																	/>
																)}
																{analysis.verbTense && (
																	<Field
																		label="Verb Tense"
																		value={
																			<Badge variant="secondary">
																				{analysis.verbTense}
																			</Badge>
																		}
																	/>
																)}
															</Grid>
														</Section>
													)}

													{analysis.namedEntities &&
														analysis.namedEntities.length > 0 && (
															<Section title="Named Entities">
																<div className="space-y-3">
																	{renderEntities(analysis.namedEntities)}
																</div>
															</Section>
														)}
												</TabsContent>
											)}

											{analysis && (
												<TabsContent
													value="structure"
													className="mt-0 p-6 space-y-6"
												>
													{analysis.headingStructure &&
														hasAnyHeadings(analysis.headingStructure) && (
															<Section title="Heading Structure">
																<div className="space-y-1">
																	{renderHeadings(analysis.headingStructure)}
																</div>
															</Section>
														)}

													{(!analysis.headingStructure ||
														!hasAnyHeadings(analysis.headingStructure)) && (
														<div className="p-4 rounded-lg bg-muted/30 border border-border/40 text-center">
															<p className="text-sm text-muted-foreground">
																No heading structure available
															</p>
														</div>
													)}
												</TabsContent>
											)}

											{analysis?.extractedText && (
												<TabsContent value="content" className="mt-0 p-6">
													<Section title="Extracted Text">
														<div className="mt-2 p-4 rounded-lg bg-muted/30 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans max-h-96 overflow-y-auto">
															{analysis.extractedText}
														</div>
													</Section>
												</TabsContent>
											)}
										</div>
									</Tabs>
								</TooltipProvider>
							);
						}}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}

function HttpStatusBadge({ status }: { status: number }) {
	const getColor = (code: number) => {
		if (code >= 200 && code < 300)
			return "border-emerald-500/50 text-emerald-600 dark:text-emerald-400";
		if (code >= 300 && code < 400)
			return "border-amber-500/50 text-amber-600 dark:text-amber-400";
		if (code >= 400 && code < 500)
			return "border-orange-500/50 text-orange-600 dark:text-orange-400";
		if (code >= 500) return "border-red-500/50 text-red-600 dark:text-red-400";
		return "border-border text-muted-foreground";
	};

	return (
		<Badge variant="outline" className={`font-mono ${getColor(status)}`}>
			{status}
		</Badge>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				{title}
			</h3>
			{children}
		</div>
	);
}

function Grid({ children }: { children: React.ReactNode }) {
	return <div className="grid grid-cols-1 gap-3">{children}</div>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex items-start justify-between gap-4">
			<span className="text-sm text-muted-foreground shrink-0">{label}</span>
			<span className="text-sm text-right">{value}</span>
		</div>
	);
}

function FieldWithTooltip({
	label,
	value,
	tooltip,
}: {
	label: string;
	value: React.ReactNode;
	tooltip: string;
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<span className="text-sm text-muted-foreground shrink-0 flex items-center gap-1.5">
				{label}
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							className="text-muted-foreground hover:text-foreground transition-colors"
						>
							<Info className="h-3.5 w-3.5" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="right" className="max-w-xs">
						<p className="text-xs">{tooltip}</p>
					</TooltipContent>
				</Tooltip>
			</span>
			<span className="text-sm text-right">{value}</span>
		</div>
	);
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function hasAnyHeadings(headings: Record<string, string[]>): boolean {
	return Object.values(headings).some((arr) => arr.length > 0);
}

function renderHeadings(
	headingStructure: Record<string, string[]>,
): React.ReactNode {
	const levels = ["h1", "h2", "h3", "h4", "h5", "h6"];
	const elements: React.ReactNode[] = [];

	for (const level of levels) {
		const headings = headingStructure[level] || [];
		if (headings.length === 0) continue;

		const levelNum = parseInt(level[1] || "1", 10);
		const indent = (levelNum - 1) * 16;

		for (const heading of headings) {
			elements.push(
				<div
					key={`${level}-${heading}`}
					className="text-sm py-1"
					style={{ paddingLeft: `${indent}px` }}
				>
					<span className="text-xs font-mono text-muted-foreground mr-2 uppercase">
						{level}
					</span>
					<span className="text-foreground">{heading}</span>
				</div>,
			);
		}
	}

	return elements.length > 0 ? (
		elements
	) : (
		<p className="text-sm text-muted-foreground">No headings found</p>
	);
}

function renderEntities(
	entities: Array<{ type: string; name: string }>,
): React.ReactNode {
	const grouped = entities.reduce<Record<string, string[]>>((acc, entity) => {
		const type = entity.type || "Unknown";
		if (!acc[type]) acc[type] = [];
		acc[type].push(entity.name);
		return acc;
	}, {});

	return Object.entries(grouped).map(([type, names]) => (
		<div key={type} className="space-y-1.5">
			<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				{type}
			</p>
			<div className="flex flex-wrap gap-1.5">
				{names.map((name, i) => (
					<Badge key={i} variant="outline" className="text-xs">
						{name}
					</Badge>
				))}
			</div>
		</div>
	));
}
