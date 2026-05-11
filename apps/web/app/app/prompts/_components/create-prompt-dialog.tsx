"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
	Button,
	Textarea,
} from "@opencited/ui";
import { Loader2 } from "lucide-react";

interface CreatePromptDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	domainProjectId: string;
	onSuccess: () => void;
}

export function CreatePromptDialog({
	open,
	onOpenChange,
	domainProjectId,
	onSuccess,
}: CreatePromptDialogProps) {
	const trpc = useTRPC();
	const [query, setQuery] = useState("");
	const [wordCount, setWordCount] = useState(0);

	const createMutation = useMutation(
		trpc.promptQuery.create.mutationOptions({
			onSuccess: () => {
				onSuccess();
				onOpenChange(false);
				setQuery("");
			},
		}),
	);

	useEffect(() => {
		const words = query
			.trim()
			.split(/\s+/)
			.filter((w) => w.length > 0);
		setWordCount(words.length);
	}, [query]);

	const handleSubmit = () => {
		createMutation.mutate({
			domainProjectId,
			query,
		});
	};

	const isInvalid = wordCount < 10 || wordCount > 500;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Create New Prompt</DialogTitle>
					<DialogDescription>
						Save a query to use with the browser crawler. Must be between 50 and
						500 words.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<Textarea
						placeholder="Enter your prompt query here..."
						value={query}
						onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
							setQuery(e.target.value)
						}
						className="min-h-[200px] font-mono text-sm"
						autoFocus
					/>

					<div className="flex items-center justify-between text-sm">
						<span
							className={
								isInvalid ? "text-destructive" : "text-muted-foreground"
							}
						>
							{wordCount} {wordCount === 1 ? "word" : "words"}
						</span>
						<div className="flex gap-4 text-xs text-muted-foreground">
							<span className={wordCount < 10 ? "text-destructive" : ""}>
								Min: 10 words
							</span>
							<span className={wordCount > 500 ? "text-destructive" : ""}>
								Max: 500 words
							</span>
						</div>
					</div>

					{wordCount > 0 && wordCount < 10 && (
						<p className="text-xs text-destructive">
							{10 - wordCount} more words required
						</p>
					)}
					{wordCount > 500 && (
						<p className="text-xs text-destructive">
							{wordCount - 500} words over limit
						</p>
					)}
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={isInvalid || createMutation.isPending || !query.trim()}
					>
						{createMutation.isPending ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
								Saving...
							</>
						) : (
							"Save Prompt"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
