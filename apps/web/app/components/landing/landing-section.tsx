import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function LandingContainer({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<div
			className={cn(
				"relative mx-auto w-full max-w-[1160px] px-4 md:px-10",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function LandingSection({
	id,
	className,
	children,
}: {
	id?: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<section
			id={id}
			className={cn(
				"relative scroll-mt-20 border-t border-marketing-rule py-14 md:py-28",
				className,
			)}
		>
			{children}
		</section>
	);
}

export function Eyebrow({ children }: { children: ReactNode }) {
	return (
		<span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase leading-none tracking-[0.1em] text-marketing-accent-strong">
			<span
				aria-hidden="true"
				className="size-1.5 rounded-full bg-marketing-accent ring-[3px] ring-marketing-accent-highlight"
			/>
			{children}
		</span>
	);
}

export function SectionHeading({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<h2
			className={cn(
				"mt-4 max-w-[760px] text-balance text-[clamp(28px,3.4vw,40px)] font-bold leading-[1.1] tracking-[-0.03em] text-marketing-ink",
				className,
			)}
		>
			{children}
		</h2>
	);
}

export function SectionLead({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<p
			className={cn(
				"mt-3.5 max-w-[620px] text-[17px] leading-relaxed text-marketing-muted",
				className,
			)}
		>
			{children}
		</p>
	);
}
