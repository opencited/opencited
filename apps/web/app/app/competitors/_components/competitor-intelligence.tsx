"use client";

import {
	Card,
	CardContent,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@opencited/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useTRPC } from "@/app/_trpc/client";
import { QueryCell } from "@/app/components/query-cell";
import { CompetitorDetailSheet } from "./competitor-detail-sheet";

interface CompetitorIntelligenceProps {
	domainProjectId: string;
}

export function CompetitorIntelligence({
	domainProjectId,
}: CompetitorIntelligenceProps) {
	const trpc = useTRPC();
	const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(
		null,
	);

	const query = useQuery({
		...trpc.aiVisibility.getCompetitorIntelligence.queryOptions({
			domainProjectId,
		}),
		enabled: !!domainProjectId,
	});

	return (
		<div className="space-y-4">
			<QueryCell
				query={query}
				loading={
					<div className="border border-border/40 rounded-lg overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>
										<Skeleton className="h-4 w-24" />
									</TableHead>
									<TableHead>
										<Skeleton className="h-4 w-20" />
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{[1, 2, 3, 4, 5].map((i) => (
									<TableRow key={i}>
										<TableCell>
											<div className="space-y-1">
												<Skeleton className="h-4 w-32" />
												<Skeleton className="h-3 w-24 font-mono" />
											</div>
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-16" />
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				}
				success={(data) => {
					if (!data || data.length === 0) {
						return (
							<Card variant="dashed">
								<CardContent className="py-8 text-center">
									<p className="text-muted-foreground">
										No competitors tracked yet. Add competitors on the{" "}
										<Link
											href="/app/prompts"
											className="text-primary hover:underline"
										>
											Prompts page
										</Link>
										.
									</p>
								</CardContent>
							</Card>
						);
					}

					return (
						<>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Competitor</TableHead>
										<TableHead>Mentioned In</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.map((competitor) => (
										<TableRow
											key={competitor.competitorId}
											className="cursor-pointer"
											onClick={() =>
												setSelectedCompetitor(competitor.competitorId)
											}
										>
											<TableCell>
												<div>
													<p className="text-sm font-medium">
														{competitor.competitorName}
													</p>
													<p className="text-xs font-mono text-muted-foreground">
														{competitor.competitorDomain}
													</p>
												</div>
											</TableCell>
											<TableCell>
												<span className="text-sm">
													{competitor.mentionedInCount} queries
												</span>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>

							{selectedCompetitor && (
								<CompetitorDetailSheet
									competitorId={selectedCompetitor}
									open={!!selectedCompetitor}
									onOpenChange={(open) => {
										if (!open) setSelectedCompetitor(null);
									}}
								/>
							)}
						</>
					);
				}}
			/>
		</div>
	);
}
