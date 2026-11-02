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
interface TemplateData {
	id: string;
	title: string;
	description: string;
	text: string;
	industry: string;
	category: string;
	tags: string[];
	createdAt: string;
	updatedAt: string;
}

interface AddTemplateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	template: TemplateData | null;
	domainProjectName: string;
	domainProjectId: string;
	existingPromptTexts: string[];
}

export function AddTemplateDialog({
	open,
	onOpenChange,
	template,
	domainProjectName,
	domainProjectId,
	existingPromptTexts,
}: AddTemplateDialogProps) {
	const trpc = useTRPC();
	const [query, setQuery] = useState("");
	const [wordCount, setWordCount] = useState(0);

	const createMutation = useMutation(
		trpc.promptQuery.create.mutationOptions({
			onSuccess: () => {
				onOpenChange(false);
				setQuery("");
			},
		}),
	);

	useEffect(() => {
		if (template && open) {
			const resolvedText = template.text.replace(
				/{brandName}/g,
				domainProjectName,
			);
			setQuery(resolvedText);
		}
	}, [template, open, domainProjectName]);

	useEffect(() => {
		const words = query
			.trim()
			.split(/\s+/)
			.filter((w) => w.length > 0);
		setWordCount(words.length);
	}, [query]);

	if (!template) return null;

	const isDuplicate = existingPromptTexts.includes(query);
	const isInvalid = wordCount < 10 || wordCount > 500;

	const handleSubmit = () => {
		createMutation.mutate({
			domainProjectId,
			query,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Add Prompt from Library</DialogTitle>
					<DialogDescription>{template.description}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="flex flex-wrap gap-1.5">
						<Badge variant="outline" className="text-xs">
							{template.industry}
						</Badge>
						<Badge variant="outline" className="text-xs">
							{template.category.replace(/-/g, " ")}
						</Badge>
						{(template.tags as string[]).map((tag) => (
							<Badge key={tag} variant="secondary" className="text-xs">
								{tag}
							</Badge>
						))}
					</div>

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
					{isDuplicate && (
						<p className="text-xs text-destructive">
							You already have this exact prompt in your list.
						</p>
					)}
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={
							isInvalid ||
							createMutation.isPending ||
							!query.trim() ||
							isDuplicate
						}
					>
						{createMutation.isPending ? (
							<>
								<Spinner className="mr-2" />
								Adding...
							</>
						) : (
							"Add to My Prompts"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
