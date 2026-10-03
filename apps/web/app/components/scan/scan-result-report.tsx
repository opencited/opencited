import type { ReactNode, Ref } from "react";
import { Badge } from "@opencited/ui";
import {
	READINESS_BADGE_VARIANTS,
	READINESS_LABELS,
	formatPublicScanTime,
	formatScanDuration,
} from "@/app/lib/scan-display";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";
import { AiMentionProbeSection } from "./ai-mention-probe-section";

type Readiness = inferRouterOutputs<AppRouter>["scan"]["run"]["readiness"];
type Probe = inferRouterOutputs<AppRouter>["scan"]["verifyReport"]["probe"];
type Issue = inferRouterOutputs<AppRouter>["scan"]["run"]["issues"][number];

export function ScanReportDomainHeader({
	domain,
	durationMs,
	scannedAt,
}: {
	domain: string;
	durationMs: number;
	scannedAt?: string;
}) {
	return (
		<header className="space-y-1.5 pb-2">
			<p className="font-mono text-lg font-semibold tracking-tight">{domain}</p>
			<p className="text-xs text-muted-foreground">
				Scanned in {formatScanDuration(durationMs)}
				{scannedAt ? (
					<>
						<span aria-hidden="true"> · </span>
						<time dateTime={scannedAt}>{formatPublicScanTime(scannedAt)}</time>
					</>
				) : null}
			</p>
		</header>
	);
}

function ScanReportSection({
	id,
	title,
	aside,
	children,
	sectionRef,
}: {
	id?: string;
	title: string;
	aside?: ReactNode;
	children: ReactNode;
	sectionRef?: Ref<HTMLElement>;
}) {
	return (
		<section
			ref={sectionRef}
			id={id}
			className="scroll-mt-28 space-y-4 border-t border-border/60 pt-10 first:border-t-0 first:pt-0"
			aria-labelledby={id ? `${id}-heading` : undefined}
		>
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<h2
					id={id ? `${id}-heading` : undefined}
					className="text-sm font-semibold"
				>
					{title}
				</h2>
				{aside ? <div className="shrink-0">{aside}</div> : null}
			</div>
			{children}
		</section>
	);
}

function TechnicalScoreBlock({
	score,
	readiness,
	durationMs,
	showDurationInMeta,
}: {
	score: number;
	readiness: Readiness;
	durationMs: number;
	showDurationInMeta?: boolean;
}) {
	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<span className="font-mono text-base font-medium tabular-nums">
					{score}/100
				</span>
				<Badge variant={READINESS_BADGE_VARIANTS[readiness]}>
					{READINESS_LABELS[readiness]}
				</Badge>
				{showDurationInMeta ? (
					<span className="text-sm text-muted-foreground">
						Finished in {formatScanDuration(durationMs)}
					</span>
				) : null}
			</div>
			<p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
				Crawl checklist only. This score does not measure citations in AI
				answers.
			</p>
		</div>
	);
}

export function IssueFixText({ text }: { text: string }) {
	return (
		<p className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
			{text}
		</p>
	);
}

function IssuesBlock({
	title,
	issues,
	issueCount,
	footer,
}: {
	title: string;
	issues: Issue[];
	issueCount: number;
	footer?: ReactNode;
}) {
	return (
		<ScanReportSection
			title={title}
			aside={
				issueCount === 0 ? (
					<Badge variant="success">All checks passed</Badge>
				) : (
					<Badge variant="warning">
						{issueCount} {issueCount === 1 ? "issue" : "issues"}
					</Badge>
				)
			}
		>
			{issues.length === 0 ? (
				<p className="max-w-prose text-sm text-muted-foreground">
					No issues found. Robots.txt, sitemap, HTTPS, structured data, and AI
					crawler access look good.
				</p>
			) : (
				<ul className="space-y-6">
					{issues.map((issue) => (
						<li key={`${issue.check}-${issue.issue}`} className="space-y-2">
							<Badge variant="secondary" className="font-mono text-xs">
								{issue.check}
							</Badge>
							<p className="text-sm font-medium leading-snug">{issue.issue}</p>
							<IssueFixText text={issue.howToFix} />
						</li>
					))}
				</ul>
			)}
			{footer ? (
				<p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
					{footer}
				</p>
			) : null}
		</ScanReportSection>
	);
}

export function ScanResultReport({
	domain,
	durationMs,
	scannedAt,
	probe,
	visibilitySectionRef,
	score,
	readiness,
	showDurationInTechnical,
	issues,
	issueCount,
	issuesTitle,
	issuesFooter,
}: {
	domain: string;
	durationMs: number;
	scannedAt?: string;
	probe?: Probe | null;
	visibilitySectionRef?: Ref<HTMLElement>;
	score: number;
	readiness: Readiness;
	showDurationInTechnical?: boolean;
	issues: Issue[];
	issueCount: number;
	issuesTitle: string;
	issuesFooter?: string;
}) {
	return (
		<div className="space-y-8">
			<ScanReportDomainHeader
				domain={domain}
				durationMs={durationMs}
				scannedAt={scannedAt}
			/>
			<div className="flex flex-col">
				{probe ? (
					<ScanReportSection
						id="ai-answer-visibility"
						title="Answer engine visibility"
						aside={
							<span className="text-xs text-muted-foreground">
								3 live Perplexity queries
							</span>
						}
						sectionRef={visibilitySectionRef}
					>
						<AiMentionProbeSection probe={probe} />
					</ScanReportSection>
				) : null}
				<ScanReportSection title="Technical checklist">
					<TechnicalScoreBlock
						score={score}
						readiness={readiness}
						durationMs={durationMs}
						showDurationInMeta={showDurationInTechnical}
					/>
				</ScanReportSection>
				<IssuesBlock
					title={issuesTitle}
					issues={issues}
					issueCount={issueCount}
					footer={issuesFooter}
				/>
			</div>
		</div>
	);
}
