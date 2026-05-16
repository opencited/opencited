"use client";

import {
	Badge,
	Card,
	CardContent,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@opencited/ui";
import { useQuery } from "@tanstack/react-query";
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
			<h2 className="text-lg font-semibold">Competitor Intelligence</h2>

			<QueryCell
				query={query}
				loading={
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-12 bg-muted rounded-lg" />
						))}
					</div>
				}
				success={(data) => {
					if (!data || data.length === 0) {
						return (
							<Card variant="dashed">
								<CardContent className="py-8 text-center">
									<p className="text-muted-foreground">
										No competitors tracked yet. Add competitors on the{" "}
										<a
											href="/app/prompts"
											className="text-primary hover:underline"
										>
											Prompts page
										</a>
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
										<TableHead>Avg Position</TableHead>
										<TableHead>Before You</TableHead>
										<TableHead>After You</TableHead>
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
											<TableCell>
												{competitor.avgPosition !== null ? (
													<span className="text-sm">
														#{competitor.avgPosition}
													</span>
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell>
												{competitor.appearsBeforeYouCount > 0 ? (
													<Badge variant="warning">
														{competitor.appearsBeforeYouCount}
													</Badge>
												) : (
													<span className="text-sm text-muted-foreground">
														0
													</span>
												)}
											</TableCell>
											<TableCell>
												{competitor.appearsAfterYouCount > 0 ? (
													<Badge variant="success">
														{competitor.appearsAfterYouCount}
													</Badge>
												) : (
													<span className="text-sm text-muted-foreground">
														0
													</span>
												)}
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
