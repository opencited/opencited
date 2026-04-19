"use client";

import { formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@opencited/ui";

interface TimeAgoProps {
	date: Date | string | null;
	label?: string;
}

export function TimeAgo({ date, label }: TimeAgoProps) {
	if (!date) {
		return <span className="text-muted-foreground">Unknown</span>;
	}

	const dateObj = typeof date === "string" ? new Date(date) : date;
	const isoString = dateObj.toISOString();
	const relativeTime = formatDistanceToNow(dateObj, { addSuffix: true });

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="cursor-default text-xs text-muted-foreground">
					{label && <span>{label}</span>}
					{label && <span className="mx-1">·</span>}
					<span>{relativeTime}</span>
				</span>
			</TooltipTrigger>
			<TooltipContent>
				{label && <p className="font-medium">{label}</p>}
				<p className={label ? "text-muted-foreground" : undefined}>
					{isoString}
				</p>
			</TooltipContent>
		</Tooltip>
	);
}
