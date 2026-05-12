"use client";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	Button,
	Badge,
} from "@opencited/ui";
import { Clock, Calendar, Terminal, Hash, Type } from "lucide-react";
import { format } from "date-fns";

interface ViewPromptDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	prompt: {
		id: string;
		query: string;
		createdAt: string | Date;
		lastCrawledAt?: string | Date | null;
	} | null;
}

export function ViewPromptDialog({
	open,
	onOpenChange,
	prompt,
}: ViewPromptDialogProps) {
	if (!prompt) return null;

	const wordCount = prompt.query
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0).length;
	const charCount = prompt.query.length;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Terminal className="h-5 w-5 text-muted-foreground" />
						Prompt Details
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-6">
					<div className="flex items-center gap-4 text-sm text-muted-foreground">
						<div className="flex items-center gap-1.5">
							<Calendar className="h-4 w-4" />
							<span>Created {format(new Date(prompt.createdAt), "PPP")}</span>
						</div>
						<div className="flex items-center gap-1.5">
							<Clock className="h-4 w-4" />
							<span>
								{prompt.lastCrawledAt
									? `Last crawled ${format(new Date(prompt.lastCrawledAt), "PPP")}`
									: "Never crawled"}
							</span>
						</div>
					</div>

					<div className="rounded-lg border border-border bg-muted/30 p-4">
						<p className="text-sm leading-relaxed whitespace-pre-wrap">
							{prompt.query}
						</p>
					</div>

					<div className="flex items-center gap-4">
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Hash className="h-3 w-3" />
							<span>
								{wordCount} {wordCount === 1 ? "word" : "words"}
							</span>
						</div>
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Type className="h-3 w-3" />
							<span>{charCount.toLocaleString()} characters</span>
						</div>
						{wordCount < 10 && (
							<Badge variant="destructive" className="text-xs">
								Below minimum (10 words)
							</Badge>
						)}
						{wordCount > 500 && (
							<Badge variant="destructive" className="text-xs">
								Above maximum (500 words)
							</Badge>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
