import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const priorityDotVariants = cva("shrink-0", {
	variants: {
		variant: {
			high: "bg-red-500",
			medium: "bg-amber-500",
			low: "bg-green-500",
			none: "bg-muted-foreground",
		},
	},
	defaultVariants: {
		variant: "none",
	},
});

export interface PriorityBadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof priorityDotVariants> {
	priority: string | null;
}

function PriorityBadge({ priority, className, ...props }: PriorityBadgeProps) {
	const priorityValue = priority ? parseFloat(priority) : 0;

	let dotVariant: VariantProps<typeof priorityDotVariants>["variant"];
	if (priorityValue >= 0.7) {
		dotVariant = "high";
	} else if (priorityValue >= 0.4) {
		dotVariant = "medium";
	} else if (priorityValue > 0) {
		dotVariant = "low";
	} else {
		dotVariant = "none";
	}

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
					<span
						className={cn(
							"h-2 w-2 rounded-full",
							priorityDotVariants({ variant: dotVariant }),
						)}
					/>
					<span>{priority ?? "none"}</span>
				</div>
			</TooltipTrigger>
			<TooltipContent>
				<p className="font-medium">Sitemap priority</p>
				<p className="text-muted-foreground">
					Range 0.0–1.0. Higher values are more important.
				</p>
			</TooltipContent>
		</Tooltip>
	);
}

export { PriorityBadge, priorityDotVariants };
