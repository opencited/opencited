"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { AppRouter } from "@opencited/trpc";
import { useTRPC } from "@/app/_trpc/client";
import { ScanResultReport } from "./scan-result-report";
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

	const issues =
		(unlockedForThisScan ? unlock?.report.issues : result.issues) ??
		result.issues;
	const issueCount =
		(unlockedForThisScan ? unlock?.report.issueCount : result.issueCount) ??
		result.issueCount;
	const hiddenCount = issueCount - result.issues.length;
	const isUnlocked = unlockedForThisScan || gate.step === "unlocked";
	const showVisibility = isUnlocked && Boolean(probe);

	const visibilityRef = useScrollToVisibilityWhenReady(probe, showVisibility);

	const issuesFooter = !isUnlocked
		? hiddenCount > 0
			? `Showing ${result.issues.length} of ${issueCount} issues. Verify a work email on this domain to run the Perplexity check and see the rest.`
			: "Verify a work email on this domain to run the Perplexity check and email yourself the full report."
		: undefined;

	return (
		<div className="animate-fade-in border-t border-border/60 pt-8">
			<ScanResultReport
				domain={result.domain}
				durationMs={result.durationMs}
				probe={showVisibility ? probe : null}
				visibilitySectionRef={visibilityRef}
				score={result.score}
				readiness={result.readiness}
				showDurationInTechnical
				issues={issues}
				issueCount={issueCount}
				issuesTitle={isUnlocked ? "All issues" : "Top issues"}
				issuesFooter={issuesFooter}
			/>
		</div>
	);
}
