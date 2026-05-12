"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { Card, CardContent, Badge } from "@opencited/ui";
import { PromptQueryCrawlStatusBadge } from "@/app/components/prompt-query-crawl-status-badge";
import { TimeAgo } from "@/app/components/time-ago";
import { Calendar, FileText, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface HistoryTabProps {
	domainProjectId: string;
	onSelectCrawl: (crawl: {
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
	}) => void;
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

	if (crawlsQuery.isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (crawlsQuery.error) {
		return (
			<Card>
				<CardContent className="py-8 text-center text-destructive">
					Couldn&apos;t load crawl history. Try again.
				</CardContent>
			</Card>
		);
	}

	const crawls = crawlsQuery.data ?? [];

	if (crawls.length === 0) {
		return (
			<Card variant="dashed">
				<CardContent className="py-16 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
						<FileText className="h-6 w-6 text-muted-foreground" />
					</div>
					<h3 className="text-lg font-semibold mb-2">No crawl runs yet</h3>
					<p className="text-muted-foreground max-w-md mx-auto">
						Run a crawl from a prompt to see results here. Each crawl fetches
						data from AI answer engines and stores the response for analysis.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="border border-border/40 rounded-lg divide-y divide-border/40">
			{crawls.map((crawl) => (
				<button
					key={crawl.id}
					type="button"
					className="w-full p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors bg-transparent border-none text-left"
					onClick={() => onSelectCrawl(crawl)}
				>
					<div className="flex-1 min-w-0">
						<div className="flex items-start justify-between gap-4">
							<div className="flex-1 min-w-0 space-y-1.5">
								<div className="flex items-center gap-2 flex-wrap">
									<PromptQueryCrawlStatusBadge status={crawl.status} />
									{crawl.title && (
										<span className="text-sm font-medium truncate">
											{crawl.title}
										</span>
									)}
									{crawl.provider && (
										<Badge variant="outline" className="text-xs">
											{crawl.provider}
										</Badge>
									)}
								</div>
								<p className="text-sm text-muted-foreground line-clamp-2">
									{crawl.query}
								</p>
								<div className="flex items-center gap-4 text-xs text-muted-foreground">
									<div className="flex items-center gap-1">
										<Calendar className="h-3 w-3" />
										<span>
											{format(new Date(crawl.createdAt), "MMM d, h:mm a")}
										</span>
									</div>
									{crawl.completedAt && (
										<>
											<span className="text-muted-foreground/40">•</span>
											<span>
												Completed <TimeAgo date={crawl.completedAt} />
											</span>
										</>
									)}
									{crawl.loadTimeMs && (
										<>
											<span className="text-muted-foreground/40">•</span>
											<span>{crawl.loadTimeMs}ms</span>
										</>
									)}
								</div>
							</div>
							{crawl.url && (
								<div className="flex-shrink-0 text-right">
									<a
										href={crawl.url}
										target="_blank"
										rel="noopener noreferrer"
										className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
										onClick={(e) => e.stopPropagation()}
									>
										<span className="truncate max-w-[180px]">{crawl.url}</span>
										<ExternalLink className="h-3 w-3 flex-shrink-0" />
									</a>
								</div>
							)}
						</div>
					</div>
				</button>
			))}
		</div>
	);
}
