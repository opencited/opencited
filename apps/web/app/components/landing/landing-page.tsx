import "./landing.css";
import { FinalCta } from "./final-cta";
import { FounderNote } from "./founder-note";
import { HowItWorks } from "./how-it-works";
import { LandingFaq } from "./landing-faq";
import { LandingFooter } from "./landing-footer";
import { LandingHero } from "./landing-hero";
import { LandingNav } from "./landing-nav";
import { OpenSourceSection } from "./open-source-section";
import { ReportPreview } from "./report-preview";
import { ReportSection } from "./report-section";

export function LandingPage({ signedIn }: { signedIn: boolean }) {
	return (
		<div
			data-theme="light"
			style={{ colorScheme: "light" }}
			className="min-h-screen overflow-x-clip bg-marketing-paper text-marketing-ink"
		>
			<LandingNav signedIn={signedIn} />
			<main>
				<LandingHero signedIn={signedIn} />
				<HowItWorks />
				<ReportSection />
				<ReportPreview />
				<OpenSourceSection />
				<FounderNote />
				<LandingFaq />
				<FinalCta signedIn={signedIn} />
			</main>
			<LandingFooter />
		</div>
	);
}
