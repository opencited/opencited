"use client";

import {
	buttonVariants,
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@opencited/ui";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useSignedIn } from "./landing-auth";
import {
	DASHBOARD_URL,
	getStartedUrl,
	LANDING_NAV_LINKS,
	SIGN_IN_URL,
} from "./landing-links";

/**
 * Below 860px the middle nav links move behind this menu.
 * Radix Dialog (Sheet) gives us focus trapping, Escape-to-close and a backdrop.
 */
export function MobileNav() {
	const signedIn = useSignedIn();

	return (
		<Sheet>
			<SheetTrigger
				aria-label="Open menu"
				className={cn(
					buttonVariants({ variant: "ghost", size: "icon" }),
					"relative min-[860px]:hidden before:absolute before:-inset-1 before:content-[''] focus-visible:ring-2 focus-visible:ring-marketing-accent focus-visible:ring-offset-2 focus-visible:ring-offset-marketing-paper",
				)}
			>
				<Menu aria-hidden="true" />
			</SheetTrigger>
			<SheetContent
				side="right"
				data-theme="light"
				style={{ colorScheme: "light" }}
				className="w-[19rem] [&>button]:size-11 [&>button]:grid [&>button]:place-items-center"
			>
				<SheetHeader>
					<SheetTitle className="sr-only">OpenCited menu</SheetTitle>
					<SheetDescription className="sr-only">
						Landing page sections and account links.
					</SheetDescription>
				</SheetHeader>
				<nav aria-label="Landing sections" className="mt-12 flex flex-col">
					{LANDING_NAV_LINKS.map((link) => (
						<SheetClose asChild key={link.href}>
							<Link
								href={link.href}
								className="rounded-md px-3 py-3 text-base font-medium text-marketing-muted transition-colors hover:bg-secondary hover:text-marketing-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-accent"
							>
								{link.label}
							</Link>
						</SheetClose>
					))}
				</nav>
				<div className="mt-6 flex flex-col gap-2 border-t border-marketing-rule pt-6">
					<SheetClose asChild>
						<Link
							href={signedIn ? DASHBOARD_URL : SIGN_IN_URL}
							className={cn(
								buttonVariants({
									variant: "outline",
									size: "marketing",
								}),
								"w-full",
							)}
						>
							{signedIn ? "Dashboard" : "Sign in"}
						</Link>
					</SheetClose>
					<SheetClose asChild>
						<Link
							href={getStartedUrl(signedIn)}
							className={cn(buttonVariants({ size: "marketing" }), "w-full")}
						>
							Get started
						</Link>
					</SheetClose>
				</div>
			</SheetContent>
		</Sheet>
	);
}
