"use server";

function getDomainFromPublishableKey(publishableKey: string): string {
	// Strip the prefix (pk_test_ or pk_live_)
	const base64Part = publishableKey.replace(/^pk_(test|live)_/, "");

	// Base64-decode it (remove trailing $ stop character)
	return atob(base64Part).replace(/\$$/, "");
}

export async function joinWaitlist(email: string) {
	const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
	if (!publishableKey) {
		return { error: "Clerk key not configured" };
	}

	const domain = getDomainFromPublishableKey(publishableKey);
	const url = `https://${domain}/v1/waitlist`;

	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({ email_address: email }),
		});

		if (!res.ok) {
			const text = await res.text();
			let message = "Something went wrong. Please try again.";
			try {
				const json = JSON.parse(text);
				message = json.error?.message ?? message;
			} catch {
				// use default
			}
			return { error: message };
		}

		return { success: true };
	} catch (_error) {
		return { error: "Something went wrong. Please try again." };
	}
}
