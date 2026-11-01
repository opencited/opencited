"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
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
	const figureRef = useRef<HTMLElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const restoreFocus = useRef(false);
	const { finished, replay, reducedMotion } = useScene(scene, svgRef, stageRef);

	const handleReplay = () => {
		// The button is hidden and out of the tab order while the scene plays, so
		// focus would otherwise fall back to <body>. Park it on the figure and
		// move it back when the replay finishes.
		restoreFocus.current = document.activeElement === buttonRef.current;
		if (restoreFocus.current) {
			figureRef.current?.focus({ preventScroll: true });
		}
		replay();
	};

	useEffect(() => {
		if (!finished || !restoreFocus.current) {
			return;
		}
		restoreFocus.current = false;
		buttonRef.current?.focus({ preventScroll: true });
	}, [finished]);

	return (
		<figure
			ref={figureRef}
			tabIndex={-1}
			className={cn(
				"m-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-marketing-accent focus-visible:ring-offset-2 focus-visible:ring-offset-marketing-paper",
				className,
			)}
		>
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
				{reducedMotion ? null : (
					<button
						ref={buttonRef}
						type="button"
						onClick={handleReplay}
						aria-label="Replay animation"
						aria-hidden={finished ? undefined : true}
						tabIndex={finished ? 0 : -1}
						title="Replay animation"
						className={cn(
							"absolute right-0 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border-[1.25px] border-marketing-faint bg-marketing-paper text-marketing-ink-soft transition-[color,border-color,opacity] duration-200 hover:border-marketing-accent hover:text-marketing-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-accent focus-visible:ring-offset-2 focus-visible:ring-offset-marketing-paper",
							finished ? "opacity-100" : "pointer-events-none opacity-0",
						)}
					>
						<ReplayIcon />
					</button>
				)}
			</figcaption>
		</figure>
	);
}
