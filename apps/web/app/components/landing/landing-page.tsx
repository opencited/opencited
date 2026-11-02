import "./landing.css";
import { FinalCta } from "./final-cta";
import { FounderNote } from "./founder-note";
import { HowItWorks } from "./how-it-works";
import { LandingAuthProvider } from "./landing-auth";
import { LandingFaq } from "./landing-faq";
import { LandingFooter } from "./landing-footer";
import { LandingHero } from "./landing-hero";
import { LandingNav } from "./landing-nav";
import { OpenSourceSection } from "./open-source-section";
import { ReportPreview } from "./report-preview";
import { ReportSection } from "./report-section";

export function LandingPage() {
	return (
		<LandingAuthProvider>
			<div
				data-theme="light"
				style={{ colorScheme: "light" }}
				className="landing-page relative min-h-screen overflow-x-clip bg-marketing-paper text-marketing-ink"
			>
				<style>{`
					html:has(.landing-page) body {
						background-color: var(--color-marketing-paper);
					}
				`}</style>
				<a
					href="#main"
					className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-marketing-paper focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-marketing-ink focus:ring-2 focus:ring-marketing-accent focus:ring-offset-2 focus:ring-offset-marketing-paper"
				>
					Skip to content
				</a>
				<LandingNav />
				<main id="main" className="scroll-mt-20">
					<LandingHero />
					<HowItWorks />
					<ReportSection />
					<ReportPreview />
					<OpenSourceSection />
					<FounderNote />
					<LandingFaq />
					<FinalCta />
				</main>
				<LandingFooter />
			</div>
		</LandingAuthProvider>
	);
}
