"use client";

import {
	Badge,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@opencited/ui";
import {
	ArrowDownIcon,
	ArrowUpIcon,
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
	domainProjectId: string;
}

export function VisibilityTable({
	data,
	domainProjectId,
}: VisibilityTableProps) {
	const [selectedCrawl, setSelectedCrawl] = useState<{
		crawlId: string;
		queryId: string;
	} | null>(null);

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Query</TableHead>
						<TableHead>Last Checked</TableHead>
						<TableHead>Cited</TableHead>
						<TableHead>Brand Mentioned</TableHead>
						<TableHead>Competitors</TableHead>
						<TableHead>Trend</TableHead>
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
								{row.brandMentioned ? (
									<Badge variant="secondary">
										{row.mentionPosition ?? "Mentioned"}
									</Badge>
								) : (
									<span className="text-muted-foreground text-sm">No</span>
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

			{selectedCrawl && (
				<CrawlDetailSheet
					crawlId={selectedCrawl.crawlId}
					queryId={selectedCrawl.queryId}
					domainProjectId={domainProjectId}
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
