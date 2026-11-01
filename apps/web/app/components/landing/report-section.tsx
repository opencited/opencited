import {
	CitationsIcon,
	CompetitorsIcon,
	InsightsIcon,
	MentionsIcon,
	ScoreIcon,
} from "./hairline-icons";
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
		body: "One number for how visible you are across your questions and engines, tracked over time.",
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

				<div className="mt-9 grid items-center gap-10 md:mt-14 lg:grid-cols-[minmax(0,620px)_1fr] lg:gap-16">
					<AnswerStage
						label="Line drawing: one AI answer is highlighted for brand mentions, cited sources and competitors, then folds into a single report row with a sample score change. Sample data."
						caption="Illustrative example · made-up brand and competitors · sample data"
						stageClassName="mx-auto aspect-[620/346] max-w-[620px] max-md:aspect-[345/418] max-md:max-w-[345px]"
					/>

					<ul>
						{FEATURES.map((feature) => {
							const Icon = feature.icon;
							return (
								<li
									key={feature.title}
									className="grid grid-cols-[44px_1fr] items-start gap-3.5 border-b border-marketing-rule py-3.5 last:border-b-0"
								>
									<div className="grid size-11 place-items-center rounded-xl landing-hairline border-marketing-rule bg-white">
										<Icon />
									</div>
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
				</div>
			</LandingContainer>
		</LandingSection>
	);
}
