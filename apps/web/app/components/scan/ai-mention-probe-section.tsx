import type { inferRouterOutputs } from "@trpc/server";
import { Badge } from "@opencited/ui";
import type { AppRouter } from "@opencited/trpc";

type Probe = inferRouterOutputs<AppRouter>["scan"]["verifyReport"]["probe"];

interface AiMentionProbeSectionProps {
	probe: Probe;
}

export function AiMentionProbeSection({ probe }: AiMentionProbeSectionProps) {
	if (probe.status === "pending") {
		return (
			<p className="text-sm text-muted-foreground">
				Checking Perplexity… This usually takes a minute or two. Your technical
				report is complete below.
			</p>
		);
	}

	if (probe.status === "unavailable") {
		return (
			<p className="text-sm text-muted-foreground">
				We couldn&apos;t complete the live Perplexity check for this scan. If
				you started a new scan, verify your email again for that scan. Your
				technical report is still complete.
			</p>
		);
	}

	return (
		<ul className="space-y-4">
			{probe.queries.map((row) => (
				<li key={row.query} className="space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<Badge
							variant={row.visibility === "visible" ? "success" : "outline"}
						>
							{row.visibility === "visible" ? "Visible" : "Not visible"}
						</Badge>
						<p className="text-sm font-medium">{row.query}</p>
					</div>
					<p className="text-sm text-muted-foreground">{row.excerpt}</p>
					{row.citationUrls.length > 0 ? (
						<ul className="space-y-1 text-sm">
							{row.citationUrls.map((url) => (
								<li key={url}>
									<a
										href={url}
										className="break-all underline-offset-4 hover:underline"
										target="_blank"
										rel="noreferrer"
									>
										{url}
									</a>
								</li>
							))}
						</ul>
					) : null}
				</li>
			))}
		</ul>
	);
}
