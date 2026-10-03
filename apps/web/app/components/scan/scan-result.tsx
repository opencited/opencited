"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { AppRouter } from "@opencited/trpc";
import { Badge } from "@opencited/ui";
import { useTRPC } from "@/app/_trpc/client";
import {
	READINESS_BADGE_VARIANTS,
	READINESS_LABELS,
	formatScanDuration,
} from "@/app/lib/scan-display";
import { AiMentionProbeSection } from "./ai-mention-probe-section";
import type { useScanReportGate } from "./use-scan-report-gate";

type ScanResultData = inferRouterOutputs<AppRouter>["scan"]["run"];
type FullReportData = inferRouterOutputs<AppRouter>["scan"]["verifyReport"];
type Gate = ReturnType<typeof useScanReportGate>;
type Probe = FullReportData["probe"];

export type UnlockState = {
	scanId: string;
	report: FullReportData;
	email: string;
};

interface ScanResultProps {
	result: ScanResultData;
	unlock: UnlockState | null;
	gate: Gate;
}

function isProbeSettled(probe: Probe | undefined): boolean {
	return probe?.status === "ok" || probe?.status === "unavailable";
}

function useScrollToVisibilityWhenReady(
	probe: Probe | undefined,
	enabled: boolean,
) {
	const sectionRef = useRef<HTMLElement>(null);
	const lastScrolledStatus = useRef<string | null>(null);

	useEffect(() => {
		if (!enabled || !probe || !isProbeSettled(probe)) {
			return;
		}
		const statusKey = `${probe.status}`;
		if (lastScrolledStatus.current === statusKey) {
			return;
		}
		lastScrolledStatus.current = statusKey;

		const node = sectionRef.current;
		if (!node) {
			return;
		}

		const rect = node.getBoundingClientRect();
		const visibleHeight =
			Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
		const inView = visibleHeight > Math.min(rect.height * 0.25, 120);
		if (inView) {
			return;
		}

		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		node.scrollIntoView({
			behavior: reducedMotion ? "auto" : "smooth",
			block: "start",
		});
	}, [enabled, probe]);

	return sectionRef;
}

function TechnicalScoreSummary({
	score,
	readiness,
	durationMs,
}: {
	score: number;
	readiness: ScanResultData["readiness"];
	durationMs: number;
}) {
	return (
		<div className="space-y-1">
			<div className="flex flex-wrap items-center gap-2 text-sm">
				<span className="font-mono font-medium tabular-nums">{score}/100</span>
				<Badge variant={READINESS_BADGE_VARIANTS[readiness]}>
					{READINESS_LABELS[readiness]}
				</Badge>
				<span className="text-muted-foreground">
					Finished in {formatScanDuration(durationMs)}
				</span>
			</div>
			<p className="text-xs text-muted-foreground">
				Crawl checklist only. This score does not measure citations in AI
				answers.
			</p>
		</div>
	);
}

function IssueFixText({ text }: { text: string }) {
	return (
		<p className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
			{text}
		</p>
	);
}

export function ScanResult({ result, unlock, gate }: ScanResultProps) {
	const trpc = useTRPC();
	const unlockedForThisScan = unlock?.scanId === result.scanId;

	const mentionProbeQuery = useQuery({
		...trpc.scan.mentionProbe.queryOptions({
			scanId: result.scanId,
			email: unlock?.email ?? "",
		}),
		enabled: unlockedForThisScan && Boolean(unlock?.email),
		refetchInterval: (query) => {
			const status =
				query.state.data?.probe.status ?? unlock?.report.probe.status;
			return status === "pending" ? 3000 : false;
		},
		refetchOnWindowFocus: (query) =>
			(query.state.data?.probe.status ?? unlock?.report.probe.status) ===
			"pending",
	});

	const probe =
		(unlockedForThisScan ? mentionProbeQuery.data?.probe : undefined) ??
		(unlockedForThisScan ? unlock?.report.probe : undefined);

	const issues = unlockedForThisScan ? unlock?.report.issues : result.issues;
	const issueCount = unlockedForThisScan
		? unlock?.report.issueCount
		: result.issueCount;
	const hiddenCount = issueCount - result.issues.length;
	const isUnlocked = unlockedForThisScan || gate.step === "unlocked";
	const showVisibility = isUnlocked && Boolean(probe);

	const visibilityRef = useScrollToVisibilityWhenReady(probe, showVisibility);

	return (
		<div className="animate-fade-in space-y-8 border-t border-border/60 pt-6">
			{showVisibility && probe ? (
				<section
					ref={visibilityRef}
					id="ai-answer-visibility"
					className="scroll-mt-28 space-y-3"
					aria-labelledby="ai-answer-visibility-heading"
				>
					<div className="flex items-baseline justify-between gap-2">
						<h3
							id="ai-answer-visibility-heading"
							className="text-sm font-semibold"
						>
							Answer engine visibility
						</h3>
						<p className="text-xs text-muted-foreground">
							3 live Perplexity queries
						</p>
					</div>
					<AiMentionProbeSection probe={probe} />
				</section>
			) : null}

			<div
				className={`space-y-3 border-b border-border/60 pb-6 ${
					showVisibility && probe ? "border-t border-border/60 pt-6" : ""
				}`}
			>
				<h3 className="text-sm font-semibold">Technical checklist</h3>
				<TechnicalScoreSummary
					score={result.score}
					readiness={result.readiness}
					durationMs={result.durationMs}
				/>
			</div>

			<div className="space-y-3">
				<div className="flex items-baseline justify-between gap-2">
					<h3 className="text-sm font-semibold">
						{isUnlocked ? "All issues" : "Top issues"}
					</h3>
					{issueCount === 0 ? (
						<Badge variant="success">All checks passed</Badge>
					) : (
						<Badge variant="warning">
							{issueCount} {issueCount === 1 ? "issue" : "issues"}
						</Badge>
					)}
				</div>
				{issues.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No issues found. Robots.txt, sitemap, HTTPS, structured data, and AI
						crawler access look good.
					</p>
				) : (
					<ul className="space-y-4">
						{issues.map((issue) => (
							<li key={`${issue.check}-${issue.issue}`} className="space-y-1.5">
								<Badge variant="secondary" className="font-mono text-xs">
									{issue.check}
								</Badge>
								<p className="text-sm font-medium">{issue.issue}</p>
								<IssueFixText text={issue.howToFix} />
							</li>
						))}
					</ul>
				)}
				{!isUnlocked ? (
					<p className="text-xs text-muted-foreground">
						{hiddenCount > 0
							? `Showing ${result.issues.length} of ${issueCount} issues. Verify a work email on this domain to run the Perplexity check and see the rest.`
							: "Verify a work email on this domain to run the Perplexity check and email yourself the full report."}
					</p>
				) : null}
			</div>
		</div>
	);
}
