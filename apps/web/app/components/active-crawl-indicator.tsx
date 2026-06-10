"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
	Spinner,
	Card,
} from "@opencited/ui";
import { useActiveCrawls } from "@/app/hooks/use-active-crawls";
import { formatDistanceToNow } from "date-fns";

interface ActiveCrawlIndicatorProps {
	domainProjectId: string | undefined;
}

export function ActiveCrawlIndicator({
	domainProjectId,
}: ActiveCrawlIndicatorProps) {
	const { activeCrawls } = useActiveCrawls({ domainProjectId });

	if (activeCrawls.length === 0) return null;

	return (
		<div className="fixed bottom-4 right-4 z-50 w-full max-w-80 px-4 sm:px-0">
			<Card className="shadow-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
				<div className="px-4 py-3">
					<div
						className="flex items-center gap-2 mb-4"
						role="status"
						aria-live="polite"
					>
						<span className="text-sm font-medium">
							{activeCrawls.length} active crawl
							{activeCrawls.length > 1 ? "s" : ""}
						</span>
					</div>
					<TooltipProvider>
						<div className="space-y-2">
							{activeCrawls.map((crawl) => (
								<div
									key={crawl.id}
									className="flex items-start gap-2 text-xs border-t pt-2 first:border-t-0 first:pt-0"
								>
									<Spinner className="h-3 w-3 mt-0.5 shrink-0" />
									<div className="min-w-0 flex-1">
										<Tooltip>
											<TooltipTrigger asChild>
												<button
													type="button"
													className="truncate font-medium text-muted-foreground text-left w-full cursor-default bg-transparent border-none p-0"
												>
													{crawl.query}
												</button>
											</TooltipTrigger>
											<TooltipContent side="top" className="max-w-xs">
												<p className="text-xs">{crawl.query}</p>
											</TooltipContent>
										</Tooltip>
										<div className="flex items-center gap-2 mt-1 text-muted-foreground">
											{crawl.startedAt && (
												<span>
													{formatDistanceToNow(new Date(crawl.startedAt))} ago
												</span>
											)}
											{crawl.provider && (
												<>
													<span>&middot;</span>
													<span className="capitalize">{crawl.provider}</span>
												</>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					</TooltipProvider>
				</div>
			</Card>
		</div>
	);
}
