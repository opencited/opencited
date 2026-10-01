"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const GAUGE_SIZE = 132;
const STROKE_WIDTH = 8;
const RADIUS = (GAUGE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ScoreGaugeProps {
	value: number;
	strokeClassName: string;
	label: string;
}

export function ScoreGauge({ value, strokeClassName, label }: ScoreGaugeProps) {
	const [animated, setAnimated] = useState(false);

	useEffect(() => {
		const frame = requestAnimationFrame(() => setAnimated(true));
		return () => cancelAnimationFrame(frame);
	}, []);

	const clamped = Math.max(0, Math.min(100, value));
	const offset = CIRCUMFERENCE * (1 - (animated ? clamped / 100 : 0));

	return (
		<div
			className="relative shrink-0"
			style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}
		>
			<svg
				width={GAUGE_SIZE}
				height={GAUGE_SIZE}
				viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
				role="img"
				aria-label={label}
			>
				<g transform={`rotate(-90 ${GAUGE_SIZE / 2} ${GAUGE_SIZE / 2})`}>
					<circle
						cx={GAUGE_SIZE / 2}
						cy={GAUGE_SIZE / 2}
						r={RADIUS}
						fill="none"
						strokeWidth={STROKE_WIDTH}
						className="stroke-primary/50"
					/>
					<circle
						cx={GAUGE_SIZE / 2}
						cy={GAUGE_SIZE / 2}
						r={RADIUS}
						fill="none"
						strokeWidth={STROKE_WIDTH}
						strokeLinecap="round"
						strokeDasharray={CIRCUMFERENCE}
						strokeDashoffset={offset}
						className={cn(
							"transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none",
							strokeClassName,
						)}
					/>
				</g>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="text-3xl font-semibold tabular-nums tracking-tight">
					{clamped}
				</span>
				<span className="text-xs text-muted-foreground">/ 100</span>
			</div>
		</div>
	);
}
