"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import type { AppRouter } from "@opencited/trpc";
import { Badge, Card, CardContent } from "@opencited/ui";
import {
	READINESS_LABELS,
	READINESS_STROKE_CLASSES,
	formatScanDuration,
} from "@/app/lib/scan-display";
import { ScoreGauge } from "./score-gauge";
import { ScanReportGate } from "./scan-report-gate";

type ScanResultData = inferRouterOutputs<AppRouter>["scan"]["run"];
type FullReportData = inferRouterOutputs<AppRouter>["scan"]["verifyReport"];

interface ScanResultProps {
	result: ScanResultData;
}

export function ScanResult({ result }: ScanResultProps) {
	const [fullReport, setFullReport] = useState<FullReportData | null>(null);
	const issues = fullReport?.issues ?? result.issues;
	const issueCount = fullReport?.issueCount ?? result.issueCount;
	const hiddenCount = issueCount - result.issues.length;
	const isUnlocked = fullReport !== null;

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
							<h3 className="text-sm font-semibold">
								{isUnlocked ? "All issues" : "Top issues"}
							</h3>
							<p className="text-xs text-muted-foreground">
								{issueCount === 0 ? "All checks passed" : `${issueCount} found`}
							</p>
						</div>
						{issues.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No issues found — robots.txt, sitemap, HTTPS, structured data,
								and AI crawler access all check out.
							</p>
						) : (
							<ul className="space-y-4">
								{issues.map((issue) => (
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
						{!isUnlocked && hiddenCount > 0 && (
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
						Get the full technical report
					</h3>
					<p className="mx-auto max-w-[52ch] text-sm text-muted-foreground">
						{!isUnlocked && hiddenCount > 0 && (
							<>
								You&apos;re seeing {result.issues.length} of {issueCount}{" "}
								issues.{" "}
							</>
						)}
						Verify your email to unlock every issue with step-by-step fixes and
						get a copy by email.
					</p>
					<ScanReportGate
						scanId={result.scanId}
						domain={result.domain}
						issueCount={issueCount}
						freeIssueCount={result.issues.length}
						onUnlocked={setFullReport}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
