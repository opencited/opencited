"use server";

export async function joinWaitlist(email: string) {
	const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
	if (!publishableKey) {
		return { error: "Clerk key not configured" };
	}

	const url = `https://api.clerk.com/v1/waitlist_entries`;

	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
			},
			body: JSON.stringify({
				email_address: email,
			}),
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
		console.log("\n\n error", _error);
		return { error: "Something went wrong. Please try again." };
	}
}
