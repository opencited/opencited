"use client";

import {
	Badge,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@opencited/ui";
import { useId } from "react";
import { useAnswerEngines } from "@/app/hooks/use-answer-engines";

export function AnswerEngineLabel({
	provider,
}: {
	provider: string | null | undefined;
}) {
	const reasonId = useId();
	const { engines } = useAnswerEngines();

	if (!provider) {
		return <span>N/A</span>;
	}

	const engine = engines?.find((candidate) => candidate.key === provider);
	const displayName = engine?.displayName ?? provider;

	if (!engine || engine.enabled) {
		return <Badge variant="outline">{displayName}</Badge>;
	}

	return (
		<span className="inline-flex items-center gap-1.5">
			<Badge variant="outline">{displayName}</Badge>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							aria-describedby={reasonId}
							className="inline-flex"
						>
							<Badge variant="secondary">Paused</Badge>
						</button>
					</TooltipTrigger>
					<TooltipContent>
						<p className="max-w-xs text-xs">{engine.disabledReason}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<span id={reasonId} className="sr-only">
				{engine.disabledReason}
			</span>
		</span>
	);
}

export const RUNS_PAUSED_MESSAGE =
	"Runs are paused right now while we fix our answer engines. Your existing results are still here.";

export function RunsPausedMessage() {
	return <p className="text-sm text-muted-foreground">{RUNS_PAUSED_MESSAGE}</p>;
}
