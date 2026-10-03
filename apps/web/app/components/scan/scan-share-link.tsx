"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@opencited/ui";
import { publicScanResultPath } from "@/app/lib/scan-result-path";

export function ScanShareLink({ scanId }: { scanId: string }) {
	const [copied, setCopied] = useState(false);
	const path = publicScanResultPath(scanId);
	const [displayUrl, setDisplayUrl] = useState(path);

	useEffect(() => {
		setDisplayUrl(`${window.location.origin}${path}`);
	}, [path]);

	async function handleCopy() {
		const url = `${window.location.origin}${path}`;
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	}

	return (
		<div className="w-full space-y-2">
			<p className="text-xs font-medium text-foreground">Share this result</p>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
				<Link
					href={path}
					className="flex min-h-9 min-w-0 flex-1 items-center rounded-md border border-input bg-background px-3 font-mono text-xs text-muted-foreground underline-offset-4 hover:underline"
				>
					<span className="truncate">{displayUrl}</span>
				</Link>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="shrink-0 sm:min-w-[6.5rem]"
					onClick={() => void handleCopy()}
				>
					{copied ? "Copied" : "Copy link"}
				</Button>
			</div>
		</div>
	);
}
