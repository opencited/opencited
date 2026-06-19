"use client";

import { PageShell } from "@/app/components/page-shell";
import { useDomainProject } from "@/app/components/domain-project-provider";
import { CompetitorIntelligence } from "./_components/competitor-intelligence";

export default function CompetitorsPage() {
	const domainProject = useDomainProject();

	return (
		<PageShell
			title="Competitors"
			backHref="/app/ai-visibility"
			backLabel="Back to AI Visibility"
		>
			<CompetitorIntelligence domainProjectId={domainProject.id} />
		</PageShell>
	);
}
