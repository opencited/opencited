import { Button } from "@opencited/ui";
import Link from "next/link";
import { BrandNameLink } from "../brand-name";
import {
	DASHBOARD_URL,
	getStartedUrl,
	LANDING_NAV_LINKS,
	SIGN_IN_URL,
} from "./landing-links";
import { MobileNav } from "./mobile-nav";

export function LandingNav({ signedIn }: { signedIn: boolean }) {
	return (
		<header className="sticky top-0 z-30 border-b border-marketing-rule bg-marketing-paper">
			<nav
				aria-label="Main"
				className="mx-auto flex h-16 w-full max-w-[1160px] items-center justify-between gap-3 px-4 md:px-10"
			>
				<BrandNameLink variant="marketing" className="shrink-0" />

				<div className="hidden items-center gap-7 text-[14.5px] text-marketing-muted min-[860px]:flex">
					{LANDING_NAV_LINKS.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="transition-colors hover:text-marketing-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-accent focus-visible:ring-offset-4 focus-visible:ring-offset-marketing-paper"
						>
							{link.label}
						</Link>
					))}
				</div>

				<div className="flex items-center gap-2">
					<Button
						asChild
						variant="outline"
						size="marketing-sm"
						className="hidden sm:inline-flex"
					>
						<Link href={signedIn ? DASHBOARD_URL : SIGN_IN_URL}>
							{signedIn ? "Dashboard" : "Sign in"}
						</Link>
					</Button>
					<Button asChild size="marketing-sm">
						<Link href={getStartedUrl(signedIn)}>Get started</Link>
					</Button>
					<MobileNav signedIn={signedIn} />
				</div>
			</nav>
		</header>
	);
}
