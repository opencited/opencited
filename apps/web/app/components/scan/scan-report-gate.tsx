"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Checkbox, Input, Label, Spinner } from "@opencited/ui";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";
import { useTRPC } from "@/app/_trpc/client";

type GateStep = "email" | "code" | "unlocked";
type FullReportData = inferRouterOutputs<AppRouter>["scan"]["verifyReport"];

interface ScanReportGateProps {
	scanId: string;
	domain: string;
	issueCount: number;
	freeIssueCount: number;
	onUnlocked: (report: FullReportData) => void;
}

export function ScanReportGate({
	scanId,
	domain,
	issueCount,
	freeIssueCount,
	onUnlocked,
}: ScanReportGateProps) {
	const trpc = useTRPC();
	const [step, setStep] = useState<GateStep>("email");
	const [email, setEmail] = useState("");
	const [consent, setConsent] = useState(true);
	const [code, setCode] = useState("");
	const [error, setError] = useState("");

	const requestMutation = useMutation(
		trpc.scan.requestReport.mutationOptions({
			onSuccess: () => {
				setError("");
				setStep("code");
			},
			onError: (err) => {
				setError(err.message);
			},
		}),
	);

	const verifyMutation = useMutation(
		trpc.scan.verifyReport.mutationOptions({
			onSuccess: (data) => {
				setError("");
				setStep("unlocked");
				onUnlocked(data);
			},
			onError: (err) => {
				setError(err.message);
			},
		}),
	);

	if (step === "unlocked") {
		return (
			<p className="text-sm text-muted-foreground">
				Full report unlocked. A copy was sent to your email.
			</p>
		);
	}

	const isLoading = requestMutation.isPending || verifyMutation.isPending;

	return (
		<div className="space-y-3">
			{error && (
				<p role="alert" className="text-xs text-destructive">
					{error}
				</p>
			)}

			{step === "email" ? (
				<form
					className="mx-auto flex max-w-sm flex-col gap-3"
					onSubmit={(event) => {
						event.preventDefault();
						requestMutation.mutate({
							scanId,
							email,
							consentToOnChangeUpdates: consent,
						});
					}}
				>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Label htmlFor="report-email" className="sr-only">
							Email address
						</Label>
						<Input
							id="report-email"
							type="email"
							autoComplete="email"
							placeholder="you@example.com"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
							disabled={isLoading}
							className="sm:flex-1"
						/>
						<Button type="submit" disabled={isLoading} className="shrink-0">
							{isLoading ? (
								<>
									<Spinner className="h-4 w-4" />
									Sending…
								</>
							) : (
								"Send code"
							)}
						</Button>
					</div>
					<div className="flex items-start gap-2 text-left">
						<Checkbox
							id="report-consent"
							checked={consent}
							onCheckedChange={(checked) => setConsent(checked === true)}
							disabled={isLoading}
						/>
						<Label
							htmlFor="report-consent"
							className="text-sm font-normal leading-snug text-muted-foreground"
						>
							Email me when this site&apos;s scan changes
						</Label>
					</div>
				</form>
			) : (
				<form
					className="mx-auto flex max-w-sm flex-col gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						verifyMutation.mutate({ scanId, email, code });
					}}
				>
					<p className="text-sm text-muted-foreground">
						We sent a 6-digit code to{" "}
						<span className="font-mono text-foreground">{email}</span>. It
						expires in 10 minutes.
					</p>
					<div className="flex flex-col gap-2 sm:flex-row">
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
							value={code}
							onChange={(event) =>
								setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
							}
							required
							disabled={isLoading}
							className="sm:flex-1 font-mono tracking-widest"
						/>
						<Button type="submit" disabled={isLoading} className="shrink-0">
							{isLoading ? (
								<>
									<Spinner className="h-4 w-4" />
									Verifying…
								</>
							) : (
								"Unlock report"
							)}
						</Button>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={isLoading}
						onClick={() => {
							setStep("email");
							setCode("");
							setError("");
						}}
					>
						Use a different email
					</Button>
				</form>
			)}

			<p className="mx-auto max-w-[52ch] text-xs text-muted-foreground">
				{freeIssueCount < issueCount && (
					<>
						{issueCount - freeIssueCount} more{" "}
						{issueCount - freeIssueCount === 1 ? "issue" : "issues"} in the full
						report for {domain}.{" "}
					</>
				)}
				Unlocking joins the OpenCited waitlist — we&apos;ll email you when we
				launch.
			</p>
		</div>
	);
}
