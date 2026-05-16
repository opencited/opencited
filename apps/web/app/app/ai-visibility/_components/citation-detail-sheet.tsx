"use client";

import type { AppRouter } from "@opencited/trpc";
import {
	Badge,
	Card,
	CardContent,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@opencited/ui";
import type { inferRouterOutputs } from "@trpc/server";
import { ExternalLink } from "lucide-react";

type CrawlSource =
	inferRouterOutputs<AppRouter>["aiVisibility"]["listCrawlSources"][number];

interface CitationDetailSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	source: CrawlSource | null;
}

export function CitationDetailSheet({
	open,
	onOpenChange,
	source,
}: CitationDetailSheetProps) {
	if (!source) return null;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="max-w-2xl w-full flex flex-col">
				<SheetHeader>
					<SheetTitle className="truncate">
						{source.title ?? source.domain}
					</SheetTitle>
					<SheetDescription className="flex items-center gap-2">
						<span>Position #{source.position ?? "N/A"}</span>
						{source.isOwnDomain === "true" && (
							<Badge variant="success">Own Domain</Badge>
						)}
						{source.isCompetitorDomain === "true" && (
							<Badge variant="secondary">Competitor</Badge>
						)}
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto mt-6 space-y-4">
					<Card>
						<CardContent className="p-3">
							<p className="text-xs text-muted-foreground mb-2">URL</p>
							<a
								href={source.url}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-primary hover:underline flex items-center gap-1"
							>
								<span className="truncate">{source.url}</span>
								<ExternalLink className="h-3 w-3 flex-shrink-0" />
							</a>
						</CardContent>
					</Card>

					{source.description && (
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-2">
									Description
								</p>
								<p className="text-sm">{source.description}</p>
							</CardContent>
						</Card>
					)}

					{source.metadata && Object.keys(source.metadata).length > 0 && (
						<Card>
							<CardContent className="p-3">
								<p className="text-xs text-muted-foreground mb-2">Metadata</p>
								<div className="space-y-2">
									{Object.entries(
										source.metadata as Record<string, unknown>,
									).map(([key, value]) => (
										<div
											key={key}
											className="flex items-start justify-between gap-4 text-sm"
										>
											<span className="text-muted-foreground capitalize">
												{key}
											</span>
											<span className="font-medium truncate">
												{typeof value === "string"
													? value
													: JSON.stringify(value)}
											</span>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
