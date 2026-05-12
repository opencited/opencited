"use client";

import { useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	Button,
	Card,
	CardContent,
} from "@opencited/ui";
import { Copy, ExternalLink, Calendar, Clock } from "lucide-react";
import { PromptQueryCrawlStatusBadge } from "@/app/components/prompt-query-crawl-status-badge";
import { TimeAgo } from "@/app/components/time-ago";
import { toast } from "sonner";

interface CrawlResult {
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

interface CrawlResultsSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	crawl: CrawlResult | null;
}

export function CrawlResultsSheet({
	open,
	onOpenChange,
	crawl,
}: CrawlResultsSheetProps) {
	const [isCopying, setIsCopying] = useState(false);

	if (!crawl) return null;

	const handleCopy = async () => {
		if (!crawl.content) return;

		setIsCopying(true);
		try {
			await navigator.clipboard.writeText(crawl.content);
			toast.success("Content copied to clipboard");
		} catch {
			toast.error("Failed to copy content");
		} finally {
			setIsCopying(false);
		}
	};

	const wordCount = crawl.content
		? crawl.content.split(/\s+/).filter((w) => w.length > 0).length
		: 0;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="max-w-3xl w-full flex flex-col">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						<PromptQueryCrawlStatusBadge status={crawl.status} />
						<span className="truncate">{crawl.title || "Crawl Result"}</span>
					</SheetTitle>
					<SheetDescription className="flex items-center gap-4 text-xs">
						<div className="flex items-center gap-1">
							<Calendar className="h-3 w-3" />
							<span>
								Created <TimeAgo date={crawl.createdAt} />
							</span>
						</div>
						{crawl.startedAt && (
							<div className="flex items-center gap-1">
								<Clock className="h-3 w-3" />
								<span>
									Started <TimeAgo date={crawl.startedAt} />
								</span>
							</div>
						)}
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto mt-6 space-y-6">
					{crawl.error && (
						<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
							<p className="text-sm text-destructive font-medium">Error</p>
							<p className="text-sm text-destructive mt-1">{crawl.error}</p>
						</div>
					)}

					<div className="grid grid-cols-2 gap-3">
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-1">Provider</p>
								<p className="text-sm font-medium">{crawl.provider || "N/A"}</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-1">Load Time</p>
								<p className="text-sm font-medium">
									{crawl.loadTimeMs ? `${crawl.loadTimeMs}ms` : "N/A"}
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-1">Word Count</p>
								<p className="text-sm font-medium">
									{wordCount.toLocaleString()}
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-1">Status</p>
								<p className="text-sm font-medium capitalize">
									{crawl.status || "N/A"}
								</p>
							</CardContent>
						</Card>
					</div>

					{crawl.url && (
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-2">Source URL</p>
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

					<Card>
						<div className="flex items-center justify-between p-3">
							<p className="text-xs text-muted-foreground">Content</p>
							<Button
								variant="outline"
								size="sm"
								onClick={handleCopy}
								disabled={!crawl.content || isCopying}
								className="h-8"
							>
								<Copy className="h-3 w-3 mr-2" />
								{isCopying ? "Copying..." : "Copy"}
							</Button>
						</div>
						<CardContent className="p-4">
							<div className="prose prose-sm dark:prose-invert max-w-none">
								<div
									className="text-sm whitespace-pre-wrap max-h-[350px] overflow-y-auto"
									dangerouslySetInnerHTML={{
										__html: crawl.content || "No content available",
									}}
								/>
							</div>
						</CardContent>
					</Card>
				</div>
			</SheetContent>
		</Sheet>
	);
}
