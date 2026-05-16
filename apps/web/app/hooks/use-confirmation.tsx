"use client";

import { type ReactNode, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@opencited/ui";
import { Button } from "@opencited/ui";

interface ConfirmationConfig {
	title: string;
	description?: string;
	content?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: "default" | "destructive";
}

interface PendingConfirmation {
	config: ConfirmationConfig;
	resolve: (value: boolean) => void;
}

export function useConfirmation() {
	const [pending, setPending] = useState<PendingConfirmation | null>(null);
	const pendingRef = useRef<PendingConfirmation | null>(null);

	const confirm = useCallback(
		(config: ConfirmationConfig): Promise<boolean> => {
			return new Promise<boolean>((resolve) => {
				const confirmation: PendingConfirmation = { config, resolve };
				pendingRef.current = confirmation;
				setPending(confirmation);
			});
		},
		[],
	);

	const handleConfirm = useCallback(() => {
		pendingRef.current?.resolve(true);
		pendingRef.current = null;
		setPending(null);
	}, []);

	const handleCancel = useCallback(() => {
		pendingRef.current?.resolve(false);
		pendingRef.current = null;
		setPending(null);
	}, []);

	const dialog = pending
		? createPortal(
				<Dialog open={true} onOpenChange={(open) => !open && handleCancel()}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>{pending.config.title}</DialogTitle>
							{pending.config.description && (
								<DialogDescription>
									{pending.config.description}
								</DialogDescription>
							)}
						</DialogHeader>
						{pending.config.content}
						<DialogFooter>
							<Button
								variant="outline"
								onClick={(e) => {
									e.stopPropagation();
									handleCancel();
								}}
							>
								{pending.config.cancelLabel || "Cancel"}
							</Button>
							<Button
								variant={pending.config.variant || "default"}
								onClick={(e) => {
									e.stopPropagation();
									handleConfirm();
								}}
							>
								{pending.config.confirmLabel || "Confirm"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>,
				document.body,
			)
		: null;

	return { confirm, dialog };
}
