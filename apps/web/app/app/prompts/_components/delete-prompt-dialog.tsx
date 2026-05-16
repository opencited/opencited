"use client";

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
	Spinner,
} from "@opencited/ui";

interface DeletePromptDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	promptId: string;
	promptQuery: string;
	domainProjectId: string;
	onSuccess: () => void;
}

export function DeletePromptDialog({
	open,
	onOpenChange,
	promptId,
	promptQuery,
	domainProjectId,
	onSuccess,
}: DeletePromptDialogProps) {
	const trpc = useTRPC();

	const deleteMutation = useMutation(
		trpc.promptQuery.delete.mutationOptions({
			onSuccess: () => {
				onSuccess();
				onOpenChange(false);
			},
		}),
	);

	const handleDelete = () => {
		deleteMutation.mutate({ id: promptId, domainProjectId });
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete Prompt</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete this prompt? This action cannot be
						undone.
					</DialogDescription>
				</DialogHeader>

				<div className="py-4">
					<p className="text-sm text-muted-foreground max-h-[40vh] overflow-y-auto bg-muted p-3 rounded">
						{promptQuery}
					</p>
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={deleteMutation.isPending}
					>
						{deleteMutation.isPending ? (
							<>
								<Spinner className="mr-2" />
								Deleting...
							</>
						) : (
							"Delete"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
