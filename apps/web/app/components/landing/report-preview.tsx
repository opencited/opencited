import {
	Eyebrow,
	LandingContainer,
	LandingSection,
	SectionHeading,
	SectionLead,
} from "./landing-section";
import { ReportGridStage } from "./scenes/landing-stages";

export function ReportPreview() {
	return (
		<LandingSection id="preview" className="text-center">
			<LandingContainer>
				<Eyebrow>Report preview</Eyebrow>
				<SectionHeading className="mx-auto">
					Run every question on every engine without doing it by hand.
				</SectionHeading>
				<SectionLead className="mx-auto">
					See each buyer question against each engine at a glance, then follow
					your AI Visibility Score as the answers change.
				</SectionLead>
			</LandingContainer>

			<LandingContainer className="mt-9 md:mt-14">
				<ReportGridStage
					label="Line drawing: a grid of buyer questions against answer engines fills in as runs finish, then resolves into a sample AI Visibility Score and a trend line. Sample data."
					caption="Sample report · made-up brand (Acme CRM) · sample data, not real results"
					stageClassName="mx-auto aspect-[345/538] max-w-[345px] sm:max-w-[440px] xl:aspect-[1080/400] xl:max-w-[1080px]"
				/>
			</LandingContainer>
		</LandingSection>
	);
}
