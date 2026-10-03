"use client";

import { useEffect, useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { Badge, Button, Spinner } from "@opencited/ui";
import type { AppRouter } from "@opencited/trpc";
import { formatProbeExcerpt } from "@/app/lib/probe-excerpt";
import { PERPLEXITY_LOADING_LINES } from "@/app/lib/scan-loading-copy";
import { useRotatingLine } from "./use-rotating-line";

type Probe = inferRouterOutputs<AppRouter>["scan"]["verifyReport"]["probe"];

interface AiMentionProbeSectionProps {
	probe: Probe;
}

function formatCitationLabel(url: string): string {
	try {
		const parsed = new URL(url);
		const path = parsed.pathname === "/" ? "" : parsed.pathname + parsed.search;
		return `${parsed.host}${path}`;
	} catch {
		return url;
	}
}

function ProbePendingState({ queries }: { queries?: string[] }) {
	const [elapsedSec, setElapsedSec] = useState(0);
	const [activeIndex, setActiveIndex] = useState(0);
	const statusLine = useRotatingLine(PERPLEXITY_LOADING_LINES, 2800);
	const list = queries?.length ? queries : null;

	useEffect(() => {
		const tick = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
		return () => window.clearInterval(tick);
	}, []);

	useEffect(() => {
		if (!list || list.length <= 1) {
			return;
		}
		const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		if (motionQuery.matches) {
			return;
		}
		const cycle = window.setInterval(() => {
			setActiveIndex((i) => (i + 1) % list.length);
		}, 3200);
		return () => window.clearInterval(cycle);
	}, [list]);

	if (!list) {
		return (
			<div className="space-y-2" aria-live="polite">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Spinner className="h-4 w-4 shrink-0" />
					<span key={statusLine} className="animate-line-swap">
						{statusLine}
					</span>
				</div>
				<p className="text-xs text-muted-foreground">
					We&apos;ll email you when the Perplexity results are ready.
				</p>
			</div>
		);
	}

	const minutes = Math.floor(elapsedSec / 60);
	const seconds = elapsedSec % 60;
	const timer =
		minutes > 0
			? `${minutes}:${seconds.toString().padStart(2, "0")}`
			: `${seconds}s`;

	return (
		<div className="space-y-4" aria-live="polite">
			<div className="flex items-center gap-2 text-sm">
				<Spinner className="h-4 w-4 shrink-0" />
				<span>
					<span key={statusLine} className="animate-line-swap">
						{statusLine}
					</span>
					<span className="font-mono text-muted-foreground"> · {timer}</span>
				</span>
			</div>
			<ul className="space-y-2">
				{list.map((query, index) => {
					const isActive = index === activeIndex;
					return (
						<li
							key={query}
							className="flex gap-3 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
						>
							<span
								className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center font-mono text-xs text-muted-foreground"
								aria-hidden
							>
								{isActive ? (
									<Spinner className="h-3.5 w-3.5" />
								) : (
									<span className="tabular-nums">{index + 1}</span>
								)}
							</span>
							<p
								className={
									isActive
										? "text-sm font-medium"
										: "text-sm text-muted-foreground"
								}
							>
								{query}
							</p>
						</li>
					);
				})}
			</ul>
			<p className="text-xs text-muted-foreground">
				Your crawl checklist is done. Live Perplexity results will appear here
				when they finish. We&apos;ll email you a copy too.
			</p>
		</div>
	);
}

function ProbeQueryRow({ query, excerpt }: { query: string; excerpt: string }) {
	const [expanded, setExpanded] = useState(false);
	const { preview, isTruncated } = formatProbeExcerpt(excerpt, expanded);

	return (
		<li className="space-y-2 border-t border-border/60 py-4 first:border-t-0 first:pt-0">
			<p className="text-sm font-medium">{query}</p>
			<p className="text-sm text-muted-foreground">{preview}</p>
			{isTruncated ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto px-0 text-muted-foreground"
					onClick={() => setExpanded((open) => !open)}
				>
					{expanded ? "Show less" : "Read full Perplexity answer"}
				</Button>
			) : null}
		</li>
	);
}

function ProbeResults({
	queries,
}: {
	queries: Extract<Probe, { status: "ok" }>["queries"];
}) {
	const visibleCount = queries.filter((r) => r.visibility === "visible").length;
	const total = queries.length;

	const citationUrls = useMemo(() => {
		const seen = new Set<string>();
		const ordered: string[] = [];
		for (const row of queries) {
			for (const url of row.citationUrls) {
				if (!seen.has(url)) {
					seen.add(url);
					ordered.push(url);
				}
			}
		}
		return ordered;
	}, [queries]);

	return (
		<div className="animate-fade-in space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant={visibleCount > 0 ? "success" : "warning"}>
					{visibleCount > 0 ? "Mentioned" : "Not mentioned"}
				</Badge>
				<p className="text-sm text-muted-foreground">
					Your domain appeared in {visibleCount} of {total} Perplexity{" "}
					{total === 1 ? "answer" : "answers"}
				</p>
			</div>
			<ul className="space-y-0">
				{queries.map((row) => (
					<ProbeQueryRow
						key={row.query}
						query={row.query}
						excerpt={row.excerpt}
					/>
				))}
			</ul>
			{citationUrls.length > 0 ? (
				<div className="space-y-2 border-t border-border/60 pt-4">
					<p className="text-xs font-medium text-muted-foreground">
						{visibleCount > 0
							? "Sources Perplexity cited"
							: "Sites Perplexity cited instead of you"}
					</p>
					<ul className="space-y-1 text-sm">
						{citationUrls.map((url) => (
							<li key={url}>
								<a
									href={url}
									className="font-mono text-xs break-all underline-offset-4 hover:underline"
									target="_blank"
									rel="noreferrer"
								>
									{formatCitationLabel(url)}
								</a>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	);
}

export function AiMentionProbeSection({ probe }: AiMentionProbeSectionProps) {
	if (probe.status === "pending") {
		return <ProbePendingState queries={probe.queries} />;
	}

	if (probe.status === "unavailable") {
		return (
			<p className="text-sm text-muted-foreground">
				We couldn&apos;t finish the Perplexity check for this scan. Try
				verifying your email again, or run a new scan. Your crawl checklist is
				still on this page.
			</p>
		);
	}

	return <ProbeResults queries={probe.queries} />;
}
