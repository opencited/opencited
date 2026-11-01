import { FOUNDER_NOTE } from "./founder-note-content";
import { LandingContainer, LandingSection } from "./landing-section";

export function FounderNote() {
	return (
		<LandingSection>
			<LandingContainer>
				<figure className="relative mx-auto max-w-[760px] rounded-[22px] border border-marketing-rule bg-white px-6 pb-7 pt-9 md:px-12 md:pb-10 md:pt-11">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(400px_120px_at_20%_0%,rgba(16,185,129,0.10),transparent_70%)]"
					/>
					<div
						aria-hidden="true"
						className="absolute -top-[18px] left-6 grid size-9 place-items-center rounded-full border border-marketing-rule bg-marketing-paper md:left-11"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							aria-hidden="true"
						>
							<path
								d="M3 9.5c0-3 1.5-4.8 4-5.5M3 9.5h3v3.5H3zM9 9.5c0-3 1.5-4.8 4-5.5M9 9.5h3v3.5H9z"
								stroke="#059669"
								strokeWidth="1.25"
								strokeLinejoin="round"
							/>
						</svg>
					</div>

					<blockquote className="relative">
						<p className="text-[17px] leading-[1.65] text-marketing-ink-soft md:text-[18px]">
							{FOUNDER_NOTE.body}
						</p>
					</blockquote>

					<figcaption className="relative mt-7 flex items-center gap-3 border-t border-marketing-rule pt-5">
						<span
							aria-hidden="true"
							className="grid size-10 shrink-0 place-items-center rounded-full landing-hairline border-marketing-ink-soft text-[13px] font-semibold tracking-[0.02em] text-marketing-ink"
						>
							{FOUNDER_NOTE.initials}
						</span>
						<span>
							<span className="block text-[15px] font-semibold leading-tight text-marketing-ink">
								{FOUNDER_NOTE.name}
							</span>
							<span className="text-[13.5px] text-marketing-soft">
								{FOUNDER_NOTE.title}
							</span>
						</span>
					</figcaption>
				</figure>
			</LandingContainer>
		</LandingSection>
	);
}
