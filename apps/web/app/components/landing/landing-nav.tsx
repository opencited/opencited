import Link from "next/link";
import { BrandNameLink } from "../brand-name";
import { AccountLink, GetStartedLink } from "./landing-auth";
import { LANDING_NAV_LINKS } from "./landing-links";
import { MobileNav } from "./mobile-nav";

export function LandingNav() {
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
					<AccountLink className="hidden sm:inline-flex" />
					<GetStartedLink size="marketing-sm">Get started</GetStartedLink>
					<MobileNav />
				</div>
			</nav>
		</header>
	);
}
