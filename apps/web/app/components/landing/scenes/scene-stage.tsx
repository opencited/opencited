"use client";

import { cn } from "@/lib/utils";
import { useRef } from "react";
import { type SceneDefinition, type SceneLayout, useScene } from "./use-scene";

function ReplayIcon() {
	return (
		<svg
			width={16}
			height={16}
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<g
				stroke="currentColor"
				strokeWidth={1.875}
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
				<path d="M3 3v5h5" />
			</g>
		</svg>
	);
}

type SceneStageProps<L extends SceneLayout> = {
	scene: SceneDefinition<L>;
	/** Text alternative for the drawing. */
	label: string;
	caption: string;
	/** Stage sizing: max width and the per-breakpoint aspect ratio. */
	stageClassName?: string;
	className?: string;
};

export function SceneStage<L extends SceneLayout>({
	scene,
	label,
	caption,
	stageClassName,
	className,
}: SceneStageProps<L>) {
	const stageRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const { finished, replay } = useScene(scene, svgRef, stageRef);

	return (
		<figure className={cn("m-0", className)}>
			<div
				ref={stageRef}
				className={cn("landing-scene relative w-full", stageClassName)}
			>
				<svg
					ref={svgRef}
					role="img"
					aria-label={label}
					preserveAspectRatio="xMidYMin meet"
					className="block h-full w-full overflow-visible"
				/>
			</div>
			<figcaption className="relative mt-3.5 flex min-h-8 items-center justify-center px-10">
				<span className="text-center font-mono text-[11px] leading-relaxed tracking-[0.03em] text-marketing-soft">
					{caption}
				</span>
				{finished ? (
					<button
						type="button"
						onClick={replay}
						aria-label="Replay animation"
						title="Replay animation"
						className="absolute right-0 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border-[1.25px] border-marketing-faint bg-marketing-paper text-marketing-ink-soft transition-colors hover:border-marketing-accent hover:text-marketing-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-accent focus-visible:ring-offset-2 focus-visible:ring-offset-marketing-paper"
					>
						<ReplayIcon />
					</button>
				) : null}
			</figcaption>
		</figure>
	);
}
