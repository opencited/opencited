"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { PageShell } from "@/app/components/page-shell";
import { RunLogsSection } from "@/app/app/ai-visibility/_components/run-logs-section";

export default function CrawlHistoryPage() {
	const trpc = useTRPC();

	const domainProjectQuery = useQuery(trpc.domainProject.get.queryOptions());
	const domainProject = domainProjectQuery.data;

	if (!domainProject) {
		return (
			<PageShell title="Crawl History">
				<div className="flex items-center justify-center py-12">
					<p className="text-muted-foreground">
						Please create a domain project first
					</p>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell title="Crawl History">
			<p className="text-sm text-muted-foreground mb-6">
				View the history of AI visibility crawls and their results
			</p>
			<RunLogsSection domainProjectId={domainProject.id} />
		</PageShell>
	);
}
