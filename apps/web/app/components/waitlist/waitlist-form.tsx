"use client";

import { useState } from "react";
import { joinWaitlist } from "@/app/actions/waitlist";

type Status = "idle" | "loading" | "success" | "error";

const inputStyles = `
	transition-all duration-200 ease-out-quart
	focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2
`;

const buttonBaseStyles = `
	transition-all duration-150 ease-out-quart
	hover:scale-[1.02] active:scale-[0.97]
`;

export function WaitlistForm() {
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState("");

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setStatus("loading");
		setError("");

		const result = await joinWaitlist(email);

		if (result && "error" in result && typeof result.error === "string") {
			setStatus("error");
			setError(result.error);
		} else {
			setStatus("success");
		}
	}

	if (status === "success") {
		return (
			<div className="flex items-center justify-center gap-3 animate-fade-up">
				<svg
					width="20"
					height="20"
					viewBox="0 0 20 20"
					fill="none"
					role="img"
					aria-label="Success checkmark"
					className="text-primary animate-scale-in"
					style={{ animationDelay: "0ms" }}
				>
					<circle
						cx="10"
						cy="10"
						r="9"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path
						d="M6.5 10.5L9 13L13.5 8"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="animate-check-draw"
						style={{
							strokeDasharray: 24,
							strokeDashoffset: 24,
							animationDelay: "150ms",
						}}
					/>
				</svg>
				<p className="text-sm text-muted-foreground">
					You&apos;re on the list. We&apos;ll email you when we launch.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2 max-w-sm mx-auto">
			{status === "error" && error && (
				<p className="text-xs text-destructive animate-fade-up">{error}</p>
			)}
			<form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
				<input
					type="email"
					id="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="you@example.com"
					autoComplete="email"
					required
					disabled={status === "loading"}
					className={`flex-1 h-9 rounded border border-input bg-background px-3 text-sm shadow-sm ${inputStyles} disabled:cursor-not-allowed disabled:opacity-50`}
					style={{
						transition:
							"border-color 200ms, box-shadow 200ms, background-color 200ms",
					}}
				/>
				<button
					type="submit"
					disabled={status === "loading"}
					className={`h-9 px-4 py-2 rounded text-sm font-medium bg-primary text-primary-foreground shadow-sm ${buttonBaseStyles} disabled:pointer-events-none disabled:opacity-50 shrink-0`}
					style={{
						transition:
							"background-color 150ms, transform 150ms, box-shadow 150ms",
					}}
				>
					<span
						style={{
							display: "inline-block",
							animation:
								status === "loading"
									? "pulse-subtle 1.2s ease-in-out infinite"
									: "none",
						}}
					>
						{status === "loading" ? "Joining..." : "Join Waitlist"}
					</span>
				</button>
			</form>
		</div>
	);
}
