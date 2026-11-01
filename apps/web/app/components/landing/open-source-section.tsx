import { Button } from "@opencited/ui";
import {
	DataStaysYoursIcon,
	OpenSourceIcon,
	RealEnginesIcon,
	SelfHostIcon,
} from "./hairline-icons";
import { GITHUB_REPOSITORY_URL } from "./landing-links";
import {
	Eyebrow,
	LandingContainer,
	LandingSection,
	SectionHeading,
	SectionLead,
} from "./landing-section";

const CARDS = [
	{
		icon: OpenSourceIcon,
		title: "Open source on GitHub",
		body: null,
	},
	{
		icon: SelfHostIcon,
		title: "Self-hostable",
		body: null,
	},
	{
		icon: DataStaysYoursIcon,
		title: "Your data stays yours",
		body: "Your project data is private to your workspace and never sold or shared.",
	},
	{
		icon: RealEnginesIcon,
		title: "Real engines, not simulations",
		body: null,
	},
] as const;

function GitHubMark() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			aria-hidden="true"
			focusable="false"
		>
			<path
				fill="currentColor"
				d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"
			/>
		</svg>
	);
}

export function OpenSourceSection() {
	return (
		<LandingSection id="open-source" className="text-center">
			<LandingContainer>
				<Eyebrow>Open source</Eyebrow>
				<SectionHeading className="mx-auto">
					Built in the open. Checkable by anyone.
				</SectionHeading>
				<SectionLead className="mx-auto">
					Read the code, run it yourself, and see exactly how every answer is
					collected.
				</SectionLead>

				<div className="mt-9 grid grid-cols-2 gap-3 md:mt-14 md:gap-5 lg:grid-cols-4">
					{CARDS.map((card) => {
						const Icon = card.icon;
						return (
							<div
								key={card.title}
								className="flex flex-col items-center rounded-[18px] landing-hairline border-marketing-rule bg-white px-3 pb-5 pt-5 md:px-[22px] md:pb-6 md:pt-6"
							>
								<Icon />
								<h3 className="mt-4 text-sm font-semibold leading-snug tracking-[-0.01em] text-marketing-ink md:text-[15px]">
									{card.title}
								</h3>
								{card.body ? (
									<p className="mt-2 text-[13px] leading-relaxed text-marketing-muted md:text-[13.5px]">
										{card.body}
									</p>
								) : null}
							</div>
						);
					})}
				</div>

				<Button asChild variant="outline" size="marketing" className="mt-9">
					<a href={GITHUB_REPOSITORY_URL} target="_blank" rel="noreferrer">
						<GitHubMark />
						Open source on GitHub
						<span aria-hidden="true" className="text-marketing-accent">
							→
						</span>
					</a>
				</Button>
			</LandingContainer>
		</LandingSection>
	);
}
