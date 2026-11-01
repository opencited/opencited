import { Button } from "@opencited/ui";
import Link from "next/link";
import { getStartedUrl } from "./landing-links";
import { LandingContainer } from "./landing-section";
import { HeroStage } from "./scenes/landing-stages";

export function LandingHero({ signedIn }: { signedIn: boolean }) {
	return (
		<section className="relative isolate overflow-hidden pb-14 pt-10 md:pb-20 md:pt-12">
			<div
				aria-hidden="true"
				className="landing-dot-grid pointer-events-none absolute inset-x-0 -top-16 -z-10 h-[520px]"
			/>
			<div
				aria-hidden="true"
				className="landing-glow pointer-events-none absolute left-1/2 top-[420px] -z-10 h-[360px] w-[900px] -translate-x-1/2 max-md:top-[520px] max-md:h-[600px] max-md:w-[420px]"
			/>

			<LandingContainer>
				<div className="text-center">
					<h1 className="text-balance text-[clamp(36px,5vw,58px)] font-bold leading-[1.03] tracking-[-0.035em] text-marketing-ink">
						See what AI tells
						<br className="hidden md:inline" /> your buyers{" "}
						<span className="whitespace-nowrap text-marketing-accent">
							about you.
						</span>
					</h1>
					<p className="mx-auto mt-4 max-w-[610px] text-[clamp(15.5px,1.5vw,18px)] leading-[1.55] text-marketing-muted">
						OpenCited runs your buyers' questions on ChatGPT and Perplexity and
						shows where you're mentioned, cited, or losing out to competitors.
					</p>

					<div className="mt-6 flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-2">
						<Button
							asChild
							size="marketing"
							className="w-full max-w-[345px] sm:w-auto"
						>
							<Link href={getStartedUrl(signedIn)}>
								Get started
								<span aria-hidden="true" className="text-marketing-accent-glow">
									→
								</span>
							</Link>
						</Button>
						<Button
							asChild
							variant="ghost"
							size="marketing"
							className="w-full max-w-[345px] sm:w-auto"
						>
							<Link href="#preview">
								See a sample report <span aria-hidden="true">↓</span>
							</Link>
						</Button>
					</div>

					<p className="mt-3.5 inline-flex items-center gap-1.5 font-mono text-xs leading-none tracking-[0.04em] text-marketing-soft">
						<span
							aria-hidden="true"
							className="size-1.5 rounded-full bg-marketing-accent-glow ring-[3px] ring-marketing-accent-highlight"
						/>
						Free during beta
					</p>
				</div>

				<HeroStage
					label="Line drawing: one buyer question is sent to ChatGPT and Perplexity, both answers come back with the brand, cited sources and competitors highlighted, and the marks add up into a report with a sample AI Visibility Score. Sample data."
					caption="Illustrative example · made-up brand (Acme CRM) and competitors · sample data"
					stageClassName="mx-auto mt-10 aspect-[1080/400] max-w-[1080px] max-md:aspect-[345/783] max-md:max-w-[345px]"
				/>
			</LandingContainer>
		</section>
	);
}
