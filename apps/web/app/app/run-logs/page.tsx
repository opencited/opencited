"use client";

import { useTRPC } from "@/app/_trpc/client";
import { PageShell } from "@/app/components/page-shell";
import { RunLogsSection } from "@/app/app/ai-visibility/_components/run-logs-section";
import { useDomainProject } from "@/app/components/domain-project-provider";

export default function CrawlHistoryPage() {
	const _trpc = useTRPC();
	const domainProject = useDomainProject();

	return (
		<PageShell title="Crawl History">
			<p className="text-sm text-muted-foreground mb-6">
				View the history of AI visibility crawls and their results
			</p>
			<RunLogsSection domainProjectId={domainProject.id} />
		</PageShell>
	);
}
