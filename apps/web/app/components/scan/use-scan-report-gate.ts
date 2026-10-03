"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";
import { useTRPC } from "@/app/_trpc/client";

export type GateStep = "email" | "code" | "unlocked";
type FullReportData = inferRouterOutputs<AppRouter>["scan"]["verifyReport"];

export function useScanReportGate(params: {
	scanId: string;
	reportUnlocked?: boolean;
	onUnlocked: (report: FullReportData, email: string) => void;
}) {
	const trpc = useTRPC();
	const [step, setStep] = useState<GateStep>(
		params.reportUnlocked ? "unlocked" : "email",
	);
	useEffect(() => {
		if (params.reportUnlocked) {
			setStep("unlocked");
		}
	}, [params.reportUnlocked]);

	const [email, setEmail] = useState("");
	const [consent, setConsent] = useState(false);
	const [code, setCode] = useState("");
	const [error, setError] = useState("");

	const requestMutation = useMutation(
		trpc.scan.requestReport.mutationOptions({
			onSuccess: (data, variables) => {
				setError("");
				const unlockedEmail = variables.email.trim().toLowerCase();
				if (!data.verificationRequired) {
					setStep("unlocked");
					params.onUnlocked(data.report, unlockedEmail);
					return;
				}
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
				params.onUnlocked(data, email);
			},
			onError: (err) => {
				setError(err.message);
			},
		}),
	);

	const isLoading = requestMutation.isPending || verifyMutation.isPending;

	function requestCode(fullEmail: string) {
		setEmail(fullEmail);
		requestMutation.mutate({
			scanId: params.scanId,
			email: fullEmail,
			consentToOnChangeUpdates: consent,
		});
	}

	function verifyCode() {
		verifyMutation.mutate({ scanId: params.scanId, email, code });
	}

	function backToEmail() {
		setStep("email");
		setCode("");
		setError("");
	}

	function reset() {
		setStep("email");
		setEmail("");
		setCode("");
		setError("");
		setConsent(false);
	}

	return {
		step,
		email,
		consent,
		setConsent,
		code,
		setCode,
		error,
		isLoading,
		requestCode,
		verifyCode,
		backToEmail,
		reset,
	};
}
