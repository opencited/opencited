"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { Card, CardContent, Badge, Skeleton, DataList } from "@opencited/ui";
import { QueryCell } from "@/app/components/query-cell";
import { PromptQueryCrawlStatusBadge } from "@/app/components/prompt-query-crawl-status-badge";
import { TimeAgo } from "@/app/components/time-ago";
import { Calendar, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface CrawlItem {
	id: string;
	status: string | null;
	provider: string | null;
	query: string;
	url: string | null;
	title: string | null;
	content: string | null;
	loadTimeMs: number | null;
	error: string | null;
	startedAt: string | null;
	completedAt: string | null;
	createdAt: string;
}

interface HistoryTabProps {
	domainProjectId: string;
	onSelectCrawl: (crawl: CrawlItem) => void;
}

export function HistoryTab({
	domainProjectId,
	onSelectCrawl,
}: HistoryTabProps) {
	const trpc = useTRPC();

	const crawlsQuery = useQuery({
		...trpc.promptQueryCrawl.list.queryOptions({
			domainProjectId,
		}),
		enabled: !!domainProjectId,
	});

	return (
		<QueryCell
			query={crawlsQuery}
			loading={
				<div className="space-y-3">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="flex items-start justify-between gap-4 rounded-sm p-2"
						>
							<div className="flex-1 min-w-0 space-y-1.5">
								<div className="flex items-center gap-2 flex-wrap">
									<Skeleton className="h-5 w-12 rounded-full" />
									<Skeleton className="h-4 w-3/4" />
									<Skeleton className="h-4 w-16 rounded-full" />
								</div>
								<div className="flex items-center gap-4">
									<Skeleton className="h-3 w-24" />
									<Skeleton className="h-3 w-20" />
								</div>
							</div>
							<Skeleton className="h-4 w-24" />
						</div>
					))}
				</div>
			}
			error={() => (
				<Card>
					<CardContent className="py-8 text-center">
						<p className="text-destructive">
							Couldn&apos;t load crawl history. Try again.
						</p>
					</CardContent>
				</Card>
			)}
			success={(crawls) => {
				const items = crawls ?? [];
				return (
					<DataList<CrawlItem>
						items={items}
						keyExtractor={(crawl) => crawl.id}
						emptyState={{
							title: "No crawl runs yet",
							description:
								"Run a crawl from a prompt to see results here. Each crawl fetches data from AI answer engines and stores the response for analysis.",
						}}
						renderItem={(crawl) => (
							<button
								type="button"
								className="flex-1 min-w-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-left"
								onClick={() => onSelectCrawl(crawl)}
							>
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1 min-w-0 space-y-1.5">
										<div className="flex items-center gap-2 flex-wrap">
											<PromptQueryCrawlStatusBadge status={crawl.status} />
											{crawl.query && (
												<span className="text-sm font-medium truncate">
													{crawl.query}
												</span>
											)}
											{crawl.provider && (
												<Badge variant="outline" className="text-xs">
													{crawl.provider}
												</Badge>
											)}
										</div>
										<div className="flex items-center gap-4 text-xs text-muted-foreground">
											<div className="flex items-center gap-1">
												<Calendar className="h-3 w-3" />
												<span>
													{format(new Date(crawl.createdAt), "MMM d, h:mm a")}
												</span>
											</div>
											{crawl.completedAt && (
												<>
													<span className="text-muted-foreground">·</span>
													<span>
														Completed <TimeAgo date={crawl.completedAt} />
													</span>
												</>
											)}
											{crawl.loadTimeMs && (
												<>
													<span className="text-muted-foreground">·</span>
													<span>{crawl.loadTimeMs}ms</span>
												</>
											)}
										</div>
									</div>
									{crawl.url && (
										<div className="flex-shrink-0">
											<a
												href={crawl.url}
												target="_blank"
												rel="noopener noreferrer"
												className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors min-h-[44px] px-2"
												onClick={(e) => e.stopPropagation()}
											>
												<span className="truncate max-w-[120px] lg:max-w-[180px]">
													{crawl.url}
												</span>
												<ExternalLink className="h-3 w-3 flex-shrink-0" />
											</a>
										</div>
									)}
								</div>
							</button>
						)}
					/>
				);
			}}
		/>
	);
}
