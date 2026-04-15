"use client";

import { useTRPC } from "@/app/_trpc/client";
import { Button } from "@opencited/ui";
import { Input } from "@opencited/ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

export function DomainForm() {
	const trpc = useTRPC();
	const router = useRouter();
	const [domain, setDomain] = useState("");
	const [error, setError] = useState("");

	const mutation = useMutation(
		trpc.domainProject.create.mutationOptions({
			onSuccess: () => {
				router.push("/app/dashboard");
			},
			onError: () => {
				setError("Failed to save domain. Please try again.");
			},
		}),
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
		mutation.mutate({ domain: cleanDomain });
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div>
				<label htmlFor="domain" className="block text-sm font-medium mb-2">
					Website Domain
				</label>
				<Input
					id="domain"
					type="text"
					placeholder="example.com"
					value={domain}
					onChange={(e) => setDomain(e.target.value)}
					required
				/>
				<p className="text-xs text-muted-foreground mt-1">
					Enter your website domain (e.g., example.com)
				</p>
			</div>
			{error && <p className="text-sm text-red-500">{error}</p>}
			<Button type="submit" disabled={mutation.isPending}>
				{mutation.isPending ? "Saving..." : "Continue"}
			</Button>
		</form>
	);
}
