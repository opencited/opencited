import { cn } from "@/lib/utils";
import Link from "next/link";

type BrandNameProps = {
	className?: string;
	/**
	 * `app` keeps the monochrome workbench wordmark.
	 * `marketing` adds the line-art mark and the emerald brand accent
	 * (DESIGN.md §6).
	 */
	variant?: "app" | "marketing";
};

export function BrandNameLink({ className, variant = "app" }: BrandNameProps) {
	const marketing = variant === "marketing";

	return (
		<Link
			href="/"
			aria-label={marketing ? "OpenCited home" : undefined}
			className={cn(
				"inline-flex items-center gap-2.5 rounded-sm",
				marketing &&
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-accent focus-visible:ring-offset-4 focus-visible:ring-offset-marketing-paper",
				className,
			)}
		>
			{marketing ? (
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
					className="shrink-0"
				>
					<rect
						x="2.6"
						y="4.6"
						width="18.8"
						height="14.8"
						rx="4"
						stroke="#0f172a"
						strokeWidth="1.25"
					/>
					<path
						d="M7 10h6.5M7 13.5h4"
						stroke="#0f172a"
						strokeWidth="1.25"
						strokeLinecap="round"
					/>
					<circle cx="16.5" cy="13.5" r="1.9" fill="#059669" />
				</svg>
			) : null}
			<span
				className={cn(
					marketing && "text-lg font-semibold leading-none tracking-[-0.02em]",
				)}
			>
				<span
					className={marketing ? "text-marketing-ink" : "text-muted-foreground"}
				>
					Open
				</span>
				<span
					className={
						marketing ? "text-marketing-accent-strong" : "text-primary"
					}
				>
					Cited
				</span>
			</span>
		</Link>
	);
}
