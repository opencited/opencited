"use client";

import { useState } from "react";
import {
	Button,
	Markdown,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@opencited/ui";
import { Info } from "lucide-react";

const SCORE_EXPLAINER_COPY =
	"Your AI Visibility Score measures how well your brand appears in AI-generated answers across engines like Perplexity and ChatGPT. It's a weighted composite of mention frequency, position, citations, sentiment, and share of voice, normalised against your tracked competitors.";

const FORMULA_BLOCK = `\`\`\`
visibilityScore = 0.35 × mentionScore
                + 0.25 × positionScore
                + 0.20 × citationScore
                + 0.10 × sentimentScore
                + 0.10 × coMentionScore
\`\`\``;

const GENERIC_WORKED_EXAMPLE = `**Worked example** (MyBrand vs. 2 competitors on Perplexity, 3 crawls):

| Crawl | Mention | Position | Citation | Sentiment | Co-mention | Composite |
|-------|---------|----------|----------|-----------|------------|-----------|
| 1 | 100 | 100 (rank 1) | 0 | 100 (positive) | 25 | 73 |
| 2 | 100 | 50 (rank 3) | 100 | 50 (neutral) | 25 | 75 |
| 3 | 100 | 100 (rank 1) | 0 | 50 (neutral) | 50 | 70 |

After peer-relative normalisation: **71**

*Peer-relative — score depends on your tracked competitors.*`;

const README_SECTION_URL =
	"https://github.com/opencited/opencited#ai-visibility-score";

interface ScoreSubScores {
	mention: number;
	position: number;
	citation: number;
	sentiment: number;
	coMention: number;
}

interface ScoreExplainerTooltipProps {
	iconSize?: "sm" | "md";
	subScores?: ScoreSubScores;
	composite?: number;
	sampleSize?: number;
	formulaVersion?: string;
	label?: string;
}

function buildYourScoreMarkdown(
	subScores: ScoreSubScores,
	composite: number,
	sampleSize: number,
	formulaVersion: string,
	label?: string,
) {
	const heading = label ? `**Your ${label}**` : "**Your score**";
	return `${heading}

| Sub-score | Weight | Your value |
|-----------|--------|------------|
| Mention | 0.35 | ${subScores.mention} |
| Position | 0.25 | ${subScores.position} |
| Citation | 0.20 | ${subScores.citation} |
| Sentiment | 0.10 | ${subScores.sentiment} |
| Co-mention | 0.10 | ${subScores.coMention} |

\`\`\`
composite = 0.35×${subScores.mention} + 0.25×${subScores.position} + 0.20×${subScores.citation} + 0.10×${subScores.sentiment} + 0.10×${subScores.coMention}
         → ${composite}
\`\`\`

*Mean of ${sampleSize} crawl${sampleSize !== 1 ? "s" : ""} · ${formulaVersion}*
*Peer-relative — score depends on your tracked competitors.*`;
}

export function ScoreExplainerTooltip({
	iconSize = "sm",
	subScores,
	composite,
	sampleSize,
	formulaVersion,
	label,
}: ScoreExplainerTooltipProps) {
	const [open, setOpen] = useState(false);
	const iconClass = iconSize === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

	const hasActualData = subScores !== undefined && composite !== undefined;

	const detailMarkdown = hasActualData
		? `${FORMULA_BLOCK}\n\n${buildYourScoreMarkdown(
				subScores,
				composite,
				sampleSize ?? 1,
				formulaVersion ?? "v1.0.0",
				label,
			)}`
		: `${FORMULA_BLOCK}\n\n${GENERIC_WORKED_EXAMPLE}`;

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label="What does this score mean?"
					className="h-auto w-auto p-1 text-muted-foreground hover:text-foreground"
					onClick={(e) => e.stopPropagation()}
				>
					<Info className={iconClass} />
				</Button>
			</SheetTrigger>
			<SheetContent side="right" className="w-full sm:max-w-md">
				<SheetHeader>
					<SheetTitle>AI Visibility Score</SheetTitle>
					<SheetDescription>{SCORE_EXPLAINER_COPY}</SheetDescription>
				</SheetHeader>
				<div className="mt-6 space-y-6">
					<Markdown>{detailMarkdown}</Markdown>
					<div className="pt-4 border-t border-border">
						<a
							href={README_SECTION_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs underline underline-offset-2 hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:rounded-sm"
						>
							Read the full spec →
						</a>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
