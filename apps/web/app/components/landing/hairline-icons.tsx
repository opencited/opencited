"use client";

import { cn } from "@/lib/utils";
import {
	type CSSProperties,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";

/**
 * Wraps a hairline SVG and runs its `.motion` keyframes once, when the icon
 * enters the viewport. The resting pose (before and after) is the full icon.
 */
function AnimatedIcon({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const [run, setRun] = useState(false);

	useEffect(() => {
		const node = ref.current;
		if (!node) {
			return;
		}
		if (typeof IntersectionObserver === "undefined") {
			setRun(true);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setRun(true);
					observer.disconnect();
				}
			},
			{ threshold: 0.2 },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	return (
		<span
			ref={ref}
			data-run={run}
			aria-hidden="true"
			className={cn("landing-icon inline-grid place-items-center", className)}
		>
			{children}
		</span>
	);
}

const delay = (value: string): CSSProperties =>
	({ "--d": value }) as CSSProperties;

export function QuestionListIcon({ className }: { className?: string }) {
	return (
		<AnimatedIcon className={className}>
			<svg
				width={64}
				height={64}
				viewBox="0 0 56 56"
				fill="none"
				aria-hidden="true"
			>
				<rect
					x="6.5"
					y="9.5"
					width="38"
					height="34"
					rx="7"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<circle cx="14" cy="19" r="1.6" fill="#94a3b8" />
				<path d="M19 19h18" stroke="#94a3b8" strokeWidth="1.25" />
				<circle cx="14" cy="26.5" r="1.6" fill="#94a3b8" />
				<path d="M19 26.5h13" stroke="#94a3b8" strokeWidth="1.25" />
				<circle cx="14" cy="34" r="1.6" fill="#059669" />
				<path
					className="motion motion-type"
					style={delay("4.5s")}
					d="M19 34h15"
					stroke="#059669"
					strokeWidth="1.25"
				/>
				<path
					className="motion motion-caret"
					style={delay("4.5s")}
					d="M36.5 31v6"
					stroke="#059669"
					strokeWidth="1.25"
				/>
				<g className="motion motion-pop" style={delay("4.5s")}>
					<circle
						cx="44"
						cy="42"
						r="8"
						fill="#fff"
						stroke="#059669"
						strokeWidth="1.25"
					/>
					<path d="M44 38.5v7M40.5 42h7" stroke="#059669" strokeWidth="1.25" />
				</g>
			</svg>
		</AnimatedIcon>
	);
}

export function FanOutIcon({ className }: { className?: string }) {
	return (
		<AnimatedIcon className={className}>
			<svg
				width={64}
				height={64}
				viewBox="0 0 56 56"
				fill="none"
				aria-hidden="true"
			>
				<circle cx="9" cy="28" r="5" stroke="#334155" strokeWidth="1.25" />
				<path
					d="M14 28 C24 28 24 12 34 12"
					stroke="#94a3b8"
					strokeWidth="1.25"
				/>
				<path
					d="M14 28 C24 28 24 44 34 44"
					stroke="#94a3b8"
					strokeWidth="1.25"
				/>
				<path
					d="M14 28 H34"
					stroke="#cbd5e1"
					strokeWidth="1.25"
					strokeDasharray="2 3"
				/>
				<circle cx="41" cy="12" r="7" stroke="#334155" strokeWidth="1.25" />
				<path
					d="M41 8.2l3.3 1.9v3.8L41 15.8l-3.3-1.9v-3.8z"
					stroke="#334155"
					strokeWidth="1.1"
				/>
				<circle cx="41" cy="44" r="7" stroke="#334155" strokeWidth="1.25" />
				<path
					d="M41 40v8M37.6 42l6.8 4M44.4 42l-6.8 4"
					stroke="#334155"
					strokeWidth="1.1"
				/>
				<circle
					cx="41"
					cy="28"
					r="6"
					stroke="#cbd5e1"
					strokeWidth="1.25"
					strokeDasharray="2 2.6"
				/>
				<circle
					className="motion motion-travel"
					r="2.2"
					fill="#059669"
					style={
						{
							"--d": "2.4s",
							offsetPath: "path('M14 28 C24 28 24 12 34 12')",
						} as CSSProperties
					}
				/>
				<circle
					className="motion motion-travel"
					r="2.2"
					fill="#059669"
					style={
						{
							"--d": "2.4s",
							animationDelay: "-0.6s",
							offsetPath: "path('M14 28 C24 28 24 44 34 44')",
						} as CSSProperties
					}
				/>
			</svg>
		</AnimatedIcon>
	);
}

export function ReportIcon({ className }: { className?: string }) {
	return (
		<AnimatedIcon className={className}>
			<svg
				width={64}
				height={64}
				viewBox="0 0 56 56"
				fill="none"
				aria-hidden="true"
			>
				<rect
					x="8.5"
					y="6.5"
					width="34"
					height="43"
					rx="6"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<path d="M15 15h14" stroke="#94a3b8" strokeWidth="1.25" />
				<path
					className="motion motion-grow"
					style={delay("4s")}
					d="M15 24h20"
					stroke="#059669"
					strokeWidth="2.4"
				/>
				<path
					className="motion motion-grow"
					style={{ "--d": "4s", animationDelay: "-0.4s" } as CSSProperties}
					d="M15 31h14"
					stroke="#059669"
					strokeWidth="2.4"
				/>
				<path
					className="motion motion-grow"
					style={{ "--d": "4s", animationDelay: "-0.8s" } as CSSProperties}
					d="M15 38h9"
					stroke="#a8a29e"
					strokeWidth="2.4"
				/>
				<circle
					cx="44"
					cy="42"
					r="8"
					fill="#fff"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<path
					d="M39.5 44.5a5 5 0 0 1 9 0"
					stroke="#cbd5e1"
					strokeWidth="1.25"
				/>
				<path
					className="motion motion-sweep motion-view"
					style={
						{
							"--d": "4s",
							transformOrigin: "44px 44.5px",
						} as CSSProperties
					}
					d="M44 44.5l2.6-3.4"
					stroke="#059669"
					strokeWidth="1.25"
				/>
			</svg>
		</AnimatedIcon>
	);
}

export function MentionsIcon({ className }: { className?: string }) {
	return (
		<AnimatedIcon className={className}>
			<svg
				width={30}
				height={30}
				viewBox="0 0 26 26"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="M4.5 5.5h17a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H11l-4.5 3.5V18.5h-2a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<rect
					className="motion motion-highlight"
					style={delay("4.2s")}
					x="6.5"
					y="9.3"
					width="10"
					height="4.4"
					rx="1.3"
					fill="#d1fae5"
				/>
				<path d="M7.5 11.5h8M18.5 11.5h2" stroke="#059669" strokeWidth="1.25" />
				<path d="M7.5 15h8" stroke="#94a3b8" strokeWidth="1.25" />
			</svg>
		</AnimatedIcon>
	);
}

export function CitationsIcon({ className }: { className?: string }) {
	return (
		<AnimatedIcon className={className}>
			<svg
				width={30}
				height={30}
				viewBox="0 0 26 26"
				fill="none"
				aria-hidden="true"
			>
				<rect
					x="2.5"
					y="8"
					width="21"
					height="10"
					rx="5"
					stroke="#059669"
					strokeWidth="1.25"
				/>
				<path d="M8 13h8" stroke="#94a3b8" strokeWidth="1.25" />
				<g className="motion motion-nudge" style={delay("2.6s")}>
					<path
						d="M17.5 15.2l3-3M18 12.2h2.5v2.5"
						stroke="#059669"
						strokeWidth="1.25"
					/>
				</g>
			</svg>
		</AnimatedIcon>
	);
}

export function CompetitorsIcon({ className }: { className?: string }) {
	return (
		<AnimatedIcon className={className}>
			<svg
				width={30}
				height={30}
				viewBox="0 0 26 26"
				fill="none"
				aria-hidden="true"
			>
				<path d="M3 21.5h20" stroke="#cbd5e1" strokeWidth="1.25" />
				<g className="motion motion-swap-left" style={delay("4.4s")}>
					<circle
						cx="8.5"
						cy="12"
						r="4"
						fill="#d1fae5"
						stroke="#059669"
						strokeWidth="1.25"
					/>
				</g>
				<g className="motion motion-swap-right" style={delay("4.4s")}>
					<circle
						cx="17.5"
						cy="12"
						r="4"
						fill="#efedeb"
						stroke="#a8a29e"
						strokeWidth="1.25"
					/>
				</g>
			</svg>
		</AnimatedIcon>
	);
}

export function InsightsIcon({ className }: { className?: string }) {
	return (
		<AnimatedIcon className={className}>
			<svg
				width={30}
				height={30}
				viewBox="0 0 26 26"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="M13 5.5a5.5 5.5 0 0 0-3.2 10v2.5h6.4v-2.5A5.5 5.5 0 0 0 13 5.5z"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<path d="M10.5 21h5" stroke="#334155" strokeWidth="1.25" />
				<g className="motion motion-glint" style={delay("3s")}>
					<path
						d="M13 1.5v1.6M4.5 5l1.2 1.1M21.5 5l-1.2 1.1M2.5 11.5h1.6M22.4 11.5h1.6"
						stroke="#059669"
						strokeWidth="1.25"
					/>
				</g>
				<circle cx="13" cy="11.2" r="1.4" fill="#059669" />
			</svg>
		</AnimatedIcon>
	);
}

export function ScoreIcon({ className }: { className?: string }) {
	return (
		<AnimatedIcon className={className}>
			<svg
				width={30}
				height={30}
				viewBox="0 0 26 26"
				fill="none"
				aria-hidden="true"
			>
				<path d="M4 18a9 9 0 0 1 18 0" stroke="#cbd5e1" strokeWidth="1.25" />
				<path d="M4 18a9 9 0 0 1 14.4-7.2" stroke="#059669" strokeWidth="1.6" />
				<path
					className="motion motion-sweep motion-view"
					style={
						{
							"--d": "4.6s",
							transformOrigin: "13px 18px",
						} as CSSProperties
					}
					d="M13 18l4.4-4.8"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<circle cx="13" cy="18" r="1.5" fill="#334155" />
			</svg>
		</AnimatedIcon>
	);
}

export function OpenSourceIcon({ className }: { className?: string }) {
	return (
		<AnimatedIcon className={className}>
			<svg
				width={72}
				height={72}
				viewBox="0 0 72 72"
				fill="none"
				aria-hidden="true"
			>
				<rect
					x="8.5"
					y="14.5"
					width="55"
					height="43"
					rx="8"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<path d="M8.5 24.5h55" stroke="#cbd5e1" strokeWidth="1.25" />
				<circle cx="15" cy="19.5" r="1.4" fill="#cbd5e1" />
				<circle cx="20" cy="19.5" r="1.4" fill="#cbd5e1" />
				<g
					className="motion motion-spread"
					style={{ "--d": "3.6s", "--dx": "-2.5px" } as CSSProperties}
				>
					<path d="M27 33l-6 7 6 7" stroke="#059669" strokeWidth="1.25" />
				</g>
				<g
					className="motion motion-spread"
					style={{ "--d": "3.6s", "--dx": "2.5px" } as CSSProperties}
				>
					<path d="M45 33l6 7-6 7" stroke="#059669" strokeWidth="1.25" />
				</g>
				<path d="M38.5 31.5l-5 17" stroke="#334155" strokeWidth="1.25" />
			</svg>
		</AnimatedIcon>
	);
}

export function SelfHostIcon({ className }: { className?: string }) {
	return (
		<AnimatedIcon className={className}>
			<svg
				width={72}
				height={72}
				viewBox="0 0 72 72"
				fill="none"
				aria-hidden="true"
			>
				<path d="M10 32L36 11l26 21" stroke="#94a3b8" strokeWidth="1.25" />
				<path d="M15.5 28v32.5h41V28" stroke="#94a3b8" strokeWidth="1.25" />
				<rect
					x="23.5"
					y="33.5"
					width="25"
					height="9"
					rx="3"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<rect
					x="23.5"
					y="45.5"
					width="25"
					height="9"
					rx="3"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<circle
					className="motion motion-led"
					style={delay("1.8s")}
					cx="43"
					cy="38"
					r="1.7"
					fill="#059669"
				/>
				<circle
					className="motion motion-led"
					style={{ "--d": "1.8s", animationDelay: "-0.9s" } as CSSProperties}
					cx="43"
					cy="50"
					r="1.7"
					fill="#059669"
				/>
				<path d="M28 38h8M28 50h8" stroke="#cbd5e1" strokeWidth="1.25" />
			</svg>
		</AnimatedIcon>
	);
}

export function DataStaysYoursIcon({ className }: { className?: string }) {
	return (
		<AnimatedIcon className={className}>
			<svg
				width={72}
				height={72}
				viewBox="0 0 72 72"
				fill="none"
				aria-hidden="true"
			>
				<ellipse
					cx="30"
					cy="22"
					rx="16"
					ry="5.5"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<path
					d="M14 22v26c0 3 7.2 5.5 16 5.5M46 22v10"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<path
					d="M14 35c0 3 7.2 5.5 16 5.5"
					stroke="#94a3b8"
					strokeWidth="1.25"
				/>
				<rect
					x="40.5"
					y="42.5"
					width="20"
					height="16"
					rx="3.5"
					fill="#fff"
					stroke="#059669"
					strokeWidth="1.25"
				/>
				<path
					className="motion motion-shackle"
					style={delay("4s")}
					d="M44.5 42.5v-4a6 6 0 0 1 12 0v4"
					stroke="#059669"
					strokeWidth="1.25"
				/>
				<circle cx="50.5" cy="50" r="1.8" fill="#059669" />
				<path d="M50.5 51.5v2.5" stroke="#059669" strokeWidth="1.25" />
			</svg>
		</AnimatedIcon>
	);
}

export function RealEnginesIcon({ className }: { className?: string }) {
	return (
		<AnimatedIcon className={className}>
			<svg
				width={72}
				height={72}
				viewBox="0 0 72 72"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="M14.5 16.5h43a6 6 0 0 1 6 6v21a6 6 0 0 1-6 6H32l-10 8v-8h-7.5a6 6 0 0 1-6-6v-21a6 6 0 0 1 6-6z"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<path
					d="M17 33h5l3-7 5 14 4-10 3 6 3-3h12"
					stroke="#059669"
					strokeWidth="1.25"
				/>
				<circle cx="56" cy="16.5" r="3.2" fill="#10b981" />
				<circle
					className="motion motion-ping"
					style={delay("2s")}
					cx="56"
					cy="16.5"
					r="3.2"
					stroke="#10b981"
					strokeWidth="1.25"
				/>
			</svg>
		</AnimatedIcon>
	);
}

/** Compact question → engines → report motif under the final CTA. */
export function FinalMotif() {
	return (
		<AnimatedIcon className="mx-auto mt-10 block w-full max-w-[560px]">
			<svg
				viewBox="0 0 560 96"
				fill="none"
				className="w-full"
				aria-hidden="true"
			>
				<rect
					x="0.6"
					y="30.6"
					width="150"
					height="34"
					rx="17"
					fill="#fff"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<circle cx="20" cy="46.5" r="5" stroke="#94a3b8" strokeWidth="1.25" />
				<path d="M23.8 50.3l3.2 3.2" stroke="#94a3b8" strokeWidth="1.25" />
				<path d="M36 47.5h88" stroke="#cbd5e1" strokeWidth="1.25" />
				<path d="M36 47.5h52" stroke="#334155" strokeWidth="1.25" />
				<path
					d="M151 47.6 C190 47.6 190 18.6 228 18.6M151 47.6 C190 47.6 190 76.6 228 76.6"
					stroke="#cbd5e1"
					strokeWidth="1.25"
				/>
				<path
					className="motion motion-flow"
					style={delay("1.6s")}
					d="M151 47.6 C190 47.6 190 18.6 228 18.6M151 47.6 C190 47.6 190 76.6 228 76.6"
					stroke="#059669"
					strokeWidth="1.25"
					strokeDasharray="4 8"
				/>
				<rect
					x="228.6"
					y="4.6"
					width="104"
					height="28"
					rx="14"
					fill="#fff"
					stroke="#059669"
					strokeWidth="1.25"
				/>
				<path
					d="M246 12.6l4.3 2.5v5l-4.3 2.5-4.3-2.5v-5z"
					stroke="#334155"
					strokeWidth="1.1"
				/>
				{/* Hidden below md: the 560-unit diagram scales down and this
				    would render under 12px. */}
				<text
					x="258"
					y="23"
					fontSize="13"
					fontWeight="550"
					fill="#0f172a"
					className="hidden md:block"
				>
					ChatGPT
				</text>
				<rect
					x="228.6"
					y="62.6"
					width="104"
					height="28"
					rx="14"
					fill="#fff"
					stroke="#059669"
					strokeWidth="1.25"
				/>
				<path
					d="M246 70.6v12M241 73.6l10 6M251 73.6l-10 6"
					stroke="#334155"
					strokeWidth="1.1"
				/>
				<text
					x="258"
					y="81"
					fontSize="13"
					fontWeight="550"
					fill="#0f172a"
					className="hidden md:block"
				>
					Perplexity
				</text>
				<path
					d="M333 18.6 C372 18.6 372 47.6 410 47.6M333 76.6 C372 76.6 372 47.6 410 47.6"
					stroke="#cbd5e1"
					strokeWidth="1.25"
				/>
				<path
					className="motion motion-flow"
					style={delay("1.6s")}
					d="M333 18.6 C372 18.6 372 47.6 410 47.6M333 76.6 C372 76.6 372 47.6 410 47.6"
					stroke="#059669"
					strokeWidth="1.25"
					strokeDasharray="4 8"
				/>
				<rect
					x="410.6"
					y="14.6"
					width="148"
					height="66"
					rx="14"
					fill="#fff"
					stroke="#334155"
					strokeWidth="1.25"
				/>
				<path
					d="M426 60a15 15 0 0 1 30 0"
					stroke="#cbd5e1"
					strokeWidth="1.25"
				/>
				<path
					d="M426 60a15 15 0 0 1 25.6-10.6"
					stroke="#059669"
					strokeWidth="1.6"
				/>
				<rect
					x="468"
					y="30"
					width="22"
					height="9"
					rx="2.5"
					fill="#d1fae5"
					stroke="#059669"
					strokeWidth="1"
				/>
				<path d="M496 34.5h48" stroke="#cbd5e1" strokeWidth="1.25" />
				<rect
					x="468"
					y="44"
					width="22"
					height="9"
					rx="4.5"
					stroke="#059669"
					strokeWidth="1.25"
				/>
				<path d="M496 48.5h36" stroke="#cbd5e1" strokeWidth="1.25" />
				<rect
					x="468"
					y="58"
					width="22"
					height="9"
					rx="2.5"
					fill="#efedeb"
					stroke="#a8a29e"
					strokeWidth="1"
				/>
				<path d="M496 62.5h42" stroke="#cbd5e1" strokeWidth="1.25" />
				<circle
					className="motion motion-ping"
					style={delay("2.4s")}
					cx="451.6"
					cy="49.4"
					r="2.6"
					stroke="#059669"
					strokeWidth="1.25"
				/>
				<circle cx="451.6" cy="49.4" r="2.6" fill="#059669" />
			</svg>
		</AnimatedIcon>
	);
}
