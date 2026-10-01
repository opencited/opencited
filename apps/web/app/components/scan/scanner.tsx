"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Button,
	Card,
	CardContent,
	Input,
	Label,
	Skeleton,
	Spinner,
} from "@opencited/ui";
import { useTRPC } from "@/app/_trpc/client";
import { QueryCell } from "@/app/components/query-cell";
import { scanErrorMessage } from "@/app/lib/scan-display";
import { ScanResult } from "./scan-result";

interface ScannerProps {
	onSuccess?: () => void;
}

export function Scanner({ onSuccess }: ScannerProps) {
	const trpc = useTRPC();
	const [domainInput, setDomainInput] = useState("");
	const [submittedDomain, setSubmittedDomain] = useState<string | null>(null);
	const [formError, setFormError] = useState("");

	const scanQuery = useQuery({
		...trpc.scan.run.queryOptions({ domain: submittedDomain ?? "" }),
		enabled: submittedDomain !== null,
		retry: false,
	});

	useEffect(() => {
		if (scanQuery.isSuccess) {
			onSuccess?.();
		}
	}, [scanQuery.isSuccess, onSuccess]);

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (scanQuery.isFetching) {
			return;
		}
		const domain = domainInput.trim();
		if (!domain) {
			setFormError("Enter a domain to scan.");
			return;
		}
		setFormError("");
		setSubmittedDomain(domain);
	}

	return (
		<div className="space-y-4">
			<form
				onSubmit={handleSubmit}
				aria-busy={scanQuery.isFetching}
				className="flex flex-col gap-2 sm:flex-row"
			>
				<Label htmlFor="scan-domain" className="sr-only">
					Domain to scan
				</Label>
				<Input
					type="text"
					id="scan-domain"
					inputMode="url"
					autoComplete="url"
					autoCapitalize="none"
					spellCheck={false}
					placeholder="example.com"
					value={domainInput}
					onChange={(event) => setDomainInput(event.target.value)}
					className="sm:flex-1"
				/>
				<Button type="submit" className="shrink-0">
					{scanQuery.isFetching ? (
						<>
							<Spinner className="h-4 w-4" />
							Scanning…
						</>
					) : (
						"Scan"
					)}
				</Button>
			</form>

			{formError && (
				<p role="alert" className="text-xs text-destructive">
					{formError}
				</p>
			)}

			{submittedDomain !== null && (
				<QueryCell
					query={scanQuery}
					loading={<ScanLoading domain={submittedDomain} />}
					error={(error) => (
						<ScanFailed
							message={scanErrorMessage(
								error instanceof Error ? error.message : undefined,
							)}
						/>
					)}
					success={(result) => <ScanResult result={result} />}
				/>
			)}
		</div>
	);
}

function ScanLoading({ domain }: { domain: string }) {
	return (
		<Card>
			<CardContent className="space-y-4">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Spinner className="h-4 w-4" />
					<span className="break-words">
						Scanning <span className="font-mono">{domain}</span> — robots.txt,
						sitemap, HTTPS, structured data…
					</span>
				</div>
				<div className="flex items-center gap-4 sm:gap-6">
					<Skeleton className="h-[132px] w-[132px] shrink-0 rounded-full" />
					<div className="w-full space-y-2">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-6 w-32" />
						<Skeleton className="h-4 w-40" />
					</div>
				</div>
				<div className="space-y-2">
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
				</div>
			</CardContent>
		</Card>
	);
}

function ScanFailed({ message }: { message: string }) {
	return (
		<Card>
			<CardContent className="space-y-1 text-center" role="alert">
				<p className="text-sm font-medium">Scan failed</p>
				<p className="text-sm break-words text-muted-foreground">{message}</p>
			</CardContent>
		</Card>
	);
}
