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
	Spinner,
} from "@opencited/ui";

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
	const _isValid = wordCount >= 10 && wordCount <= 500;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Create New Prompt</DialogTitle>
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

					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-2">
							<span
								className={`text-sm ${
									wordCount > 0 && wordCount < 10
										? "text-destructive font-medium"
										: wordCount > 500
											? "text-destructive font-medium"
											: "text-muted-foreground"
								}`}
							>
								{wordCount === 0
									? "Enter a prompt query"
									: `${wordCount} ${wordCount === 1 ? "word" : "words"}`}
							</span>
							{wordCount >= 10 && wordCount <= 500 && (
								<Badge variant="success" className="text-xs">
									Valid
								</Badge>
							)}
						</div>
						<span className="text-xs text-muted-foreground">10–500 words</span>
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
								<Spinner className="mr-2" />
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
