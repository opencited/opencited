"use client";

import {
	Badge,
	Button,
	Card,
	CardContent,
	DataList,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@opencited/ui";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Copy, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { useTRPC } from "@/app/_trpc/client";
import { PromptQueryCrawlStatusBadge } from "@/app/components/prompt-query-crawl-status-badge";
import { QueryCell } from "@/app/components/query-cell";
import { TimeAgo } from "@/app/components/time-ago";
import { AnswerFormatBadge } from "./answer-format-badge";
import { MentionTypeBadge } from "./mention-type-badge";
import { RelativePositionBadge } from "./relative-position-badge";

interface CrawlDetailSheetProps {
	crawlId: string;
	queryId: string;
	domainProjectId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CrawlDetailSheet({
	crawlId,
	queryId,
	domainProjectId,
	open,
	onOpenChange,
}: CrawlDetailSheetProps) {
	const trpc = useTRPC();
	const [activeTab, setActiveTab] = useState("answer");
	const [copied, setCopied] = useState(false);
	const [selectedCrawlId, setSelectedCrawlId] = useState(crawlId);

	const crawlQuery = useQuery({
		...trpc.promptQueryCrawl.get.queryOptions({ id: selectedCrawlId }),
		enabled: open,
	});

	const crawl = crawlQuery.data;

	const crawlHistoryQuery = useQuery({
		...trpc.aiVisibility.getCrawlHistory.queryOptions({
			promptQueryId: queryId,
			domainProjectId,
		}),
		enabled: open,
	});

	const sourcesQuery = useQuery({
		...trpc.aiVisibility.listCrawlSources.queryOptions({
			crawlId: selectedCrawlId,
		}),
		enabled: open && activeTab === "sources",
	});

	const mentionsQuery = useQuery({
		...trpc.aiVisibility.listBrandMentions.queryOptions({
			crawlId: selectedCrawlId,
		}),
		enabled: open && activeTab === "mentions",
	});

	const handleCopy = async () => {
		if (crawl?.content) {
			await navigator.clipboard.writeText(crawl.content);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const duration =
		crawl?.startedAt && crawl.completedAt
			? Math.abs(
					new Date(crawl.completedAt).getTime() -
						new Date(crawl.startedAt).getTime(),
				)
			: null;

	const formatDuration = (ms: number) => {
		const seconds = Math.floor(ms / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds}s`;
	};

	const formatLoadTime = (ms: number | null | undefined) => {
		if (ms === null || ms === undefined) return "N/A";
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent size="lg" className="w-full flex flex-col">
				<SheetHeader>
					<SheetTitle className="truncate">
						{crawl?.query ?? "Loading..."}
					</SheetTitle>
					<SheetDescription>
						<div className="flex items-center justify-between gap-2">
							<span>
								Created <TimeAgo date={crawl?.createdAt ?? new Date()} />
							</span>
							<Select
								value={selectedCrawlId}
								onValueChange={(val) => {
									setSelectedCrawlId(val);
									setActiveTab("answer");
								}}
							>
								<SelectTrigger className="w-min shrink-0">
									<SelectValue placeholder="Select a run" />
								</SelectTrigger>
								<SelectContent>
									{crawlHistoryQuery.data?.map((run) => (
										<SelectItem key={run.id} value={run.id}>
											<div className="flex items-center gap-2">
												<span className="text-xs">
													{format(new Date(run.createdAt), "MMM d, h:mm a")}
												</span>
												<PromptQueryCrawlStatusBadge
													status={run.status}
													size="sm"
												/>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</SheetDescription>
				</SheetHeader>

				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="flex-1 overflow-hidden flex flex-col mt-4"
				>
					<TabsList className="justify-start w-fit">
						<TabsTrigger value="answer">Answer</TabsTrigger>
						<TabsTrigger value="sources">
							Sources {crawl?.sourceCount ? `(${crawl.sourceCount})` : ""}
						</TabsTrigger>
						<TabsTrigger value="mentions">
							Mentions{" "}
							{crawl?.brandMentionCount ? `(${crawl.brandMentionCount})` : ""}
						</TabsTrigger>
						<TabsTrigger value="details">Details</TabsTrigger>
					</TabsList>

					<div className="flex-1 overflow-y-auto mt-4">
						<TabsContent value="answer" className="mt-0">
							<p className="text-xs text-muted-foreground mb-3">
								The full AI-generated response for this query
							</p>
							{crawl?.content ? (
								<div className="relative">
									<Button
										variant="ghost"
										size="sm"
										className="absolute top-2 right-2 h-8 w-8 p-0"
										onClick={handleCopy}
									>
										{copied ? (
											<Check className="h-4 w-4" />
										) : (
											<Copy className="h-4 w-4" />
										)}
									</Button>
									<div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-a:text-primary prose-strong:text-foreground prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-pre:bg-muted prose-pre:p-3 prose-li:text-foreground">
										<ReactMarkdown remarkPlugins={[remarkGfm]}>
											{crawl.content}
										</ReactMarkdown>
									</div>
								</div>
							) : (
								<div className="flex items-center justify-center py-12 text-muted-foreground">
									<p>No answer content available</p>
								</div>
							)}
						</TabsContent>

						<TabsContent value="sources" className="mt-0">
							<p className="text-xs text-muted-foreground mb-3">
								Websites and pages cited by the AI as references
							</p>
							<QueryCell
								query={sourcesQuery}
								loading={
									<div className="py-8 text-center text-muted-foreground">
										Loading sources...
									</div>
								}
								success={(data) => {
									if (!data || data.length === 0) {
										return (
											<div className="py-8 text-center text-muted-foreground">
												<p>No sources found</p>
											</div>
										);
									}

									return (
										<DataList
											items={data}
											keyExtractor={(source) => source.id}
											renderItem={(source) => (
												<div className="space-y-2">
													<div className="flex items-center gap-2">
														<span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
															#{source.position}
														</span>
														<span className="text-sm font-medium truncate">
															{source.title ?? source.domain}
														</span>
														{source.isOwnDomain === "true" && (
															<Badge variant="success">Own</Badge>
														)}
														{source.isCompetitorDomain === "true" && (
															<Badge variant="warning">Competitor</Badge>
														)}
													</div>
													{source.url && (
														<a
															href={source.url}
															target="_blank"
															rel="noopener noreferrer"
															className="text-xs text-primary hover:underline flex items-center gap-1"
														>
															{source.url}
															<ExternalLink className="h-3 w-3" />
														</a>
													)}
													{source.description && (
														<p className="text-sm text-muted-foreground">
															{source.description}
														</p>
													)}
												</div>
											)}
										/>
									);
								}}
							/>
						</TabsContent>

						<TabsContent value="mentions" className="mt-0">
							<p className="text-xs text-muted-foreground mb-3">
								References to your brand and competitors in the response
							</p>
							<QueryCell
								query={mentionsQuery}
								loading={
									<div className="py-8 text-center text-muted-foreground">
										Loading mentions...
									</div>
								}
								success={(data) => {
									if (!data || data.length === 0) {
										return (
											<div className="py-8 text-center text-muted-foreground">
												<p>No brand mentions found</p>
											</div>
										);
									}

									return (
										<DataList
											items={data}
											keyExtractor={(mention) => mention.id}
											renderItem={(mention) => (
												<div className="space-y-2">
													<div className="flex items-center gap-2 flex-wrap">
														<span className="text-sm font-medium">
															{mention.brandName}
														</span>
														<MentionTypeBadge type={mention.mentionType} />
														{mention.relativePosition && (
															<RelativePositionBadge
																position={mention.relativePosition}
															/>
														)}
														{mention.isRecommendation === "true" && (
															<Badge variant="success">Recommended</Badge>
														)}
													</div>
													<p className="text-sm">{mention.context}</p>
													{mention.objection && (
														<div className="bg-muted p-3 rounded-md">
															<p className="text-xs text-muted-foreground mb-1">
																Objection
															</p>
															<p className="text-sm">{mention.objection}</p>
														</div>
													)}
												</div>
											)}
										/>
									);
								}}
							/>
						</TabsContent>

						<TabsContent value="details" className="mt-0">
							<p className="text-xs text-muted-foreground mb-3">
								Technical metadata about this crawl execution
							</p>
							{crawl && (
								<div className="space-y-4">
									<div className="grid grid-cols-2 gap-3">
										<Card>
											<CardContent className="p-3">
												<p className="text-xs text-muted-foreground mb-1">
													Provider
												</p>
												<p className="text-sm font-medium">
													{crawl.provider ?? "N/A"}
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className="p-3">
												<p className="text-xs text-muted-foreground mb-1">
													Load Time
												</p>
												<p className="text-sm font-medium">
													{formatLoadTime(crawl.loadTimeMs)}
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className="p-3">
												<p className="text-xs text-muted-foreground mb-1">
													Duration
												</p>
												<p className="text-sm font-medium">
													{duration ? formatDuration(duration) : "N/A"}
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className="p-3">
												<p className="text-xs text-muted-foreground mb-1">
													Answer Format
												</p>
												<div className="mt-1">
													<AnswerFormatBadge format={crawl.answerFormat} />
												</div>
											</CardContent>
										</Card>
										<Card>
											<CardContent className="p-3">
												<p className="text-xs text-muted-foreground mb-1">
													Word Count
												</p>
												<p className="text-sm font-medium">
													{crawl.wordCount?.toLocaleString() ?? 0}
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className="p-3">
												<p className="text-xs text-muted-foreground mb-1">
													Source Count
												</p>
												<p className="text-sm font-medium">
													{crawl.sourceCount ?? 0}
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className="p-3">
												<p className="text-xs text-muted-foreground mb-1">
													Brand Mentions
												</p>
												<p className="text-sm font-medium">
													{crawl.brandMentionCount ?? 0}
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className="p-3">
												<p className="text-xs text-muted-foreground mb-1">
													Status
												</p>
												<div className="mt-1">
													<PromptQueryCrawlStatusBadge status={crawl.status} />
												</div>
											</CardContent>
										</Card>
									</div>

									{crawl.url && (
										<Card>
											<CardContent className="p-3">
												<p className="text-xs text-muted-foreground mb-2">
													Source URL
												</p>
												<a
													href={crawl.url}
													target="_blank"
													rel="noopener noreferrer"
													className="text-sm text-primary hover:underline flex items-center gap-1"
												>
													<span className="truncate">{crawl.url}</span>
													<ExternalLink className="h-3 w-3 flex-shrink-0" />
												</a>
											</CardContent>
										</Card>
									)}

									{crawl.triggerRunId && (
										<Card>
											<CardContent className="p-3">
												<p className="text-xs text-muted-foreground mb-1">
													Trigger Run ID
												</p>
												<Badge variant="outline" className="font-mono text-xs">
													{crawl.triggerRunId}
												</Badge>
											</CardContent>
										</Card>
									)}

									{crawl.promptSnapshot && (
										<Card>
											<CardContent className="p-3">
												<p className="text-xs text-muted-foreground mb-2">
													Prompt Snapshot
												</p>
												<pre className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md max-h-[200px] overflow-y-auto">
													{crawl.promptSnapshot}
												</pre>
											</CardContent>
										</Card>
									)}
								</div>
							)}
						</TabsContent>
					</div>
				</Tabs>
			</SheetContent>
		</Sheet>
	);
}
