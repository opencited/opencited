import { env } from "../env";

export async function joinClerkWaitlist(email: string): Promise<void> {
	if (!env.CLERK_SECRET_KEY) {
		return;
	}

	const res = await fetch("https://api.clerk.com/v1/waitlist_entries", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
		},
		body: JSON.stringify({ email_address: email }),
	});

	if (!res.ok) {
		console.warn("Clerk waitlist signup failed", await res.text());
	}
}
