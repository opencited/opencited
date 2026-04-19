import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@opencited/ui";

type SitemapStatus = "pending" | "indexed" | "error";

const statusConfig: Record<
	SitemapStatus,
	{ dot: string; label: string; description: string }
> = {
	pending: {
		dot: "bg-muted-foreground",
		label: "Pending",
		description: "Sitemap added but not yet crawled",
	},
	indexed: {
		dot: "bg-green-500",
		label: "Indexed",
		description: "All URLs successfully crawled and indexed",
	},
	error: {
		dot: "bg-red-500",
		label: "Error",
		description: "Crawl failed or returned no URLs",
	},
};

interface SitemapStatusBadgeProps extends HTMLAttributes<HTMLDivElement> {
	status: string | null | undefined;
}

const VALID_STATUSES = new Set<SitemapStatus>(["pending", "indexed", "error"]);

export function SitemapStatusBadge({
	status,
	className,
	...props
}: SitemapStatusBadgeProps) {
	if (!status || !VALID_STATUSES.has(status as SitemapStatus)) {
		return null;
	}

	const normalizedStatus = status as SitemapStatus;
	const config = statusConfig[normalizedStatus];

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div
					className={cn(
						"inline-flex items-center gap-1.5 text-xs text-muted-foreground",
						className,
					)}
					{...props}
				>
					<span className={cn("h-2 w-2 rounded-full", config.dot)} />
					<span>{config.label}</span>
				</div>
			</TooltipTrigger>
			<TooltipContent>
				<p className="font-medium">{config.label}</p>
				<p className="text-muted-foreground">{config.description}</p>
			</TooltipContent>
		</Tooltip>
	);
}
