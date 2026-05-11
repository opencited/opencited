"use client";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	Button,
} from "@opencited/ui";
import { Clock, Calendar } from "lucide-react";
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

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>Prompt Details</DialogTitle>
				</DialogHeader>

				<div className="space-y-6">
					<div className="space-y-3">
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
							<p className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
								{prompt.query}
							</p>
						</div>

						<div className="flex items-center justify-between text-xs text-muted-foreground">
							<span>
								{
									prompt.query
										.trim()
										.split(/\s+/)
										.filter((w) => w.length > 0).length
								}{" "}
								words
							</span>
							<span>{prompt.query.length.toLocaleString()} characters</span>
						</div>
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
