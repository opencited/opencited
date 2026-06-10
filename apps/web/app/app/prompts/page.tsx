"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { PageShell } from "@/app/components/page-shell";
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Spinner,
} from "@opencited/ui";
import { Plus, Trash2, Clock, Calendar, Terminal, Pencil } from "lucide-react";
import { Skeleton } from "@opencited/ui";
import { CreatePromptDialog } from "./_components/create-prompt-dialog";
import { ViewPromptDialog } from "./_components/view-prompt-dialog";
import { EditPromptDialog } from "./_components/edit-prompt-dialog";
import { RunCrawlButton } from "./_components/run-crawl-button";
import { TimeAgo } from "@/app/components/time-ago";
import { QueryCell } from "@/app/components/query-cell";
import { format } from "date-fns";
import { useConfirmation } from "@/app/hooks/use-confirmation";

export default function PromptsPage() {
	const trpc = useTRPC();
	const { confirm, dialog } = useConfirmation();

	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [promptToView, setPromptToView] = useState<{
		id: string;
		query: string;
		createdAt: string;
		lastCrawledAt: string | null;
	} | null>(null);
	const [promptToEdit, setPromptToEdit] = useState<{
		id: string;
		query: string;
		domainProjectId: string;
	} | null>(null);
	const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

	const domainProjectQuery = useQuery(trpc.domainProject.get.queryOptions());
	const domainProject = domainProjectQuery.data;

	const promptsQuery = useQuery(
		trpc.promptQuery.list.queryOptions({
			domainProjectId: domainProject?.id ?? "",
		}),
	);

	const deleteMutation = useMutation(
		trpc.promptQuery.delete.mutationOptions({
			onSuccess: () => {
				promptsQuery.refetch();
			},
		}),
	);

	const handleDeletePrompt = useCallback(
		async (id: string, query: string) => {
			const confirmed = await confirm({
				title: "Delete Prompt",
				description:
					"Are you sure you want to delete this prompt? This action cannot be undone.",
				content: (
					<div className="py-4">
						<p className="text-sm text-muted-foreground max-h-[40vh] overflow-y-auto bg-muted p-3 rounded">
							{query}
						</p>
					</div>
				),
				confirmLabel: "Delete",
				variant: "destructive",
			});

			if (!confirmed || !domainProject) return;

			deleteMutation.mutate({
				id,
				domainProjectId: domainProject.id,
			});
		},
		[confirm, deleteMutation, domainProject],
	);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLTextAreaElement
			) {
				return;
			}
			if (event.key === "n") {
				event.preventDefault();
				setIsCreateDialogOpen(true);
			}
			if (event.key === "r" && selectedPromptId) {
				event.preventDefault();
				const prompt = promptsQuery.data?.find(
					(p) => p.id === selectedPromptId,
				);
				if (prompt) {
					const button = document.querySelector(
						`[data-prompt-id="${selectedPromptId}"] .run-crawl-btn`,
					) as HTMLButtonElement;
					button?.click();
				}
			}
			if (event.key === "d" && selectedPromptId) {
				event.preventDefault();
				const prompt = promptsQuery.data?.find(
					(p) => p.id === selectedPromptId,
				);
				if (prompt) {
					handleDeletePrompt(prompt.id, prompt.query);
				}
			}
			if (event.key === "e" && selectedPromptId) {
				event.preventDefault();
				const prompt = promptsQuery.data?.find(
					(p) => p.id === selectedPromptId,
				);
				if (prompt && domainProject) {
					setPromptToEdit({
						id: prompt.id,
						query: prompt.query,
						domainProjectId: domainProject.id,
					});
				}
			}
			if (event.key === "Enter" && selectedPromptId) {
				event.preventDefault();
				const prompt = promptsQuery.data?.find(
					(p) => p.id === selectedPromptId,
				);
				if (prompt) {
					setPromptToView({
						id: prompt.id,
						query: prompt.query,
						createdAt: prompt.createdAt,
						lastCrawledAt: prompt.lastCrawledAt,
					});
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedPromptId, promptsQuery.data]);

	if (domainProjectQuery.isLoading) {
		return (
			<PageShell title="Prompts">
				<div className="flex items-center justify-center py-12">
					<Spinner className="h-5 w-5" />
					<span className="ml-2 text-muted-foreground">Loading prompts...</span>
				</div>
			</PageShell>
		);
	}

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
				<div>
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
				</div>
			}
		>
			<QueryCell
				query={promptsQuery}
				loading={
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
						{[1, 2, 3].map((i) => (
							<Card key={i}>
								<div className="flex items-center gap-3 px-5 pt-3 pb-1.5">
									<Skeleton className="h-3 w-16" />
									<Skeleton className="h-3 w-20" />
								</div>
								<CardHeader className="pb-1 pt-1">
									<Skeleton className="h-4 w-3/4" />
								</CardHeader>
								<CardContent className="pt-0 pb-4 mt-auto">
									<div className="flex items-center justify-end">
										<Skeleton className="h-8 w-20 rounded-sm" />
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				}
				error={() => (
					<Card>
						<CardContent className="py-8 text-center">
							<p className="text-destructive">
								Couldn&apos;t load prompts. Try again.
							</p>
						</CardContent>
					</Card>
				)}
				success={(prompts) => {
					if (!prompts || prompts.length === 0) {
						return (
							<Card variant="dashed">
								<CardContent className="py-16 text-center">
									<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
										<Terminal className="h-6 w-6 text-muted-foreground" />
									</div>
									<h3 className="text-lg font-semibold mb-2">No prompts yet</h3>
									<p className="text-muted-foreground mb-6 max-w-md mx-auto">
										Prompts are queries you save to crawl AI answer engines.
										Create your first prompt to start tracking how AI engines
										respond to your searches.
									</p>
									<Button onClick={() => setIsCreateDialogOpen(true)}>
										<Plus className="h-4 w-4 mr-2" />
										Create your first prompt
									</Button>
								</CardContent>
							</Card>
						);
					}

					return (
						<div className="grid gap-3 p-4 sm:p-0 md:grid-cols-2 lg:grid-cols-3">
							{prompts.map((prompt, _index) => {
								return (
									<Card
										key={prompt.id}
										data-prompt-id={prompt.id}
										className="group focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer transition-shadow hover:shadow-sm flex flex-col"
										onClick={() => {
											setSelectedPromptId(prompt.id);
											setPromptToView({
												id: prompt.id,
												query: prompt.query,
												createdAt: prompt.createdAt,
												lastCrawledAt: prompt.lastCrawledAt,
											});
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												setSelectedPromptId(prompt.id);
												setPromptToView({
													id: prompt.id,
													query: prompt.query,
													createdAt: prompt.createdAt,
													lastCrawledAt: prompt.lastCrawledAt,
												});
											}
										}}
										tabIndex={0}
										role="button"
										aria-label={`View prompt: ${prompt.query}`}
									>
										<div className="flex items-center justify-between px-5 pt-3 pb-1.5 text-xs text-muted-foreground">
											<div className="flex items-center gap-2.5">
												<div className="flex items-center gap-1">
													<Calendar className="h-3 w-3" />
													<span>
														{format(new Date(prompt.createdAt), "MMM d")}
													</span>
												</div>
												{prompt.lastCrawledAt ? (
													<div className="flex items-center gap-1">
														<Clock className="h-3 w-3" />
														<TimeAgo date={prompt.lastCrawledAt} />
													</div>
												) : (
													<span>Never crawled</span>
												)}
											</div>
										</div>
										<CardHeader className="pb-1 pt-1">
											<CardTitle className="text-sm font-medium leading-relaxed line-clamp-3">
												{prompt.query}
											</CardTitle>
										</CardHeader>
										<CardContent className="pt-0 pb-4 mt-auto">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-1">
													<Button
														variant="ghost"
														size="icon"
														onClick={(e) => {
															e.stopPropagation();
															setPromptToEdit({
																id: prompt.id,
																query: prompt.query,
																domainProjectId: domainProject.id,
															});
														}}
														className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity h-8 w-8"
													>
														<Pencil className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														onClick={(e) => {
															e.stopPropagation();
															handleDeletePrompt(prompt.id, prompt.query);
														}}
														className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity h-8 w-8 hover:text-destructive"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
												<RunCrawlButton
													promptQueryId={prompt.id}
													domainProjectId={domainProject.id}
												/>
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					);
				}}
			/>

			<ViewPromptDialog
				open={!!promptToView}
				onOpenChange={(open) => {
					if (!open) setPromptToView(null);
				}}
				prompt={promptToView}
				onEdit={() => {
					if (promptToView) {
						setPromptToEdit({
							id: promptToView.id,
							query: promptToView.query,
							domainProjectId: domainProject.id,
						});
						setPromptToView(null);
					}
				}}
			/>

			<EditPromptDialog
				open={!!promptToEdit}
				onOpenChange={(open) => {
					if (!open) setPromptToEdit(null);
				}}
				prompt={promptToEdit}
				onSuccess={() => {
					promptsQuery.refetch();
				}}
			/>

			{dialog}
		</PageShell>
	);
}
