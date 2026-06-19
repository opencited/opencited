"use client";

import {
	DataList,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	Spinner,
} from "@opencited/ui";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { QueryCell } from "@/app/components/query-cell";
import { TimeAgo } from "@/app/components/time-ago";
import { MentionTypeBadge } from "../../ai-visibility/_components/mention-type-badge";

interface CompetitorDetailSheetProps {
	competitorId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CompetitorDetailSheet({
	competitorId,
	open,
	onOpenChange,
}: CompetitorDetailSheetProps) {
	const trpc = useTRPC();

	const query = useQuery({
		...trpc.aiVisibility.getCompetitorDetail.queryOptions({
			competitorId,
			domainProjectId: "",
		}),
		enabled: open,
	});

	const data = query.data;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="max-w-3xl w-full flex flex-col">
				<SheetHeader>
					<SheetTitle>{data?.competitor.name ?? "Loading..."}</SheetTitle>
					<SheetDescription>
						{data?.competitor.domain && (
							<span className="font-mono text-sm">
								{data.competitor.domain}
							</span>
						)}
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto mt-6">
					<QueryCell
						query={query}
						loading={
							<div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
								<Spinner className="size-4" />
								<span>Loading mentions...</span>
							</div>
						}
						success={(data) => {
							if (!data.mentions || data.mentions.length === 0) {
								return (
									<div className="py-8 text-center text-muted-foreground">
										<p>No mentions found</p>
									</div>
								);
							}

							return (
								<DataList
									items={data.mentions}
									keyExtractor={(mention) => mention.crawlId}
									renderItem={(mention) => (
										<div className="space-y-2">
											<div className="flex items-center gap-2 flex-wrap">
												<p className="text-sm font-medium line-clamp-1">
													{mention.query}
												</p>
												<MentionTypeBadge type={mention.mentionType} />
											</div>

											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<TimeAgo date={mention.crawlDate} />
											</div>

											<p className="text-sm">{mention.context}</p>
										</div>
									)}
								/>
							);
						}}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
