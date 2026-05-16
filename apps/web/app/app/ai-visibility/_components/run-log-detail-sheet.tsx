"use client";

import type { AppRouter } from "@opencited/trpc";
import {
	Badge,
	Card,
	CardContent,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@opencited/ui";
import type { inferRouterOutputs } from "@trpc/server";
import { format, formatDistanceStrict } from "date-fns";
import { AlertCircle, Calendar, Clock, ExternalLink } from "lucide-react";
import { PromptQueryCrawlStatusBadge } from "@/app/components/prompt-query-crawl-status-badge";
import { TimeAgo } from "@/app/components/time-ago";
import { AnswerFormatBadge } from "./answer-format-badge";

type RunLog =
	inferRouterOutputs<AppRouter>["aiVisibility"]["listRunLogs"]["runs"][number];

interface RunLogDetailSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	run: RunLog | null;
}

export function RunLogDetailSheet({
	open,
	onOpenChange,
	run,
}: RunLogDetailSheetProps) {
	if (!run) return null;

	const duration =
		run.startedAt && run.completedAt
			? formatDistanceStrict(new Date(run.startedAt), new Date(run.completedAt))
			: null;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="max-w-3xl w-full flex flex-col">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						<PromptQueryCrawlStatusBadge status={run.status} />
						<span className="truncate">{run.query}</span>
					</SheetTitle>
					<SheetDescription className="flex items-center gap-4 text-xs">
						<div className="flex items-center gap-1">
							<Calendar className="h-3 w-3" />
							<span>
								Created <TimeAgo date={run.createdAt} />
							</span>
						</div>
						{run.startedAt && (
							<div className="flex items-center gap-1">
								<Clock className="h-3 w-3" />
								<span>
									Started {format(new Date(run.startedAt), "MMM d, h:mm a")}
								</span>
							</div>
						)}
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto mt-6 space-y-6">
					{run.error && (
						<Card variant="destructive">
							<CardContent className="p-4">
								<div className="flex items-start gap-2">
									<AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
									<div>
										<p className="text-sm text-destructive font-medium">
											Error
										</p>
										<p className="text-sm text-destructive mt-1">{run.error}</p>
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					<div className="grid grid-cols-2 gap-3">
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-1">Provider</p>
								<p className="text-sm font-medium">{run.provider || "N/A"}</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-1">Load Time</p>
								<p className="text-sm font-medium">
									{run.loadTimeMs ? `${run.loadTimeMs}ms` : "N/A"}
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-1">Duration</p>
								<p className="text-sm font-medium">{duration ?? "N/A"}</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-1">
									Answer Format
								</p>
								<div className="mt-1">
									<AnswerFormatBadge format={run.answerFormat} />
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-1">Word Count</p>
								<p className="text-sm font-medium">
									{run.wordCount?.toLocaleString() ?? 0}
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-1">
									Source Count
								</p>
								<p className="text-sm font-medium">{run.sourceCount ?? 0}</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-1">
									Brand Mentions
								</p>
								<p className="text-sm font-medium">
									{run.brandMentionCount ?? 0}
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-1">Status</p>
								<div className="mt-1">
									<PromptQueryCrawlStatusBadge status={run.status} />
								</div>
							</CardContent>
						</Card>
					</div>

					{run.url && (
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-2">Source URL</p>
								<a
									href={run.url}
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm text-primary hover:underline flex items-center gap-1"
								>
									<span className="truncate">{run.url}</span>
									<ExternalLink className="h-3 w-3 flex-shrink-0" />
								</a>
							</CardContent>
						</Card>
					)}

					{run.triggerRunId && (
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-1">
									Trigger Run ID
								</p>
								<Badge variant="outline" className="font-mono text-xs">
									{run.triggerRunId}
								</Badge>
							</CardContent>
						</Card>
					)}

					{run.promptSnapshot && (
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-2">
									Prompt Snapshot
								</p>
								<p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md max-h-[200px] overflow-y-auto">
									{run.promptSnapshot}
								</p>
							</CardContent>
						</Card>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
