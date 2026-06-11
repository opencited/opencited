"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
	Button,
	Checkbox,
	Input,
	Spinner,
	Badge,
} from "@opencited/ui";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useActiveCrawls } from "@/app/hooks/use-active-crawls";

interface BatchRunDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	domainProjectId: string;
	prompts: Array<{
		id: string;
		query: string;
		lastCrawledAt: string | null;
	}>;
	onSuccess: () => void;
}

export function BatchRunDialog({
	open,
	onOpenChange,
	domainProjectId,
	prompts,
	onSuccess,
}: BatchRunDialogProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(
		() => new Set(prompts.map((p) => p.id)),
	);

	const { activeCrawls } = useActiveCrawls({
		domainProjectId,
		enabled: open,
	});

	const activePromptIds = new Set(
		activeCrawls.map((crawl) => crawl.promptQueryId),
	);

	const filteredPrompts = useMemo(() => {
		if (!searchQuery.trim()) return prompts;
		const query = searchQuery.toLowerCase();
		return prompts.filter((p) => p.query.toLowerCase().includes(query));
	}, [prompts, searchQuery]);

	const selectablePrompts = useMemo(() => {
		return filteredPrompts.filter((p) => !activePromptIds.has(p.id));
	}, [filteredPrompts, activePromptIds]);

	const isAllSelected =
		selectablePrompts.length > 0 &&
		selectablePrompts.every((p) => selectedIds.has(p.id));

	const _isSomeSelected = selectablePrompts.some((p) => selectedIds.has(p.id));

	const handleToggleAll = () => {
		if (isAllSelected) {
			setSelectedIds((prev) => {
				const next = new Set(prev);
				for (const p of selectablePrompts) {
					next.delete(p.id);
				}
				return next;
			});
		} else {
			setSelectedIds((prev) => {
				const next = new Set(prev);
				for (const p of selectablePrompts) {
					next.add(p.id);
				}
				return next;
			});
		}
	};

	const handleTogglePrompt = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const batchMutation = useMutation(
		trpc.promptQueryCrawl.batchStart.mutationOptions(),
	);

	const handleSubmit = async () => {
		const ids = Array.from(selectedIds);
		if (ids.length === 0) return;
		try {
			const data = await batchMutation.mutateAsync({
				promptQueryIds: ids,
				provider: "perplexity",
			});
			toast.success("Batch crawl started", {
				description: `Running ${data.count} crawl${data.count === 1 ? "" : "s"} in background...`,
			});
			queryClient.invalidateQueries({
				queryKey: trpc.promptQueryCrawl.list.queryKey({
					domainProjectId,
					status: ["pending", "running"],
				}),
			});
			onSuccess();
			handleOpenChange(false);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			toast.error("Failed to start batch crawl", {
				description: message,
			});
		}
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setSelectedIds(new Set(prompts.map((p) => p.id)));
			setSearchQuery("");
		}
		onOpenChange(open);
	};

	const selectedCount = Array.from(selectedIds).filter(
		(id) => !activePromptIds.has(id),
	).length;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-2xl h-[80vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>Batch Run Crawls</DialogTitle>
					<DialogDescription>
						Select prompts to crawl. Each prompt will run as a separate crawl
						job.
					</DialogDescription>
				</DialogHeader>

				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search prompts..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>

				<div className="flex-1 overflow-y-auto space-y-1">
					{filteredPrompts.map((prompt) => {
						const isActive = activePromptIds.has(prompt.id);
						const isSelected = selectedIds.has(prompt.id);
						const isDisabled = isActive;

						return (
							<div
								key={prompt.id}
								className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
									isDisabled ? "opacity-50" : "hover:bg-muted/50"
								}`}
							>
								<Checkbox
									checked={isSelected && !isDisabled}
									disabled={isDisabled}
									onCheckedChange={() => handleTogglePrompt(prompt.id)}
									className="mt-0.5"
								/>
								<div className="flex-1 min-w-0">
									<p className="text-sm line-clamp-2">{prompt.query}</p>
									<div className="flex items-center gap-2 mt-1">
										{prompt.lastCrawledAt ? (
											<span className="text-xs text-muted-foreground">
												Last crawled:{" "}
												{format(new Date(prompt.lastCrawledAt), "MMM d, yyyy")}
											</span>
										) : (
											<span className="text-xs text-muted-foreground">
												Never crawled
											</span>
										)}
										{isActive && (
											<Badge variant="outline" className="text-xs">
												<Loader2 className="h-3 w-3 mr-1 animate-spin" />
												Running
											</Badge>
										)}
									</div>
								</div>
							</div>
						);
					})}
					{filteredPrompts.length === 0 && (
						<div className="py-8 text-center text-sm text-muted-foreground">
							No prompts found
						</div>
					)}
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<div className="flex items-center gap-3 mr-auto">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleToggleAll}
							disabled={selectablePrompts.length === 0}
						>
							{isAllSelected ? "Deselect All" : "Select All"}
						</Button>
						<span className="text-sm text-muted-foreground">
							{selectedCount} selected
						</span>
					</div>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={selectedCount === 0 || batchMutation.isPending}
					>
						{batchMutation.isPending ? (
							<>
								<Spinner className="mr-2 h-4 w-4" />
								Starting...
							</>
						) : (
							`Run ${selectedCount} Crawl${selectedCount === 1 ? "" : "s"}`
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
