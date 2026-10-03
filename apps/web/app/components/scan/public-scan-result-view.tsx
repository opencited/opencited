import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";
import { ScanResultReport } from "./scan-result-report";

type PublicScanResult = inferRouterOutputs<AppRouter>["scan"]["publicResult"];

export function PublicScanResultView({ result }: { result: PublicScanResult }) {
	const hiddenCount = result.issueCount - result.issues.length;

	return (
		<ScanResultReport
			domain={result.domain}
			durationMs={result.durationMs}
			scannedAt={result.scannedAt}
			probe={result.probe}
			score={result.score}
			readiness={result.readiness}
			issues={result.issues}
			issueCount={result.issueCount}
			issuesTitle="Top issues"
			issuesFooter={
				hiddenCount > 0
					? `Showing ${result.issues.length} of ${result.issueCount} issues. Run a new scan on the homepage and verify a work email on this domain for the full report.`
					: undefined
			}
		/>
	);
}
