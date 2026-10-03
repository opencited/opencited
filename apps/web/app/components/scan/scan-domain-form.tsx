"use client";

import { useEffect, useRef } from "react";
import { Button, Input, Kbd, Label, Spinner } from "@opencited/ui";
import {
	isValidScanDomainInput,
	normalizeScanDomainDisplay,
} from "@/app/lib/scan-domain-input";
import { SCAN_DOMAIN_PLACEHOLDERS } from "@/app/lib/scan-domain-placeholders";
import { useRotatingLine } from "./use-rotating-line";

interface ScanDomainFormProps {
	domainInput: string;
	onDomainInputChange: (value: string) => void;
	onSubmit: (event: React.FormEvent) => void;
	isFetching: boolean;
	formError: string | null;
	autoFocus?: boolean;
}

export function ScanDomainForm({
	domainInput,
	onDomainInputChange,
	onSubmit,
	isFetching,
	formError,
	autoFocus = true,
}: ScanDomainFormProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const placeholder = useRotatingLine(SCAN_DOMAIN_PLACEHOLDERS, 3600);

	const domainTrimmed = domainInput.trim();
	const showScanButton = domainTrimmed.length > 0 || isFetching;
	const domainInputValid = isValidScanDomainInput(domainInput);
	const normalizedDomain = normalizeScanDomainDisplay(domainInput);

	useEffect(() => {
		if (!autoFocus) {
			return;
		}
		const node = inputRef.current;
		if (!node) {
			return;
		}
		const id = window.requestAnimationFrame(() => {
			node.focus();
		});
		return () => window.cancelAnimationFrame(id);
	}, [autoFocus]);

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			const submitChord =
				event.key === "Enter" && (event.metaKey || event.ctrlKey);
			if (!submitChord) {
				return;
			}
			const target = event.target;
			if (
				target instanceof HTMLElement &&
				target !== inputRef.current &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable)
			) {
				return;
			}
			if (!domainInputValid || isFetching) {
				return;
			}
			event.preventDefault();
			inputRef.current?.form?.requestSubmit();
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [domainInputValid, isFetching]);

	return (
		<div className="scan-workbench space-y-2">
			<form
				onSubmit={onSubmit}
				aria-busy={isFetching}
				className="flex flex-col gap-2 sm:flex-row"
			>
				<Label htmlFor="scan-domain" className="sr-only">
					Domain to scan
				</Label>
				<Input
					ref={inputRef}
					type="text"
					id="scan-domain"
					inputMode="url"
					autoComplete="url"
					autoCapitalize="none"
					spellCheck={false}
					placeholder={placeholder}
					value={domainInput}
					onChange={(event) => onDomainInputChange(event.target.value)}
					className="font-mono sm:flex-1"
					disabled={isFetching}
					aria-invalid={formError ? true : undefined}
					aria-describedby={
						formError
							? "scan-domain-error scan-domain-hint"
							: "scan-domain-hint"
					}
				/>
				{showScanButton ? (
					<Button
						type="submit"
						className="shrink-0 animate-scan-action-in"
						disabled={isFetching || !domainInputValid}
					>
						{isFetching ? (
							<>
								<Spinner className="h-4 w-4" />
								Scanning…
							</>
						) : (
							"Scan"
						)}
					</Button>
				) : null}
			</form>
			<div
				id="scan-domain-hint"
				className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground"
			>
				<span>
					{normalizedDomain ? (
						<>
							Will scan{" "}
							<span className="font-mono text-foreground">
								{normalizedDomain}
							</span>
						</>
					) : (
						"Paste a domain or URL"
					)}
				</span>
				<span className="inline-flex items-center gap-1.5">
					<Kbd className="hidden sm:inline">⌘</Kbd>
					<Kbd className="sm:hidden">Ctrl</Kbd>
					<Kbd>↵</Kbd>
					<span>to scan</span>
				</span>
			</div>
			{formError ? (
				<p
					id="scan-domain-error"
					role="alert"
					className="text-xs text-destructive"
				>
					{formError}
				</p>
			) : null}
		</div>
	);
}
