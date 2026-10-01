import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";
import { Badge, Card, CardContent } from "@opencited/ui";
import {
	READINESS_LABELS,
	READINESS_STROKE_CLASSES,
	formatScanDuration,
} from "@/app/lib/scan-display";
import { WaitlistForm } from "../waitlist/waitlist-form";
import { ScoreGauge } from "./score-gauge";

type ScanResultData = inferRouterOutputs<AppRouter>["scan"]["run"];

interface ScanResultProps {
	result: ScanResultData;
}

export function ScanResult({ result }: ScanResultProps) {
	const hiddenCount = result.issueCount - result.issues.length;

	return (
		<div className="space-y-4 animate-fade-in">
			<Card>
				<CardContent className="space-y-6">
					<div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
						<ScoreGauge
							value={result.score}
							strokeClassName={READINESS_STROKE_CLASSES[result.readiness]}
							label={`Score ${result.score} out of 100, ${READINESS_LABELS[result.readiness]}`}
						/>
						<div className="space-y-1 text-center sm:text-left">
							<p className="font-mono text-sm break-words text-muted-foreground">
								{result.domain}
							</p>
							<p className="text-xl font-semibold">
								{READINESS_LABELS[result.readiness]}
							</p>
							<p className="text-sm text-muted-foreground">
								Technical readiness · checked in{" "}
								{formatScanDuration(result.durationMs)}
							</p>
						</div>
					</div>

					<div className="space-y-3">
						<div className="flex items-baseline justify-between gap-2">
							<h3 className="text-sm font-semibold">Top issues</h3>
							<p className="text-xs text-muted-foreground">
								{result.issueCount === 0
									? "All checks passed"
									: `${result.issueCount} found`}
							</p>
						</div>
						{result.issues.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No issues found — robots.txt, sitemap, HTTPS, structured data,
								and AI crawler access all check out.
							</p>
						) : (
							<ul className="space-y-4">
								{result.issues.map((issue) => (
									<li
										key={`${issue.check}-${issue.issue}`}
										className="space-y-1.5"
									>
										<Badge variant="outline" className="font-mono text-xs">
											{issue.check}
										</Badge>
										<p className="text-sm font-medium">{issue.issue}</p>
										<p className="text-sm text-muted-foreground">
											{issue.howToFix}
										</p>
									</li>
								))}
							</ul>
						)}
						{hiddenCount > 0 && (
							<p className="text-xs text-muted-foreground">
								+{hiddenCount} more {hiddenCount === 1 ? "issue" : "issues"} in
								the full report.
							</p>
						)}
					</div>
				</CardContent>
			</Card>

			<Card variant="dashed">
				<CardContent className="space-y-3 text-center">
					<h3 className="text-base font-semibold">
						Get the full report + AI visibility check
					</h3>
					<p className="mx-auto max-w-[52ch] text-sm text-muted-foreground">
						{hiddenCount > 0 && (
							<>
								You&apos;re seeing {result.issues.length} of {result.issueCount}{" "}
								issues.{" "}
							</>
						)}
						Enter your email to get the full report with step-by-step fixes,
						plus an AI visibility check of what AI engines say about your brand.
						This joins the OpenCited waitlist — we&apos;ll email you when we
						launch.
					</p>
					<WaitlistForm />
				</CardContent>
			</Card>
		</div>
	);
}
