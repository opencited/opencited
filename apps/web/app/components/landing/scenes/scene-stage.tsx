"use client";

import { cn } from "@/lib/utils";
import { useRef } from "react";
import { type SceneDefinition, type SceneLayout, useScene } from "./use-scene";

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
	useScene(scene, svgRef, stageRef);

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
			<figcaption className="mt-3.5 text-center font-mono text-[11px] leading-relaxed tracking-[0.03em] text-marketing-soft">
				{caption}
			</figcaption>
		</figure>
	);
}
