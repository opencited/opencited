"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { PageShell } from "@/app/components/page-shell";
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Tabs,
	TabsList,
	TabsTrigger,
	TabsContent,
} from "@opencited/ui";
import { Plus, Trash2, Clock, Calendar, Terminal } from "lucide-react";
import { Skeleton } from "@opencited/ui";
import { CreatePromptDialog } from "./_components/create-prompt-dialog";
import { DeletePromptDialog } from "./_components/delete-prompt-dialog";
import { ViewPromptDialog } from "./_components/view-prompt-dialog";
import { RunCrawlButton } from "./_components/run-crawl-button";
import { HistoryTab } from "./_components/history-tab";
import { CrawlResultsSheet } from "./_components/crawl-results-sheet";
import { TimeAgo } from "@/app/components/time-ago";
import { QueryCell } from "@/app/components/query-cell";
import { format } from "date-fns";
import { useSearchParams, useRouter } from "next/navigation";
import { useCrawlPolling } from "./_components/use-crawl-polling";

export default function PromptsPage() {
	const trpc = useTRPC();
	const _queryClient = useQueryClient();
	const searchParams = useSearchParams();
	const router = useRouter();

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
	const [crawlToView, setCrawlToView] = useState<any | null>(null);
	const [runningCrawlIds, setRunningCrawlIds] = useState<Set<string>>(
		new Set(),
	);
	const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

	const activeTab = searchParams.get("tab") ?? "prompts";

	const domainProjectQuery = useQuery(trpc.domainProject.get.queryOptions());
	const domainProject = domainProjectQuery.data;

	const promptsQuery = useQuery(
		trpc.promptQuery.list.queryOptions({
			domainProjectId: domainProject?.id ?? "",
		}),
	);

	const _crawlsQuery = useQuery({
		...trpc.promptQueryCrawl.list.queryOptions({
			domainProjectId: domainProject?.id ?? "",
		}),
		enabled: activeTab === "history" && !!domainProject,
	});

	const { completedCrawlIds } = useCrawlPolling({
		runningCrawlIds,
		enabled: true,
	});

	useEffect(() => {
		if (completedCrawlIds.size === 0) return;

		setRunningCrawlIds((prev) => {
			const next = new Set(prev);
			for (const id of completedCrawlIds) {
				next.delete(id);
			}
			return next;
		});
		promptsQuery.refetch();
	}, [completedCrawlIds, promptsQuery]);

	const handleTabChange = useCallback(
		(tab: "prompts" | "history") => {
			const params = new URLSearchParams(searchParams.toString());
			params.set("tab", tab);
			router.push(`/app/prompts?${params.toString()}`, { scroll: false });
		},
		[router, searchParams],
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
			if (event.key === "n" && activeTab === "prompts") {
				event.preventDefault();
				setIsCreateDialogOpen(true);
			}
			if (event.key === "r" && selectedPromptId && activeTab === "prompts") {
				event.preventDefault();
				// Trigger crawl on selected prompt
				const prompt = promptsQuery.data?.find(
					(p) => p.id === selectedPromptId,
				);
				if (prompt && !runningCrawlIds.has(prompt.id)) {
					// The RunCrawlButton will handle this via its onClick
					const button = document.querySelector(
						`[data-prompt-id="${selectedPromptId}"] .run-crawl-btn`,
					) as HTMLButtonElement;
					button?.click();
				}
			}
			if (event.key === "d" && selectedPromptId && activeTab === "prompts") {
				event.preventDefault();
				const prompt = promptsQuery.data?.find(
					(p) => p.id === selectedPromptId,
				);
				if (prompt) {
					setPromptToDelete({ id: prompt.id, query: prompt.query });
				}
			}
			if (
				event.key === "Enter" &&
				selectedPromptId &&
				activeTab === "prompts"
			) {
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
	}, [activeTab, selectedPromptId, promptsQuery.data, runningCrawlIds]);

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
			<Tabs
				value={activeTab}
				onValueChange={(v) => handleTabChange(v as "prompts" | "history")}
				className="w-full"
			>
				<TabsList>
					<TabsTrigger value="prompts">Prompts</TabsTrigger>
					<TabsTrigger value="history">History</TabsTrigger>
				</TabsList>
				<TabsContent value="prompts">
					<QueryCell
						query={promptsQuery}
						loading={
							<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
								{[1, 2, 3].map((i) => (
									<Card key={i}>
										<CardHeader>
											<Skeleton className="h-4 w-3/4" />
										</CardHeader>
										<CardContent>
											<div className="space-y-2">
												<Skeleton className="h-3 w-full" />
												<Skeleton className="h-3 w-full" />
												<Skeleton className="h-3 w-1/2" />
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
											<h3 className="text-lg font-semibold mb-2">
												No prompts yet
											</h3>
											<p className="text-muted-foreground mb-6 max-w-md mx-auto">
												Prompts are queries you save to crawl AI answer engines.
												Create your first prompt to start tracking how AI
												engines respond to your searches.
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
										const isRunning = runningCrawlIds.has(prompt.id);

										return (
											<Card
												key={prompt.id}
												data-prompt-id={prompt.id}
												className="group focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer transition-shadow hover:shadow-sm"
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
												<CardHeader className="pb-3">
													<CardTitle className="text-sm font-medium leading-relaxed line-clamp-3">
														{prompt.query}
													</CardTitle>
												</CardHeader>
												<CardContent className="pt-0">
													<div className="flex items-center justify-between text-xs text-muted-foreground">
														<div className="flex items-center gap-3">
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
														<div className="flex items-center gap-1">
															<RunCrawlButton
																promptQueryId={prompt.id}
																isRunning={isRunning}
																onCrawlStart={() => {
																	setRunningCrawlIds((prev) =>
																		new Set(prev).add(prompt.id),
																	);
																}}
															/>
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
																className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity h-9 w-9"
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>
													</div>
												</CardContent>
											</Card>
										);
									})}
								</div>
							);
						}}
					/>
				</TabsContent>
				<TabsContent value="history">
					<HistoryTab
						domainProjectId={domainProject.id}
						onSelectCrawl={(crawl) => {
							setCrawlToView(crawl);
						}}
					/>
				</TabsContent>
			</Tabs>

			<CrawlResultsSheet
				open={!!crawlToView}
				onOpenChange={(open) => {
					if (!open) setCrawlToView(null);
				}}
				crawl={crawlToView}
			/>

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
