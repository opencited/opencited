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
				className="min-h-screen overflow-x-clip bg-marketing-paper text-marketing-ink"
			>
				<LandingNav />
				<main>
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
