import { LANDING_FAQ } from "@/app/lib/landing-seo";
import {
	Eyebrow,
	LandingContainer,
	LandingSection,
	SectionHeading,
} from "./landing-section";

/**
 * Native `<details>` so the FAQ is keyboard operable and open/close works
 * without shipping JavaScript. The first item is open by default.
 */
export function LandingFaq() {
	return (
		<LandingSection id="faq" className="text-center">
			<LandingContainer>
				<Eyebrow>FAQ</Eyebrow>
				<SectionHeading className="mx-auto">
					Questions, answered.
				</SectionHeading>
			</LandingContainer>

			<LandingContainer className="mt-8 md:mt-12">
				<div className="mx-auto max-w-[800px] text-left">
					{LANDING_FAQ.map((item, index) => (
						<details
							key={item.question}
							name="landing-faq"
							open={index === 0}
							className="group border-b border-marketing-rule first:border-t"
						>
							<summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-[22px] text-base font-semibold leading-snug tracking-[-0.01em] text-marketing-ink transition-colors hover:text-marketing-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-accent focus-visible:ring-offset-2 focus-visible:ring-offset-marketing-paper md:text-[17px] [&::-webkit-details-marker]:hidden">
								<span>{item.question}</span>
								<span
									aria-hidden="true"
									className="relative grid size-[26px] shrink-0 place-items-center rounded-full landing-hairline border-marketing-faint transition-colors group-open:border-marketing-accent"
								>
									<span className="absolute h-[1.25px] w-2.5 bg-marketing-ink-soft" />
									<span className="absolute h-[1.25px] w-2.5 rotate-90 bg-marketing-ink-soft transition-transform duration-200 ease-[var(--ease-out-quart)] group-open:rotate-0" />
								</span>
							</summary>
							<p className="max-w-[65ch] pb-6 pr-10 text-[15.5px] leading-[1.65] text-marketing-muted">
								{item.answer}
							</p>
						</details>
					))}
				</div>
			</LandingContainer>
		</LandingSection>
	);
}
