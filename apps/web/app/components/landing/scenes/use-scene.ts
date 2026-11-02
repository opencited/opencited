"use client";

import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { SvgCanvas } from "./engine";

export const SCENE_COMPACT_QUERY = "(max-width: 1279.98px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export type SceneLayout = { W: number; H: number };

export type SceneDefinition<L extends SceneLayout> = {
	/** Stable id, used for debugging and as a React key. */
	id: string;
	/** Scene timeline length in seconds; playback holds at `finalTime`. */
	duration: number;
	/** The frame the scene holds once it has played. */
	finalTime: number;
	layout: (mobile: boolean, canvas: SvgCanvas) => L;
	build: (canvas: SvgCanvas, layout: L) => (time: number) => void;
};

export type SceneControls = {
	/** True once the scene has reached its final frame. */
	finished: boolean;
	/** True when the visitor paused the scene while it was playing. */
	paused: boolean;
	/** True when the visitor asked for reduced motion; no replay control. */
	reducedMotion: boolean;
	/** Reset to the start frame and play once again. No-op with reduced motion. */
	replay: () => void;
	/** Pause or resume the current play. No-op after the scene has finished. */
	togglePaused: () => void;
};

type Phase = "idle" | "playing" | "done";

/**
 * Drives one scene.
 *
 * - Plays once when the stage first scrolls into view, then holds `finalTime`.
 * - Pauses off-screen or in a hidden tab only while playing; it resumes and
 *   finishes rather than restarting.
 * - `replay()` resets to the start frame and starts a fresh single play.
 * - With reduced motion, draws the final frame once and never starts the clock.
 * - Starts at time 0, so the pre-JS empty stage is the animation's start state.
 *
 * The compact (stacked) composition is used below the `xl` breakpoint: the wide
 * composition is drawn for a 1080px stage, and letting it shrink to a tablet
 * container would render its 8.5px labels under 10px. The compact composition
 * is capped at 440px from `sm` up, so tablet widths keep every label at or
 * above 10px.
 */
export function useScene<L extends SceneLayout>(
	scene: SceneDefinition<L>,
	svgRef: RefObject<SVGSVGElement | null>,
	stageRef: RefObject<HTMLDivElement | null>,
): SceneControls {
	const [finished, setFinished] = useState(false);
	const [paused, setPaused] = useState(false);
	const [reducedMotion, setReducedMotion] = useState(false);
	const replayRef = useRef<() => void>(() => {});
	const togglePauseRef = useRef<() => void>(() => {});

	useEffect(() => {
		const svg = svgRef.current;
		const stage = stageRef.current;
		if (!svg || !stage) {
			return;
		}

		const layoutQuery = window.matchMedia(SCENE_COMPACT_QUERY);
		const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
		setReducedMotion(motionQuery.matches);

		let canvas: SvgCanvas | null = null;
		let render: ((time: number) => void) | null = null;
		let builtMode: boolean | null = null;
		let phase: Phase = "idle";
		let currentTime = 0;
		let frameId = 0;
		let lastTimestamp: number | null = null;
		let onScreen = false;
		let userPaused = false;
		let disposed = false;

		const drawAt = (time: number) => {
			currentTime = Math.min(time, scene.finalTime);
			if (!canvas || !render) {
				return;
			}
			render(currentTime);
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

		const stop = () => {
			if (frameId) {
				cancelAnimationFrame(frameId);
			}
			frameId = 0;
		};

		const finish = () => {
			phase = "done";
			userPaused = false;
			stop();
			drawAt(scene.finalTime);
			if (!disposed) {
				setPaused(false);
				setFinished(true);
			}
		};

		const tick = (timestamp: number) => {
			if (lastTimestamp !== null) {
				currentTime += Math.min(0.1, (timestamp - lastTimestamp) / 1000);
			}
			lastTimestamp = timestamp;
			if (currentTime >= scene.finalTime) {
				finish();
				return;
			}
			drawAt(currentTime);
			frameId = requestAnimationFrame(tick);
		};

		const start = () => {
			if (
				frameId ||
				motionQuery.matches ||
				userPaused ||
				!onScreen ||
				document.hidden ||
				phase !== "playing"
			) {
				return;
			}
			lastTimestamp = null;
			frameId = requestAnimationFrame(tick);
		};

		const renderNow = () => {
			build();
			drawAt(motionQuery.matches ? scene.finalTime : currentTime);
		};

		const replay = () => {
			if (disposed || motionQuery.matches) {
				return;
			}
			stop();
			lastTimestamp = null;
			phase = "playing";
			userPaused = false;
			setPaused(false);
			setFinished(false);
			drawAt(0);
			start();
		};
		replayRef.current = replay;

		const togglePaused = () => {
			if (disposed || motionQuery.matches || phase !== "playing") {
				return;
			}
			userPaused = !userPaused;
			if (userPaused) {
				stop();
				setPaused(true);
				return;
			}
			setPaused(false);
			start();
		};
		togglePauseRef.current = togglePaused;

		const observer = new IntersectionObserver(
			(entries) => {
				onScreen = entries[0]?.isIntersecting ?? false;
				if (onScreen && phase === "playing") {
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
			} else if (phase === "playing") {
				start();
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);

		const onLayoutChange = () => {
			build();
			drawAt(motionQuery.matches ? scene.finalTime : currentTime);
		};
		layoutQuery.addEventListener("change", onLayoutChange);

		const onMotionChange = () => {
			setReducedMotion(motionQuery.matches);
			if (motionQuery.matches) {
				stop();
				phase = "done";
				userPaused = false;
				setPaused(false);
				drawAt(scene.finalTime);
				if (!disposed) {
					setFinished(false);
				}
				return;
			}
			if (phase === "playing") {
				start();
			} else if (phase === "done") {
				drawAt(scene.finalTime);
				if (!disposed) {
					setFinished(true);
				}
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
			if (motionQuery.matches) {
				phase = "done";
				return;
			}
			phase = "playing";
			start();
		});

		return () => {
			disposed = true;
			stop();
			observer.disconnect();
			document.removeEventListener("visibilitychange", onVisibilityChange);
			layoutQuery.removeEventListener("change", onLayoutChange);
			motionQuery.removeEventListener("change", onMotionChange);
			replayRef.current = () => {};
			togglePauseRef.current = () => {};
		};
	}, [scene, svgRef, stageRef]);

	const replay = useCallback(() => {
		replayRef.current();
	}, []);

	const togglePaused = useCallback(() => {
		togglePauseRef.current();
	}, []);

	return { finished, paused, reducedMotion, replay, togglePaused };
}
