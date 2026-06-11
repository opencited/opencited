"use client";

import {
	Badge,
	Button,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@opencited/ui";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	HelpCircleIcon,
	MinusIcon,
	SparklesIcon,
} from "lucide-react";
import { useState } from "react";
import { TimeAgo } from "@/app/components/time-ago";
import { CrawlDetailSheet } from "./crawl-detail-sheet";

interface VisibilityOverviewRow {
	queryId: string;
	query: string;
	lastChecked: string | null;
	totalCrawls: number;
	latestCrawlId: string | null;
	latestCrawlStatus: string | null;
	cited: boolean;
	citationPosition: number | null;
	brandMentioned: boolean;
	mentionPosition: string | null;
	competitorCount: number;
	trend: "up" | "down" | "same" | "new";
	previousCitationPosition: number | null;
}

interface VisibilityTableProps {
	data: VisibilityOverviewRow[];
}

export function VisibilityTable({ data }: VisibilityTableProps) {
	const [selectedCrawl, setSelectedCrawl] = useState<{
		crawlId: string;
		queryId: string;
	} | null>(null);

	return (
		<>
			<TooltipProvider delayDuration={0}>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>
								<ColumnHeaderWithTooltip
									label="Query"
									tooltip="The AI search prompt being tracked. Truncated if longer than 120 characters."
								/>
							</TableHead>
							<TableHead>
								<ColumnHeaderWithTooltip
									label="Last Checked"
									tooltip="When this query was last crawled. Shows the completion time, or creation time if not yet completed. Displays 'Never' if no crawls exist."
								/>
							</TableHead>
							<TableHead>
								<ColumnHeaderWithTooltip
									label="Cited"
									tooltip="Whether your brand appears as a cited source in the AI response. Shows the position number in the source list, or just 'Cited' if position is unavailable."
								/>
							</TableHead>
							<TableHead>
								<ColumnHeaderWithTooltip
									label="Competitors"
									tooltip="Number of unique competitor brands detected in the AI response. Shows '—' when no competitors are found."
								/>
							</TableHead>
							<TableHead>
								<ColumnHeaderWithTooltip
									label="Trend"
									tooltip={
										<div className="space-y-1">
											<p>
												How your citation ranking changed compared to the
												previous crawl.
											</p>
											<ul className="list-none space-y-0.5">
												<li className="flex items-center gap-1.5">
													<ArrowUpIcon className="h-3 w-3 text-emerald-600" />
													<span>Improved = moved to a better position</span>
												</li>
												<li className="flex items-center gap-1.5">
													<ArrowDownIcon className="h-3 w-3 text-destructive" />
													<span>Declined = moved to a worse position</span>
												</li>
												<li className="flex items-center gap-1.5">
													<MinusIcon className="h-3 w-3 text-muted-foreground" />
													<span>No change = same position</span>
												</li>
												<li className="flex items-center gap-1.5">
													<SparklesIcon className="h-3 w-3 text-muted-foreground" />
													<span>New = first time being tracked</span>
												</li>
											</ul>
										</div>
									}
								/>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.map((row) => (
							<TableRow
								key={row.queryId}
								className="cursor-pointer"
								onClick={() => {
									if (row.latestCrawlId) {
										setSelectedCrawl({
											crawlId: row.latestCrawlId,
											queryId: row.queryId,
										});
									}
								}}
							>
								<TableCell className="max-w-[300px]">
									<p className="line-clamp-2 text-sm">{row.query}</p>
								</TableCell>
								<TableCell>
									{row.lastChecked ? (
										<TimeAgo date={new Date(row.lastChecked)} />
									) : (
										<span className="text-muted-foreground">Never</span>
									)}
								</TableCell>
								<TableCell>
									{row.cited ? (
										<Badge variant="success">
											{row.citationPosition !== null
												? `Position ${row.citationPosition}`
												: "Cited"}
										</Badge>
									) : (
										<Badge variant="outline">Not cited</Badge>
									)}
								</TableCell>
								<TableCell>
									{row.competitorCount > 0 ? (
										<span className="text-sm">{row.competitorCount}</span>
									) : (
										<span className="text-muted-foreground">—</span>
									)}
								</TableCell>
								<TableCell>
									<TrendIndicator trend={row.trend} />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TooltipProvider>

			{selectedCrawl && (
				<CrawlDetailSheet
					crawlId={selectedCrawl.crawlId}
					open={!!selectedCrawl}
					onOpenChange={(open) => {
						if (!open) setSelectedCrawl(null);
					}}
				/>
			)}
		</>
	);
}

function TrendIndicator({ trend }: { trend: "up" | "down" | "same" | "new" }) {
	const config = {
		up: {
			icon: <ArrowUpIcon className="h-3.5 w-3.5" />,
			label: "Improved",
			className: "text-emerald-600",
		},
		down: {
			icon: <ArrowDownIcon className="h-3.5 w-3.5" />,
			label: "Declined",
			className: "text-destructive",
		},
		same: {
			icon: <MinusIcon className="h-3.5 w-3.5" />,
			label: "No change",
			className: "text-muted-foreground",
		},
		new: {
			icon: <SparklesIcon className="h-3.5 w-3.5" />,
			label: "New",
			className: "text-muted-foreground",
		},
	};

	const { icon, label, className } = config[trend];

	return (
		<div className={`flex items-center gap-1.5 text-sm ${className}`}>
			{icon}
			<span>{label}</span>
		</div>
	);
}

function ColumnHeaderWithTooltip({
	label,
	tooltip,
}: {
	label: string;
	tooltip: React.ReactNode;
}) {
	return (
		<div className="flex items-center gap-1.5">
			<span>{label}</span>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-auto p-0 text-muted-foreground hover:text-foreground transition-colors"
						aria-label={`Info about ${label}`}
					>
						<HelpCircleIcon className="h-3.5 w-3.5" />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="top" align="start" className="max-w-xs">
					{typeof tooltip === "string" ? (
						<p className="text-xs">{tooltip}</p>
					) : (
						<div className="text-xs">{tooltip}</div>
					)}
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
