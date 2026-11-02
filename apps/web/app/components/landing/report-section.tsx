import {
	CitationsIcon,
	CompetitorsIcon,
	InsightsIcon,
	MentionsIcon,
	ScoreIcon,
} from "./hairline-icons";
import { Card } from "@opencited/ui";
import { SCORE_SPEC_URL } from "./landing-links";
import {
	Eyebrow,
	LandingContainer,
	LandingSection,
	SectionHeading,
} from "./landing-section";
import { AnswerStage } from "./scenes/landing-stages";

const FEATURES = [
	{
		icon: MentionsIcon,
		title: "Mentions",
		body: "Whether each answer names your brand, and in what context.",
	},
	{
		icon: CitationsIcon,
		title: "Citations",
		body: "Which sources each engine links to, and whether any of them are your pages.",
	},
	{
		icon: CompetitorsIcon,
		title: "Competitors",
		body: "Who gets recommended next to you, or instead of you.",
	},
	{
		icon: InsightsIcon,
		title: "Insights",
		body: "Plain-language notes on where you're showing up and where you're missing.",
	},
	{
		icon: ScoreIcon,
		title: "AI Visibility Score",
		body: "One 0–100 number, peer-relative to the competitors you track and tracked over time, with the formula in the open.",
	},
] as const;

export function ReportSection() {
	return (
		<LandingSection id="report">
			<LandingContainer>
				<Eyebrow>What's in the report</Eyebrow>
				<SectionHeading>
					Every answer, broken down into what matters.
				</SectionHeading>

				<div className="mt-9 grid items-center gap-10 md:mt-14 lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-12 xl:grid-cols-[minmax(0,620px)_1fr] xl:gap-16">
					<AnswerStage
						label="Line drawing: one AI answer is highlighted for brand mentions, cited sources and competitors, then folds into a single report row with a sample score change. Sample data."
						caption="Sample row: Acme is named and cited once; Northwind and Globex appear as alternatives. Sample data."
						stageClassName="mx-auto aspect-[345/418] max-w-[345px] sm:max-w-[440px] xl:aspect-[620/346] xl:max-w-[620px]"
					/>

					<div>
						<ul>
							{FEATURES.map((feature) => {
								const Icon = feature.icon;
								return (
									<li
										key={feature.title}
										className="grid grid-cols-[44px_1fr] items-start gap-3.5 border-b border-marketing-rule py-3.5 last:border-b-0"
									>
										<Card
											variant="marketing"
											className="grid size-11 place-items-center rounded-xl p-0"
										>
											<Icon />
										</Card>
										<div>
											<h3 className="mt-0.5 text-base font-semibold leading-snug tracking-[-0.01em] text-marketing-ink">
												{feature.title}
											</h3>
											<p className="mt-0.5 text-[14.5px] leading-[1.55] text-marketing-muted">
												{feature.body}
											</p>
										</div>
									</li>
								);
							})}
						</ul>
						<a
							href={SCORE_SPEC_URL}
							target="_blank"
							rel="noreferrer"
							className="mt-5 inline-flex items-center gap-1.5 py-3 text-sm font-semibold text-marketing-accent-strong transition-colors hover:text-marketing-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-accent focus-visible:ring-offset-2 focus-visible:ring-offset-marketing-paper"
						>
							How the score works <span aria-hidden="true">→</span>
						</a>
					</div>
				</div>
			</LandingContainer>
		</LandingSection>
	);
}
