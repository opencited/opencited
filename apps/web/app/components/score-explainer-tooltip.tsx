"use client";

import {
	Button,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	TooltipProvider,
} from "@opencited/ui";
import { Info } from "lucide-react";

const SCORE_EXPLAINER_COPY =
	"Your AI Visibility Score measures how well your brand appears in AI-generated answers across engines like Perplexity and ChatGPT. It's a weighted composite of mention frequency, position, citations, sentiment, and share of voice, normalised against your tracked competitors.";

const FORMULA_DOCS_URL =
	"https://github.com/opencited/opencited/blob/main/docs/agents/visibility-score.md";

interface ScoreExplainerTooltipProps {
	side?: "top" | "right" | "bottom" | "left";
	iconSize?: "sm" | "md";
}

export function ScoreExplainerTooltip({
	side = "right",
	iconSize = "sm",
}: ScoreExplainerTooltipProps) {
	const iconClass = iconSize === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

	return (
		<TooltipProvider delayDuration={0}>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label="What does this score mean?"
						className="h-auto w-auto p-1 text-muted-foreground hover:text-foreground"
					>
						<Info className={iconClass} />
					</Button>
				</TooltipTrigger>
				<TooltipContent side={side} className="max-w-xs">
					<p className="text-xs leading-relaxed mb-2">{SCORE_EXPLAINER_COPY}</p>
					<a
						href={FORMULA_DOCS_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs text-primary-foreground/80 hover:text-primary-foreground underline underline-offset-2"
						onClick={(e) => e.stopPropagation()}
					>
						View formula details
					</a>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
