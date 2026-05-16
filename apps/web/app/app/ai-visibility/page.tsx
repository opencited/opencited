"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@opencited/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/app/_trpc/client";
import { PageShell } from "@/app/components/page-shell";
import { AnalyticsTab } from "./_components/analytics-tab";
import { CitationsTab } from "./_components/citations-tab";
import { RunLogsTab } from "./_components/run-logs-tab";

export default function AIVisibilityPage() {
	const trpc = useTRPC();
	const searchParams = useSearchParams();
	const router = useRouter();

	const [selectedCrawl, setSelectedCrawl] = useState<{
		id: string;
		query: string;
		provider: string | null;
	} | null>(null);

	const activeTab = searchParams.get("tab") ?? "analytics";

	const domainProjectQuery = useQuery(trpc.domainProject.get.queryOptions());
	const domainProject = domainProjectQuery.data;

	const handleTabChange = (tab: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("tab", tab);
		router.push(`/app/ai-visibility?${params.toString()}`, { scroll: false });
	};

	if (!domainProject) {
		return (
			<PageShell title="AI Visibility">
				<div className="flex items-center justify-center py-12">
					<p className="text-muted-foreground">
						Please create a domain project first
					</p>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell title="AI Visibility">
			<Tabs
				value={activeTab}
				onValueChange={handleTabChange}
				className="w-full"
			>
				<TabsList>
					<TabsTrigger value="analytics">Analytics</TabsTrigger>
					<TabsTrigger value="citations">Citations</TabsTrigger>
					<TabsTrigger value="logs">Run Logs</TabsTrigger>
				</TabsList>
				<TabsContent value="analytics">
					<AnalyticsTab domainProjectId={domainProject.id} />
				</TabsContent>
				<TabsContent value="citations">
					<CitationsTab
						domainProjectId={domainProject.id}
						selectedCrawl={selectedCrawl}
						onSelectCrawl={setSelectedCrawl}
					/>
				</TabsContent>
				<TabsContent value="logs">
					<RunLogsTab domainProjectId={domainProject.id} />
				</TabsContent>
			</Tabs>
		</PageShell>
	);
}
