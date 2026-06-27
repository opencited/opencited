"use client";

import {
	Badge,
	Button,
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
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
import { AlertCircleIcon, ArrowUpDownIcon, HelpCircleIcon } from "lucide-react";
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
	competitorCount: number;
	score: number | null;
	scoreBreakdown: {
		mentionScore: number;
		positionScore: number;
		citationScore: number;
		sentimentScore: number;
		coMentionScore: number;
	} | null;
	formulaVersion: string | null;
	sampleSize: number;
	sentimentIsFallback: boolean;
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
									tooltip="Whether your brand appears as a cited source in the AI response."
								/>
							</TableHead>
							<TableHead>
								<ColumnHeaderWithTooltip
									label="Competitors"
									tooltip="Number of unique competitor brands detected in the AI response. Shows '—' when no competitors are found."
								/>
							</TableHead>
							<TableHead>
								<div className="flex items-center gap-1.5">
									<span>Score</span>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-auto p-0 text-muted-foreground hover:text-foreground transition-colors"
												aria-label="Sort by score"
											>
												<ArrowUpDownIcon className="h-3.5 w-3.5" />
											</Button>
										</TooltipTrigger>
										<TooltipContent
											side="top"
											align="start"
											className="max-w-xs"
										>
											<p className="text-xs">
												AI Visibility Score (0–100) based on mention, position,
												citation, sentiment, and co-mention. Requires at least 3
												successful crawls.
											</p>
										</TooltipContent>
									</Tooltip>
								</div>
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
										<Badge variant="success">Cited</Badge>
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
									<ScoreCell row={row} />
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

function ScoreCell({ row }: { row: VisibilityOverviewRow }) {
	if (row.score === null) {
		let tooltipText =
			"Needs at least 3 successful checks to calculate a score.";
		if (row.totalCrawls === 0) {
			tooltipText = "Run your first check to start building your score.";
		} else if (row.competitorCount === 0) {
			tooltipText =
				"Your score is peer-relative — add at least one tracked competitor to enable scoring.";
		} else if (row.totalCrawls < 3) {
			tooltipText = `${row.totalCrawls} of 3 checks complete. Keep running prompts to calculate your score.`;
		}

		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="flex items-center gap-1.5">
						<span className="text-muted-foreground">—</span>
						<HelpCircleIcon className="h-3.5 w-3.5 text-muted-foreground" />
					</div>
				</TooltipTrigger>
				<TooltipContent side="top" align="start" className="max-w-xs">
					<p className="text-xs">{tooltipText}</p>
				</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<div className="flex items-center gap-1.5">
			<HoverCard openDelay={200} closeDelay={100}>
				<HoverCardTrigger asChild>
					<div className="flex items-center gap-1.5 cursor-help">
						<span className="text-sm font-medium tabular-nums">
							{row.score}
						</span>
					</div>
				</HoverCardTrigger>
				<HoverCardContent
					side="top"
					align="start"
					className="w-72"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="space-y-3">
						<div className="space-y-0.5">
							<h4 className="text-sm font-semibold">Score Breakdown</h4>
							<p className="text-xs text-muted-foreground">
								Mean of {row.sampleSize} crawl{row.sampleSize !== 1 ? "s" : ""}
								{row.formulaVersion ? ` · ${row.formulaVersion}` : ""}
							</p>
						</div>
						{row.scoreBreakdown && (
							<div className="space-y-1.5">
								<SubScoreRow
									label="Mention"
									value={row.scoreBreakdown.mentionScore}
								/>
								<SubScoreRow
									label="Position"
									value={row.scoreBreakdown.positionScore}
								/>
								<SubScoreRow
									label="Citation"
									value={row.scoreBreakdown.citationScore}
								/>
								<SubScoreRow
									label="Sentiment"
									value={row.scoreBreakdown.sentimentScore}
								/>
								<SubScoreRow
									label="Co-mention"
									value={row.scoreBreakdown.coMentionScore}
								/>
							</div>
						)}
					</div>
				</HoverCardContent>
			</HoverCard>
			{row.sentimentIsFallback && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge
							variant="warning"
							size="sm"
							className="cursor-help"
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.stopPropagation();
								}
							}}
						>
							<AlertCircleIcon className="h-3 w-3" />
						</Badge>
					</TooltipTrigger>
					<TooltipContent side="top" align="start" className="max-w-xs">
						<p className="text-xs">
							Sentiment pending retry — score may be understated
						</p>
					</TooltipContent>
				</Tooltip>
			)}
		</div>
	);
}

function getScoreTier(value: number): "high" | "mid" | "low" {
	if (value >= 70) return "high";
	if (value >= 40) return "mid";
	return "low";
}

const TIER_DOT_CLASSES = {
	high: "bg-emerald-500",
	mid: "bg-amber-500",
	low: "bg-muted-foreground/40",
} as const;

function SubScoreRow({ label, value }: { label: string; value: number }) {
	const tier = getScoreTier(value);

	return (
		<div className="flex items-center justify-between text-xs">
			<div className="flex items-center gap-1.5">
				<span
					className={`h-1.5 w-1.5 rounded-full ${TIER_DOT_CLASSES[tier]}`}
				/>
				<span className="text-muted-foreground">{label}</span>
			</div>
			<span className="font-medium tabular-nums">{value}</span>
		</div>
	);
}
