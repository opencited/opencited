"use client";

import { Button, Card, CardContent } from "@opencited/ui";
import { Search } from "lucide-react";
import Link from "next/link";

export function EmptyState() {
	return (
		<Card variant="dashed">
			<CardContent className="py-16 text-center">
				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
					<Search className="h-6 w-6 text-muted-foreground" />
				</div>
				<h3 className="text-lg font-semibold mb-2">
					No AI visibility data yet
				</h3>
				<p className="text-muted-foreground max-w-md mx-auto mb-6">
					Run your first prompt to see where your brand appears in AI answers.
				</p>
				<Button asChild>
					<Link href="/app/prompts">Create a Prompt</Link>
				</Button>
			</CardContent>
		</Card>
	);
}
