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
	Badge,
} from "@opencited/ui";
import { Loader2, Terminal } from "lucide-react";

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
	const isValid = wordCount >= 10 && wordCount <= 500;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Terminal className="h-5 w-5 text-muted-foreground" />
						Create New Prompt
					</DialogTitle>
					<DialogDescription>
						Save a query to use with the browser crawler. Must be between 10 and
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
						className="min-h-[200px] text-sm"
						autoFocus
					/>

					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span
								className={`text-sm font-medium ${
									isInvalid ? "text-destructive" : "text-muted-foreground"
								}`}
							>
								{wordCount} {wordCount === 1 ? "word" : "words"}
							</span>
							{isValid && (
								<Badge variant="success" className="text-xs">
									Valid length
								</Badge>
							)}
						</div>
						<div className="flex gap-4 text-xs text-muted-foreground">
							<span
								className={wordCount < 10 ? "text-destructive font-medium" : ""}
							>
								Min: 10 words
							</span>
							<span
								className={
									wordCount > 500 ? "text-destructive font-medium" : ""
								}
							>
								Max: 500 words
							</span>
						</div>
					</div>

					{wordCount > 0 && wordCount < 10 && (
						<p className="text-xs text-destructive">
							{10 - wordCount} more {10 - wordCount === 1 ? "word" : "words"}{" "}
							required
						</p>
					)}
					{wordCount > 500 && (
						<p className="text-xs text-destructive">
							{wordCount - 500} {wordCount - 500 === 1 ? "word" : "words"} over
							limit
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
