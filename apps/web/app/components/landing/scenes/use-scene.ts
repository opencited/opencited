"use client";

import { useEffect, type RefObject } from "react";
import { SvgCanvas } from "./engine";

export const SCENE_MOBILE_QUERY = "(max-width: 767.98px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export type SceneLayout = { W: number; H: number };

export type SceneDefinition<L extends SceneLayout> = {
	/** Stable id, used for debugging and as a React key. */
	id: string;
	/** Loop length in seconds. */
	duration: number;
	/** A moment where every element is in its final, readable state. */
	finalTime: number;
	layout: (mobile: boolean, canvas: SvgCanvas) => L;
	build: (canvas: SvgCanvas, layout: L) => (time: number) => void;
};

/**
 * Drives one scene.
 *
 * - Runs a rAF clock only while the stage is on screen and the tab is visible.
 * - With reduced motion, draws the final frame once and never starts the clock.
 * - Rebuilds when the mobile/desktop layout flips.
 * - Starts from time 0, so the pre-JS empty stage is the animation's start state.
 */
export function useScene<L extends SceneLayout>(
	scene: SceneDefinition<L>,
	svgRef: RefObject<SVGSVGElement | null>,
	stageRef: RefObject<HTMLDivElement | null>,
): void {
	useEffect(() => {
		const svg = svgRef.current;
		const stage = stageRef.current;
		if (!svg || !stage) {
			return;
		}

		const layoutQuery = window.matchMedia(SCENE_MOBILE_QUERY);
		const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);

		let canvas: SvgCanvas | null = null;
		let render: ((time: number) => void) | null = null;
		let builtMode: boolean | null = null;
		let currentTime = 0;
		let frameId = 0;
		let lastTimestamp: number | null = null;
		let onScreen = false;
		let disposed = false;

		const draw = (time: number) => {
			currentTime = time;
			if (!canvas || !render) {
				return;
			}
			render(time);
		};

		const build = () => {
			const mobile = layoutQuery.matches;
			if (mobile === builtMode && canvas && render) {
				return;
			}
			builtMode = mobile;
			svg.replaceChildren();
			canvas = new SvgCanvas(svg);
			const layout = scene.layout(mobile, canvas);
			svg.setAttribute("viewBox", `0 0 ${layout.W} ${layout.H}`);
			stage.style.aspectRatio = `${layout.W} / ${layout.H}`;
			render = scene.build(canvas, layout);
		};

		const renderNow = () => {
			build();
			draw(motionQuery.matches ? scene.finalTime : currentTime);
		};

		const tick = (timestamp: number) => {
			if (lastTimestamp !== null) {
				currentTime += Math.min(0.1, (timestamp - lastTimestamp) / 1000);
			}
			lastTimestamp = timestamp;
			draw(currentTime % scene.duration);
			frameId = requestAnimationFrame(tick);
		};

		const start = () => {
			if (frameId || motionQuery.matches || !onScreen || document.hidden) {
				return;
			}
			lastTimestamp = null;
			frameId = requestAnimationFrame(tick);
		};

		const stop = () => {
			if (frameId) {
				cancelAnimationFrame(frameId);
			}
			frameId = 0;
		};

		const observer = new IntersectionObserver(
			(entries) => {
				onScreen = entries[0]?.isIntersecting ?? false;
				if (onScreen) {
					start();
				} else {
					stop();
				}
			},
			{ threshold: 0.15 },
		);
		observer.observe(stage);

		const onVisibilityChange = () => {
			if (document.hidden) {
				stop();
			} else {
				start();
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);

		const onLayoutChange = () => {
			renderNow();
		};
		layoutQuery.addEventListener("change", onLayoutChange);

		const onMotionChange = () => {
			if (motionQuery.matches) {
				stop();
				renderNow();
			} else {
				start();
			}
		};
		motionQuery.addEventListener("change", onMotionChange);

		// Text wrapping needs real font metrics, so wait for the webfont.
		const fontsReady = document.fonts?.ready ?? Promise.resolve();
		void fontsReady.then(() => {
			if (disposed) {
				return;
			}
			renderNow();
			start();
		});

		return () => {
			disposed = true;
			stop();
			observer.disconnect();
			document.removeEventListener("visibilitychange", onVisibilityChange);
			layoutQuery.removeEventListener("change", onLayoutChange);
			motionQuery.removeEventListener("change", onMotionChange);
		};
	}, [scene, svgRef, stageRef]);
}
