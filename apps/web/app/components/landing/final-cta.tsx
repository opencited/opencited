import { Button } from "@opencited/ui";
import Link from "next/link";
import { FinalMotif } from "./hairline-icons";
import { getStartedUrl } from "./landing-links";
import { LandingContainer, LandingSection } from "./landing-section";

export function FinalCta({ signedIn }: { signedIn: boolean }) {
	return (
		<LandingSection className="relative isolate overflow-hidden pb-20 pt-16 text-center md:pb-28 md:pt-24">
			<div
				aria-hidden="true"
				className="landing-dot-grid pointer-events-none absolute inset-0 -z-10"
			/>

			<LandingContainer>
				<h2 className="mx-auto text-balance text-[clamp(30px,4vw,46px)] font-bold leading-[1.08] tracking-[-0.03em] text-marketing-ink">
					See what AI tells
					<br className="hidden md:inline" /> your buyers{" "}
					<span className="whitespace-nowrap text-marketing-accent">
						about you.
					</span>
				</h2>
				<p className="mx-auto mt-3.5 max-w-[560px] text-[17px] leading-relaxed text-marketing-muted">
					Add your buyer questions and get your first report from ChatGPT and
					Perplexity.
				</p>

				<div className="mt-6">
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
				</div>

				<p className="mt-3.5 inline-flex items-center gap-1.5 font-mono text-xs leading-none tracking-[0.04em] text-marketing-soft">
					<span
						aria-hidden="true"
						className="size-1.5 rounded-full bg-marketing-accent-glow ring-[3px] ring-marketing-accent-highlight"
					/>
					Free during beta
				</p>

				<FinalMotif />
			</LandingContainer>
		</LandingSection>
	);
}
