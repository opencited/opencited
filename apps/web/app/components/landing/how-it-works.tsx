import { FanOutIcon, QuestionListIcon, ReportIcon } from "./hairline-icons";
import {
	Eyebrow,
	LandingContainer,
	LandingSection,
	SectionHeading,
} from "./landing-section";

const STEPS = [
	{
		icon: QuestionListIcon,
		title: "Add your buyer questions",
		body: "The questions your buyers really ask, like “best CRM for a small agency”, written in plain words.",
	},
	{
		icon: FanOutIcon,
		title: "We run them on real engines",
		body: "OpenCited asks ChatGPT and Perplexity your questions directly and reads the answers. More engines are coming.",
	},
	{
		icon: ReportIcon,
		title: "Get your report",
		body: "Mentions, citations, competitors, insights and your AI Visibility Score, all in one place.",
	},
] as const;

export function HowItWorks() {
	return (
		<LandingSection id="how">
			<LandingContainer className="text-center">
				<Eyebrow>How it works</Eyebrow>
				<SectionHeading className="mx-auto">
					Three steps. No copy-pasting answers into spreadsheets.
				</SectionHeading>
			</LandingContainer>

			<LandingContainer className="mt-9 md:mt-14">
				<ol className="grid gap-3.5 md:grid-cols-3 md:gap-5">
					{STEPS.map((step, index) => {
						const Icon = step.icon;
						return (
							<li
								key={step.title}
								className="relative rounded-[18px] landing-hairline border-marketing-rule bg-white p-6 md:px-[26px] md:pb-[30px] md:pt-7"
							>
								<span
									aria-hidden="true"
									className="absolute right-6 top-6 font-mono text-[11px] leading-none tracking-[0.08em] text-marketing-soft"
								>
									{String(index + 1).padStart(2, "0")}
								</span>
								{index < STEPS.length - 1 ? (
									<span
										aria-hidden="true"
										className="absolute -right-5 top-14 hidden h-px w-5 bg-marketing-faint md:block"
									/>
								) : null}
								<Icon className="mt-0.5" />
								<h3 className="mt-5 text-[18px] font-semibold leading-snug tracking-[-0.015em] text-marketing-ink">
									{step.title}
								</h3>
								<p className="mt-2 text-[15px] leading-relaxed text-marketing-muted">
									{step.body}
								</p>
							</li>
						);
					})}
				</ol>
			</LandingContainer>
		</LandingSection>
	);
}
