"use client";

import { useEffect, useRef } from "react";

const GAP = 32;

/** Shared vertical trunk before lines bend into the puck. */
const QUERY_INPUT_SPINE_X = 96;

const PUCK_CX = 132;
const PUCK_CY = 100;
const PUCK_R = 22;

const OUTPUT_SPINE_X = PUCK_CX + PUCK_R + 20;

const Q1_Y = PUCK_CY - GAP;
const Q2_Y = PUCK_CY;
const Q3_Y = PUCK_CY + GAP;

const SITE_X = 220;
const SITE_Y = 8;
const SITE_W = 228;
const SITE_H = 160;
const TICK_X = SITE_X + 34;
const TICK_R = 6.5;
const TICK_Y = 96;

const RIVAL_W = 114;
const RIVAL_H = 80;
const RIVAL_X = SITE_X + SITE_W + 12;
const RIVAL_Q2_Y = 184;
const RIVAL_Q3_Y = 272;

const SITE_BOTTOM = SITE_Y + SITE_H;
const QUERY_FONT_SIZE = 14;
/** Horizontal space between label column and connector start. */
const QUERY_TEXT_LINE_GAP = 8;
const QUERY_LABEL_X = 8;
/** Fixed column so connector starts one gap after the longest label. */
const QUERY_LABEL_COLUMN_WIDTH = 56;
const QUERY_LINE_START_X =
	QUERY_LABEL_X + QUERY_LABEL_COLUMN_WIDTH + QUERY_TEXT_LINE_GAP;
const QUERY_LABEL_END_X = QUERY_LINE_START_X - QUERY_TEXT_LINE_GAP;
/** Aligns middle baseline with visual center for 14px UI sans. */
const QUERY_LABEL_CENTER_NUDGE_Y = 1.41;

const QUERIES = [
	{
		label: "Query 1",
		y: Q1_Y,
		landY: TICK_Y,
		landsOnSite: true,
		trace: "score-card-q1",
		labelTrace: "score-card-q1-label",
	},
	{
		label: "Query 2",
		y: Q2_Y,
		landY: RIVAL_Q2_Y,
		domain: "other.com",
		landsOnSite: false,
		trace: "score-card-q2",
		labelTrace: "score-card-q2-label",
	},
	{
		label: "Query 3",
		y: Q3_Y,
		landY: RIVAL_Q3_Y,
		domain: "another.com",
		landsOnSite: false,
		trace: "score-card-q3",
		labelTrace: "score-card-q3-label",
	},
] as const;

const SITE_CHECKS = [
	{ label: "JSON-LD", y: 118, trace: "score-card-json" },
	{ label: "llms.txt", y: 140, trace: "score-card-llms" },
] as const;

const PERPLEXITY_MARK =
	"m23.566,1.398l-9.495,9.504h9.495V1.398v2.602V1.398Zm-9.496,9.504L4.574,1.398v9.504h9.496Zm-.021-10.902v36m9.517-15.596l-9.495-9.504v13.625l9.495,9.504v-13.625Zm-18.991,0l9.496-9.504v13.625l-9.496,9.504v-13.625ZM.5,10.9v13.57h4.074v-4.066l9.496-9.504H.5Zm13.57,0l9.495,9.504v4.066h4.075v-13.57h-13.57Z";

function localCheck(y: number) {
	const start = SITE_X + 102;
	return `M ${start} ${y} H ${start + 24} l 3 3.6 l 5.8 -7.2`;
}

/** `query.y` is the y of the horizontal segment (row origin; shared with path math). */
function queryLineY(query: (typeof QUERIES)[number]) {
	return query.y;
}

function queryInputPath(lineY: number) {
	const puckLeft = PUCK_CX - PUCK_R;
	return `M ${QUERY_LINE_START_X} ${lineY} H ${QUERY_INPUT_SPINE_X} V ${PUCK_CY} H ${puckLeft}`;
}

function queryOutputPath(query: (typeof QUERIES)[number]) {
	const puckRight = PUCK_CX + PUCK_R;
	if (query.landsOnSite) {
		return `M ${puckRight} ${PUCK_CY} H ${OUTPUT_SPINE_X} V ${TICK_Y} H ${TICK_X - TICK_R}`;
	}
	const channelY =
		query.landY === RIVAL_Q2_Y
			? SITE_BOTTOM + 10
			: RIVAL_Q2_Y + RIVAL_H / 2 + 24;
	return `M ${puckRight} ${PUCK_CY} H ${OUTPUT_SPINE_X} V ${channelY} H ${RIVAL_X} V ${query.landY}`;
}

function queryPath(query: (typeof QUERIES)[number]) {
	const lineY = queryLineY(query);
	return `${queryInputPath(lineY)} ${queryOutputPath(query)}`;
}

const SVG_WIDTH = RIVAL_X + RIVAL_W + 32;
const SVG_HEIGHT = RIVAL_Q3_Y + RIVAL_H / 2 + 48;

export function ScoreCardArtifact() {
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const node = rootRef.current;
		if (!node) return;

		const observer = new IntersectionObserver(([entry]) => {
			node.dataset.playing = entry?.isIntersecting ? "true" : "false";
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			ref={rootRef}
			className="score-card-artifact pointer-events-none mx-auto w-full max-w-104"
			aria-hidden="true"
			data-playing="true"
		>
			<svg
				viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
				fill="none"
				aria-hidden="true"
				className="h-auto w-full font-sans text-foreground"
			>
				<rect
					x={SITE_X}
					y={SITE_Y}
					width={SITE_W}
					height={SITE_H}
					className="fill-background stroke-border"
					strokeWidth="1"
				/>
				{QUERIES.filter((query) => !query.landsOnSite).map((query) => (
					<rect
						key={query.label}
						x={RIVAL_X}
						y={query.landY - RIVAL_H / 2}
						width={RIVAL_W}
						height={RIVAL_H}
						className="fill-background stroke-border"
						strokeWidth="1"
					/>
				))}
				<text
					x={SITE_X + SITE_W / 2}
					y={28}
					textAnchor="middle"
					dominantBaseline="middle"
					fontSize="13"
					fontWeight="500"
					className="fill-foreground"
				>
					yoursite.com
				</text>
				<text
					x={SITE_X + SITE_W / 2}
					y={62}
					textAnchor="middle"
					dominantBaseline="middle"
					fontSize="32"
					fontWeight="600"
					letterSpacing="-0.02em"
					className="score-card-number fill-foreground tabular-nums"
				>
					64
				</text>
				<line
					x1={SITE_X + 16}
					y1={84}
					x2={SITE_X + SITE_W - 16}
					y2={84}
					className="stroke-border"
					strokeWidth="1"
				/>
				{SITE_CHECKS.map((check) => (
					<text
						key={check.label}
						x={SITE_X + 16}
						y={check.y}
						dominantBaseline="middle"
						fontSize="13"
						className="fill-foreground font-mono"
					>
						{check.label}
					</text>
				))}
				{SITE_CHECKS.map((check) => (
					<path
						key={check.label}
						d={localCheck(check.y)}
						pathLength={100}
						className={`${check.trace} stroke-foreground`}
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				))}
				{QUERIES.filter((query) => !query.landsOnSite).map((query) => (
					<text
						key={query.label}
						x={RIVAL_X + RIVAL_W / 2}
						y={query.landY - RIVAL_H / 2 + 20}
						textAnchor="middle"
						dominantBaseline="middle"
						fontSize="12"
						fontWeight="500"
						className="fill-foreground"
					>
						{query.domain}
					</text>
				))}
				{QUERIES.map((query) => (
					<path
						key={query.label}
						d={queryPath(query)}
						pathLength={100}
						className={`${query.trace} stroke-foreground`}
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				))}
				<circle
					cx={PUCK_CX}
					cy={PUCK_CY}
					r={PUCK_R}
					className="fill-background stroke-border"
					strokeWidth="1"
				/>
				<svg
					x={PUCK_CX - 11}
					y={PUCK_CY - 14}
					width="22"
					height="28"
					viewBox="0 0 28 37"
					aria-hidden="true"
				>
					<path
						d={PERPLEXITY_MARK}
						fill="none"
						className="stroke-foreground"
						strokeWidth="1.35"
						strokeLinejoin="miter"
					/>
				</svg>
				{QUERIES.map((query) => (
					<g key={query.label} transform={`translate(0, ${query.y})`}>
						<text
							x={QUERY_LABEL_END_X}
							y={QUERY_LABEL_CENTER_NUDGE_Y}
							textAnchor="end"
							dominantBaseline="middle"
							fontSize={QUERY_FONT_SIZE}
							className={query.labelTrace}
						>
							{query.label}
						</text>
					</g>
				))}
				<g transform={`translate(${TICK_X} ${TICK_Y})`}>
					<circle
						r={TICK_R}
						className="fill-background stroke-foreground"
						strokeWidth="1.5"
					/>
					<circle r={TICK_R} className="score-card-tick-fill" />
					<path
						d="M -2.6 0.2 L -0.6 2.2 L 2.8 -1.8"
						fill="none"
						className="score-card-tick-mark"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</g>
			</svg>
		</div>
	);
}
