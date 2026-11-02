"use client";

import {
	Button,
	EntityCard,
	EntityCardContent,
	EntityCardHeader,
	EntityCardTitle,
	EntityCardValue,
	Progress,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@opencited/ui";
import Link from "next/link";
import {
	Area,
	AreaChart,
	Tooltip as ChartTooltip,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import { ScoreExplainerTooltip } from "@/app/components/score-explainer-tooltip";

const COLD_START_MIN_CRAWLS = 3;

function averageSubScores(
	scores: PerBrandPerEngineScore[],
	key:
		| "mentionScoreNorm"
		| "positionScoreNorm"
		| "citationScoreNorm"
		| "sentimentScoreNorm"
		| "coMentionScoreNorm",
) {
	if (scores.length === 0) return 0;
	return Math.round(scores.reduce((s, e) => s + e[key], 0) / scores.length);
}

interface PerBrandPerEngineScore {
	engine: string;
	displayName: string;
	paused: boolean;
	disabledReason: string | null;
	includedInScore: boolean;
	mentionScoreNorm: number;
	positionScoreNorm: number;
	citationScoreNorm: number;
	sentimentScoreNorm: number;
	coMentionScoreNorm: number;
	score: number;
}

interface TrendPoint {
	date: string;
	score: number | null;
}

interface VisibilityScoreCardProps {
	crossEngineScore: number | null;
	scoreIncludesPausedEngines: boolean;
	perBrandPerEngineScores: PerBrandPerEngineScore[];
	trend: TrendPoint[];
	totalCompletedCrawls: number;
	activeCompetitorCount: number;
	maxCrawlsPerEngine: number;
}

function CustomTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: Array<{ value: number }>;
	label?: string;
}) {
	if (!active || !payload?.length) return null;

	const [year, month, day] = (label as string).split("-").map(Number);
	const date = new Date(year as number, (month as number) - 1, day as number);
	const formattedDate = date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});

	const value = payload[0]?.value;
	if (value === undefined) return null;

	return (
		<div className="rounded-md border border-border bg-background px-3 py-2 shadow-sm">
			<p className="text-xs font-medium text-foreground mb-1">
				{formattedDate}
			</p>
			<div className="flex items-center gap-2">
				<div className="h-2 w-2 rounded-sm bg-foreground" />
				<span className="text-xs text-muted-foreground">Score</span>
				<span className="text-xs font-medium text-foreground ml-auto tabular-nums">
					{value}
				</span>
			</div>
		</div>
	);
}

function Sparkline({ data }: { data: TrendPoint[] }) {
	const chartData = data
		.filter((p) => p.score !== null)
		.map((p) => ({
			date: p.date,
			score: p.score as number,
		}));

	if (chartData.length === 0) {
		return (
			<div className="h-24 flex items-center justify-center">
				<span className="text-xs text-muted-foreground">No trend data yet</span>
			</div>
		);
	}

	return (
		<div className="h-24 w-full">
			<ResponsiveContainer width="100%" height="100%">
				<AreaChart
					data={chartData}
					margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
				>
					<XAxis
						dataKey="date"
						tick={false}
						axisLine={false}
						tickLine={false}
						height={0}
					/>
					<YAxis
						tick={false}
						axisLine={false}
						tickLine={false}
						width={0}
						domain={["auto", "auto"]}
					/>
					<ChartTooltip
						content={<CustomTooltip />}
						cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
					/>
					<Area
						type="monotone"
						dataKey="score"
						stroke="var(--color-foreground)"
						strokeWidth={2}
						fill="var(--color-foreground)"
						fillOpacity={0.1}
						activeDot={{ r: 4, strokeWidth: 0 }}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}

function EngineBar({ engine }: { engine: PerBrandPerEngineScore }) {
	const reasonId = `engine-paused-${engine.engine}`;
	const pausedLabel = engine.includedInScore
		? "Paused"
		: "Paused · not in score";

	return (
		<div className={engine.paused ? "opacity-60" : undefined}>
			<div className="mb-1 flex items-center gap-2">
				<span className="truncate text-xs text-muted-foreground">
					{engine.displayName}
				</span>
				{engine.paused ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								aria-describedby={reasonId}
								className="text-xs text-muted-foreground"
							>
								{pausedLabel}
							</button>
						</TooltipTrigger>
						<TooltipContent>
							<p className="max-w-xs text-xs">
								{engine.disabledReason ??
									"This engine is temporarily unavailable."}
							</p>
						</TooltipContent>
					</Tooltip>
				) : null}
			</div>
			<span id={reasonId} className="sr-only">
				{engine.disabledReason}
			</span>
			<div className="flex items-center gap-3">
				<div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
					<div
						className="h-full bg-foreground transition-[width] duration-300 ease-out"
						style={{ width: `${engine.score}%` }}
					/>
				</div>
				<span className="w-8 text-right text-xs font-medium tabular-nums">
					{engine.score}
				</span>
			</div>
		</div>
	);
}

export function VisibilityScoreCard({
	crossEngineScore,
	scoreIncludesPausedEngines,
	perBrandPerEngineScores,
	trend,
	totalCompletedCrawls,
	activeCompetitorCount,
	maxCrawlsPerEngine,
}: VisibilityScoreCardProps) {
	if (totalCompletedCrawls === 0) {
		return (
			<EntityCard size="md">
				<EntityCardContent size="md">
					<EntityCardHeader>
						<EntityCardTitle>AI Visibility Score</EntityCardTitle>
					</EntityCardHeader>
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<p className="text-sm text-foreground mb-1.5">
							Run your first prompt to see your AI Visibility Score
						</p>
						<p className="text-xs text-muted-foreground mb-4">
							Track where your brand appears in AI-generated answers
						</p>
						<Button asChild size="sm">
							<Link href="/app/prompts">Create a Prompt</Link>
						</Button>
					</div>
				</EntityCardContent>
			</EntityCard>
		);
	}

	if (activeCompetitorCount === 0) {
		return (
			<EntityCard size="md">
				<EntityCardContent size="md">
					<EntityCardHeader
						icon={<ScoreExplainerTooltip iconSize="sm" />}
						iconPosition="right"
					>
						<EntityCardTitle>AI Visibility Score</EntityCardTitle>
					</EntityCardHeader>
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<p className="text-sm text-foreground mb-1.5">
							Add a competitor to enable scoring
						</p>
						<p className="text-xs text-muted-foreground mb-4">
							Your score is calculated relative to your tracked competitors
						</p>
						<Button asChild size="sm">
							<Link href="/app/competitors">Add Competitor</Link>
						</Button>
					</div>
				</EntityCardContent>
			</EntityCard>
		);
	}

	if (crossEngineScore === null) {
		const progress = Math.min(maxCrawlsPerEngine, COLD_START_MIN_CRAWLS);
		const progressPercent = (progress / COLD_START_MIN_CRAWLS) * 100;

		return (
			<EntityCard size="md">
				<EntityCardContent size="md">
					<EntityCardHeader
						icon={<ScoreExplainerTooltip iconSize="sm" />}
						iconPosition="right"
					>
						<EntityCardTitle>AI Visibility Score</EntityCardTitle>
					</EntityCardHeader>
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<p className="text-sm text-foreground mb-1.5">
							{progress} of {COLD_START_MIN_CRAWLS} checks needed for your first
							score
						</p>
						<p className="text-xs text-muted-foreground mb-4">
							Keep running prompts to build your score
						</p>
						<div className="w-full max-w-[200px]">
							<Progress value={progressPercent} className="h-1.5" />
						</div>
					</div>
				</EntityCardContent>
			</EntityCard>
		);
	}

	const includedScores = perBrandPerEngineScores.filter(
		(engine) => engine.includedInScore,
	);

	return (
		<EntityCard size="md">
			<EntityCardContent size="md">
				<EntityCardHeader
					icon={
						<ScoreExplainerTooltip
							iconSize="sm"
							composite={crossEngineScore}
							subScores={
								includedScores.length > 0
									? {
											mention: averageSubScores(
												includedScores,
												"mentionScoreNorm",
											),
											position: averageSubScores(
												includedScores,
												"positionScoreNorm",
											),
											citation: averageSubScores(
												includedScores,
												"citationScoreNorm",
											),
											sentiment: averageSubScores(
												includedScores,
												"sentimentScoreNorm",
											),
											coMention: averageSubScores(
												includedScores,
												"coMentionScoreNorm",
											),
										}
									: undefined
							}
							label="Cross-engine score"
						/>
					}
					iconPosition="right"
				>
					<EntityCardTitle>AI Visibility Score</EntityCardTitle>
				</EntityCardHeader>
				<EntityCardValue size="lg">{crossEngineScore}</EntityCardValue>
				{scoreIncludesPausedEngines ? (
					<p className="mt-2 text-xs text-muted-foreground">
						Every answer engine is paused, so this score includes runs from
						paused engines.
					</p>
				) : null}

				<div className="mt-5 space-y-4">
					<div>
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
							Per-engine breakdown
						</p>
						<TooltipProvider>
							<div className="space-y-2">
								{perBrandPerEngineScores.map((engine) => (
									<EngineBar key={engine.engine} engine={engine} />
								))}
							</div>
						</TooltipProvider>
					</div>

					<div>
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
							Last 30 days
						</p>
						<Sparkline data={trend} />
					</div>
				</div>
			</EntityCardContent>
		</EntityCard>
	);
}
