"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { PageShell } from "@/app/components/page-shell";
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@opencited/ui";
import { Plus, Trash2, Clock, Calendar } from "lucide-react";
import { CreatePromptDialog } from "./_components/create-prompt-dialog";
import { DeletePromptDialog } from "./_components/delete-prompt-dialog";
import { ViewPromptDialog } from "./_components/view-prompt-dialog";
import { TimeAgo } from "@/app/components/time-ago";
import { QueryCell } from "@/app/components/query-cell";
import { format } from "date-fns";

export default function PromptsPage() {
	const trpc = useTRPC();
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [promptToDelete, setPromptToDelete] = useState<{
		id: string;
		query: string;
	} | null>(null);
	const [promptToView, setPromptToView] = useState<{
		id: string;
		query: string;
		createdAt: string;
		lastCrawledAt: string | null;
	} | null>(null);

	const domainProjectQuery = useQuery(trpc.domainProject.get.queryOptions());
	const domainProject = domainProjectQuery.data;

	const promptsQuery = useQuery(
		trpc.promptQuery.list.queryOptions({
			domainProjectId: domainProject?.id ?? "",
		}),
	);

	if (!domainProject) {
		return (
			<PageShell title="Prompts">
				<div className="flex items-center justify-center py-12">
					<p className="text-muted-foreground">
						Please create a domain project first
					</p>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell
			title="Prompts"
			action={
				<>
					<Button onClick={() => setIsCreateDialogOpen(true)}>
						<Plus className="h-4 w-4 mr-2" />
						New Prompt
					</Button>
					<CreatePromptDialog
						open={isCreateDialogOpen}
						onOpenChange={setIsCreateDialogOpen}
						domainProjectId={domainProject.id}
						onSuccess={() => {
							promptsQuery.refetch();
						}}
					/>
				</>
			}
		>
			<div className="space-y-6">
				<QueryCell
					query={promptsQuery}
					loading={
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{[1, 2, 3].map((i) => (
								<Card key={i} className="animate-pulse">
									<CardHeader>
										<div className="h-4 bg-muted rounded w-3/4" />
									</CardHeader>
									<CardContent>
										<div className="space-y-2">
											<div className="h-3 bg-muted rounded w-full" />
											<div className="h-3 bg-muted rounded w-full" />
											<div className="h-3 bg-muted rounded w-1/2" />
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					}
					error={() => (
						<Card>
							<CardContent className="py-8 text-center text-destructive">
								Couldn&apos;t load prompts. Try again.
							</CardContent>
						</Card>
					)}
					success={(prompts) => {
						if (!prompts || prompts.length === 0) {
							return (
								<Card>
									<CardContent className="py-12 text-center">
										<p className="text-muted-foreground mb-4">
											No prompts saved yet
										</p>
										<Button
											variant="outline"
											onClick={() => setIsCreateDialogOpen(true)}
										>
											<Plus className="h-4 w-4 mr-2" />
											Create your first prompt
										</Button>
									</CardContent>
								</Card>
							);
						}

						return (
							<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
								{prompts.map((prompt) => (
									<Card
										key={prompt.id}
										className="group relative cursor-pointer hover:bg-muted/50 transition-colors"
										onClick={() =>
											setPromptToView({
												id: prompt.id,
												query: prompt.query,
												createdAt: prompt.createdAt,
												lastCrawledAt: prompt.lastCrawledAt,
											})
										}
									>
										<CardHeader>
											<CardTitle className="text-base line-clamp-2">
												{prompt.query}
											</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="space-y-3 text-xs text-muted-foreground">
												<div className="flex items-center gap-1">
													<Calendar className="h-3 w-3" />
													<span>
														Created {format(new Date(prompt.createdAt), "PP")}
													</span>
												</div>
												<div className="flex items-center justify-between">
													{prompt.lastCrawledAt ? (
														<div className="flex items-center gap-1">
															<Clock className="h-3 w-3" />
															<TimeAgo date={prompt.lastCrawledAt} />
														</div>
													) : (
														<span>Never crawled</span>
													)}
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => {
															e.stopPropagation();
															setPromptToDelete({
																id: prompt.id,
																query: prompt.query,
															});
														}}
														className="opacity-0 group-hover:opacity-100 transition-opacity h-auto p-1"
													>
														<Trash2 className="h-3 w-3" />
													</Button>
												</div>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						);
					}}
				/>
			</div>

			<ViewPromptDialog
				open={!!promptToView}
				onOpenChange={(open) => {
					if (!open) setPromptToView(null);
				}}
				prompt={promptToView}
			/>

			{promptToDelete && (
				<DeletePromptDialog
					open={!!promptToDelete}
					onOpenChange={(open) => {
						if (!open) setPromptToDelete(null);
					}}
					promptId={promptToDelete.id}
					promptQuery={promptToDelete.query}
					domainProjectId={domainProject.id}
					onSuccess={() => {
						promptsQuery.refetch();
						setPromptToDelete(null);
					}}
				/>
			)}
		</PageShell>
	);
}
