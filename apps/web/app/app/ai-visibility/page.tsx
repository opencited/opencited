"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { PageShell } from "@/app/components/page-shell";
import { QueryCell } from "@/app/components/query-cell";
import {
	Skeleton,
	Table,
	TableHeader,
	TableBody,
	TableRow,
	TableHead,
	TableCell,
} from "@opencited/ui";
import { EmptyState } from "./_components/empty-state";
import { VisibilityTable } from "./_components/visibility-table";
import { useDomainProject } from "@/app/components/domain-project-provider";

export default function AIVisibilityPage() {
	const trpc = useTRPC();
	const domainProject = useDomainProject();

	const overviewQuery = useQuery({
		...trpc.aiVisibility.getVisibilityOverview.queryOptions({
			domainProjectId: domainProject.id,
		}),
	});

	return (
		<PageShell title="AI Visibility">
			<p className="text-sm text-muted-foreground mb-6">
				Track where your brand appears in AI answers
			</p>
			<QueryCell
				query={overviewQuery}
				loading={
					<div className="border border-border/40 rounded-lg overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>
										<Skeleton className="h-4 w-16" />
									</TableHead>
									<TableHead>
										<Skeleton className="h-4 w-24" />
									</TableHead>
									<TableHead>
										<Skeleton className="h-4 w-12" />
									</TableHead>
									<TableHead>
										<Skeleton className="h-4 w-20" />
									</TableHead>
									<TableHead>
										<Skeleton className="h-4 w-14" />
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{[1, 2, 3, 4, 5].map((i) => (
									<TableRow key={i}>
										<TableCell className="max-w-[300px]">
											<div className="space-y-1.5">
												<Skeleton className="h-4 w-full" />
												<Skeleton className="h-4 w-3/4" />
											</div>
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-20" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-6 w-20 rounded-full" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-6" />
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-1.5">
												<Skeleton className="h-3.5 w-3.5 rounded-full" />
												<Skeleton className="h-4 w-16" />
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				}
				success={(data) => {
					if (!data || data.length === 0) {
						return <EmptyState />;
					}

					return <VisibilityTable data={data} />;
				}}
			/>
		</PageShell>
	);
}
