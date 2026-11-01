"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { buttonVariants } from "@opencited/ui";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";
import { DASHBOARD_URL, getStartedUrl, SIGN_IN_URL } from "./landing-links";

/**
 * Client-side Clerk state for the static landing page.
 *
 * The homepage must stay statically rendered, so the session is read in the
 * browser. Both links render the same text and size before Clerk loads; only
 * the href (and the account label) change, so there is no layout shift.
 */
export function LandingAuthProvider({ children }: { children: ReactNode }) {
	return <ClerkProvider>{children}</ClerkProvider>;
}

export function useSignedIn(): boolean {
	const { isLoaded, isSignedIn } = useAuth();
	return isLoaded && isSignedIn === true;
}

type MarketingButtonSize = "marketing" | "marketing-sm";

export function GetStartedLink({
	size = "marketing",
	className,
	children,
}: {
	size?: MarketingButtonSize;
	className?: string;
	children?: ReactNode;
}) {
	const signedIn = useSignedIn();

	return (
		<Link
			href={getStartedUrl(signedIn)}
			className={cn(buttonVariants({ size }), className)}
		>
			{children ?? "Get started"}
		</Link>
	);
}

/**
 * "Sign in" for visitors, "Dashboard" for signed-in users. The min width
 * reserves room for the longer label so the nav never shifts.
 */
export function AccountLink({
	size = "marketing-sm",
	className,
}: {
	size?: MarketingButtonSize;
	className?: string;
}) {
	const signedIn = useSignedIn();

	return (
		<Link
			href={signedIn ? DASHBOARD_URL : SIGN_IN_URL}
			className={cn(
				buttonVariants({ variant: "outline", size }),
				"min-w-24",
				className,
			)}
		>
			{signedIn ? "Dashboard" : "Sign in"}
		</Link>
	);
}
