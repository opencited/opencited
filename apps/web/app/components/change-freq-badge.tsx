"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@opencited/ui";
import { RefreshCw } from "lucide-react";

interface ChangeFreqBadgeProps {
	value: string;
}

export function ChangeFreqBadge({ value }: ChangeFreqBadgeProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
					<RefreshCw className="h-3 w-3" />
					<span>Update freq: {value}</span>
				</span>
			</TooltipTrigger>
			<TooltipContent>
				<p className="font-medium">Update frequency</p>
				<p className="text-muted-foreground">
					How often this page is expected to change
				</p>
			</TooltipContent>
		</Tooltip>
	);
}
