"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Checkbox, Input, Label, Spinner } from "@opencited/ui";
import { useTRPC } from "@/app/_trpc/client";
import { QueryCell } from "@/app/components/query-cell";
import { scanErrorMessage } from "@/app/lib/scan-display";
import {
	buildReportEmail,
	emailHostForScanDomain,
} from "@/app/lib/report-email-domain";
import { isValidScanDomainInput } from "@/app/lib/scan-domain-input";
import { readScanUnlock, writeScanUnlock } from "@/app/lib/scan-unlock-storage";
import { SCAN_LOADING_LINES } from "@/app/lib/scan-loading-copy";
import { ScanDomainForm } from "./scan-domain-form";
import { ScanResult, type UnlockState } from "./scan-result";
import { ScanShareLink } from "./scan-share-link";
import { ScanUnlockMark } from "./scan-unlock-mark";
import { useRotatingLine } from "./use-rotating-line";
import { useScanReportGate } from "./use-scan-report-gate";

type FieldPhase = "domain" | "email" | "code";

interface ScannerProps {
	onSuccess?: () => void;
	onScanStart?: () => void;
	onScanIdle?: () => void;
}

export function Scanner({ onSuccess, onScanStart, onScanIdle }: ScannerProps) {
	const trpc = useTRPC();
	const [domainInput, setDomainInput] = useState("");
	const [submittedDomain, setSubmittedDomain] = useState<string | null>(null);
	const [formError, setFormError] = useState("");
	const [fieldPhase, setFieldPhase] = useState<FieldPhase>("domain");
	const [emailLocal, setEmailLocal] = useState("");
	const [scanResultKey, setScanResultKey] = useState(0);
	const [unlock, setUnlock] = useState<UnlockState | null>(null);
	const [activeScanId, setActiveScanId] = useState("");

	const scanQuery = useQuery({
		...trpc.scan.run.queryOptions({ domain: submittedDomain ?? "" }),
		enabled: submittedDomain !== null,
		retry: false,
		refetchOnWindowFocus: false,
	});

	const gate = useScanReportGate({
		scanId: activeScanId,
		reportUnlocked: unlock?.scanId === activeScanId && Boolean(unlock),
		onUnlocked: (report, email) => {
			if (!activeScanId) {
				return;
			}
			const next = { scanId: activeScanId, report, email };
			writeScanUnlock(next);
			setUnlock(next);
		},
	});

	useEffect(() => {
		if (scanQuery.data?.scanId) {
			setActiveScanId(scanQuery.data.scanId);
			const stored = readScanUnlock(scanQuery.data.scanId);
			if (stored) {
				setUnlock(stored);
			}
		}
	}, [scanQuery.data?.scanId]);

	useEffect(() => {
		if (scanQuery.isSuccess) {
			onSuccess?.();
			if (unlock?.scanId !== scanQuery.data?.scanId) {
				setFieldPhase("email");
			}
		}
	}, [scanQuery.isSuccess, scanQuery.data?.scanId, onSuccess, unlock?.scanId]);

	useEffect(() => {
		if (unlock?.scanId === activeScanId) {
			return;
		}
		if (gate.step === "code") {
			setFieldPhase("code");
		} else if (gate.step === "email" && scanQuery.isSuccess) {
			setFieldPhase("email");
		}
	}, [gate.step, scanQuery.isSuccess, unlock?.scanId, activeScanId]);

	function handleDomainSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (scanQuery.isFetching) {
			return;
		}
		const domain = domainInput.trim();
		if (!domain) {
			setFormError("Enter a domain to scan.");
			return;
		}
		if (!isValidScanDomainInput(domain)) {
			setFormError("Enter a valid domain like example.com.");
			return;
		}
		setFormError("");
		gate.reset();
		setEmailLocal("");
		setUnlock(null);
		setFieldPhase("domain");
		onScanStart?.();
		setSubmittedDomain(domain);
		setScanResultKey((k) => k + 1);
	}

	function handleScanAnother() {
		onScanIdle?.();
		setSubmittedDomain(null);
		setDomainInput("");
		setActiveScanId("");
		setUnlock(null);
		setFieldPhase("domain");
		setEmailLocal("");
		gate.reset();
		setFormError("");
	}

	function handleEmailSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!scanQuery.data) {
			return;
		}
		const fullEmail = buildReportEmail(emailLocal, scanQuery.data.domain);
		if (!fullEmail) {
			setFormError("Enter the part before @ in your work email.");
			return;
		}
		setFormError("");
		gate.requestCode(fullEmail);
	}

	function handleCodeSubmit(event: React.FormEvent) {
		event.preventDefault();
		gate.verifyCode();
	}

	const isReportUnlocked = unlock?.scanId === activeScanId;
	const showEmailField =
		fieldPhase === "email" && scanQuery.data && !isReportUnlocked;
	const showCodeField =
		fieldPhase === "code" && scanQuery.data && !isReportUnlocked;
	const displayError =
		(showEmailField || showCodeField) && (formError || gate.error);

	const emailHost = scanQuery.data
		? emailHostForScanDomain(scanQuery.data.domain)
		: "";

	const showDomainForm = fieldPhase === "domain" && !isReportUnlocked;

	const showWorkbench = submittedDomain !== null;

	return (
		<div className={showWorkbench ? "scan-workbench space-y-6" : "space-y-4"}>
			{isReportUnlocked && scanQuery.data ? (
				<div className="animate-fade-in space-y-4">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
						<ScanUnlockMark />
						<span className="text-muted-foreground">
							Verified as{" "}
							<span className="font-mono text-foreground">{unlock?.email}</span>
						</span>
					</div>
					<Badge
						variant="success"
						className="w-fit max-w-full whitespace-normal"
					>
						Full report unlocked — Perplexity results and all issues
					</Badge>
					<ScanShareLink scanId={scanQuery.data.scanId} />
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-full sm:w-auto"
						onClick={handleScanAnother}
					>
						Scan another domain
					</Button>
				</div>
			) : showDomainForm ? (
				<ScanDomainForm
					domainInput={domainInput}
					onDomainInputChange={setDomainInput}
					onSubmit={handleDomainSubmit}
					isFetching={scanQuery.isFetching}
					formError={formError || null}
					autoFocus={submittedDomain === null}
				/>
			) : null}

			{scanQuery.data && submittedDomain !== null && !isReportUnlocked ? (
				<div className="border-t border-border/60 pt-6">
					<ScanShareLink scanId={scanQuery.data.scanId} />
				</div>
			) : null}

			{submittedDomain !== null && (
				<QueryCell
					query={scanQuery}
					loading={<ScanLoading domain={submittedDomain} />}
					error={(error) => (
						<ScanFailed
							message={scanErrorMessage(
								error instanceof Error ? error.message : undefined,
							)}
							onRetry={() => {
								void scanQuery.refetch();
							}}
						/>
					)}
					success={(result) => (
						<div className="animate-scan-result-in">
							<ScanResult
								key={`${result.scanId}-${scanResultKey}`}
								result={result}
								unlock={unlock}
								gate={gate}
							/>
						</div>
					)}
				/>
			)}

			{showEmailField ? (
				<div className="animate-fade-in space-y-3 border-t border-border/60 pt-6">
					<div className="space-y-1">
						<p className="text-sm font-medium">Verify your work email</p>
						<p className="text-xs text-muted-foreground">
							Use an address on this domain. We&apos;ll send a 6-digit code,
							then run the Perplexity check and email the report.
						</p>
					</div>
					<form
						onSubmit={handleEmailSubmit}
						className="flex flex-col gap-2 sm:flex-row sm:items-center"
					>
						<div className="flex min-w-0 flex-1 items-center gap-0 rounded-md border border-input shadow-sm focus-within:ring-1 focus-within:ring-ring">
							<Label htmlFor="report-email-local" className="sr-only">
								Work email at {emailHost}
							</Label>
							<Input
								id="report-email-local"
								type="text"
								autoComplete="username"
								autoCapitalize="none"
								spellCheck={false}
								placeholder="you"
								value={emailLocal}
								onChange={(event) =>
									setEmailLocal(
										event.target.value.replace(/@|\s/g, "").slice(0, 64),
									)
								}
								disabled={gate.isLoading}
								className="border-0 font-mono shadow-none focus-visible:ring-0"
							/>
							<span className="shrink-0 pr-3 font-mono text-sm text-muted-foreground">
								@{emailHost}
							</span>
						</div>
						<Button
							type="submit"
							disabled={gate.isLoading}
							className="shrink-0"
						>
							{gate.isLoading ? (
								<>
									<Spinner className="h-4 w-4" />
									Unlocking…
								</>
							) : (
								"Unlock report"
							)}
						</Button>
					</form>
					<div className="flex items-start gap-2 text-left">
						<Checkbox
							id="report-consent"
							checked={gate.consent}
							onCheckedChange={(checked) => gate.setConsent(checked === true)}
							disabled={gate.isLoading}
						/>
						<Label
							htmlFor="report-consent"
							className="text-sm font-normal leading-snug text-muted-foreground"
						>
							Email me when this scan&apos;s results change
						</Label>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-auto px-0 text-muted-foreground"
						onClick={handleScanAnother}
					>
						Scan another domain
					</Button>
				</div>
			) : null}

			{showCodeField ? (
				<div className="animate-fade-in space-y-3 border-t border-border/60 pt-6">
					<p className="text-sm text-muted-foreground">
						Enter the 6-digit code we sent to{" "}
						<span className="font-mono text-foreground">{gate.email}</span>. It
						expires in 10 minutes.
					</p>
					<form
						onSubmit={handleCodeSubmit}
						className="flex flex-col gap-2 sm:flex-row"
					>
						<Label htmlFor="report-code" className="sr-only">
							Verification code
						</Label>
						<Input
							id="report-code"
							inputMode="numeric"
							autoComplete="one-time-code"
							pattern="\d{6}"
							maxLength={6}
							placeholder="123456"
							value={gate.code}
							onChange={(event) =>
								gate.setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
							}
							required
							disabled={gate.isLoading}
							className="font-mono tracking-widest sm:flex-1"
						/>
						<Button
							type="submit"
							disabled={gate.isLoading}
							className="shrink-0"
						>
							{gate.isLoading ? (
								<>
									<Spinner className="h-4 w-4" />
									Verifying…
								</>
							) : (
								"Unlock report"
							)}
						</Button>
					</form>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-auto px-0 text-muted-foreground"
						disabled={gate.isLoading}
						onClick={() => {
							gate.backToEmail();
							setFieldPhase("email");
						}}
					>
						Use a different email
					</Button>
				</div>
			) : null}

			{displayError ? (
				<p role="alert" className="text-xs text-destructive">
					{displayError}
				</p>
			) : null}
		</div>
	);
}

function ScanLoading({ domain }: { domain: string }) {
	const line = useRotatingLine(SCAN_LOADING_LINES);

	return (
		<div
			className="animate-fade-in space-y-3 border-t border-border/60 pt-6"
			aria-live="polite"
		>
			<div
				className="scan-loading-track h-1 w-full overflow-hidden rounded-full bg-muted"
				role="progressbar"
				aria-label="Scan in progress"
			>
				<div className="scan-loading-bar h-full w-2/5 rounded-full bg-foreground/25" />
			</div>
			<div className="flex items-start gap-2 text-sm text-muted-foreground">
				<Spinner className="mt-0.5 h-4 w-4 shrink-0" />
				<span className="break-words">
					<span className="font-mono text-foreground">{domain}</span>
					<span className="text-muted-foreground"> · </span>
					<span key={line} className="animate-line-swap">
						{line}
					</span>
				</span>
			</div>
		</div>
	);
}

function ScanFailed({
	message,
	onRetry,
}: {
	message: string;
	onRetry: () => void;
}) {
	return (
		<div className="space-y-3 pt-2 text-center" role="alert">
			<div className="space-y-1">
				<p className="text-sm font-medium">Scan failed</p>
				<p className="text-sm break-words text-muted-foreground">{message}</p>
			</div>
			<Button type="button" variant="outline" size="sm" onClick={onRetry}>
				Try again
			</Button>
		</div>
	);
}
