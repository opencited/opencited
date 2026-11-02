import { BrandNameLink } from "../brand-name";
import { GITHUB_REPOSITORY_URL } from "./landing-links";
import { LandingContainer } from "./landing-section";

export function LandingFooter() {
	return (
		<footer className="border-t border-marketing-rule py-8 md:py-10">
			<LandingContainer className="flex flex-col gap-5 text-sm text-marketing-soft md:flex-row md:items-center md:justify-between">
				<BrandNameLink variant="marketing" />

				<a
					href={GITHUB_REPOSITORY_URL}
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-2 rounded-sm py-3 transition-colors hover:text-marketing-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-accent focus-visible:ring-offset-2"
				>
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
					GitHub
				</a>

				<p className="font-mono text-[11px] leading-relaxed tracking-[0.03em] text-marketing-soft">
					© 2026 OpenCited · Illustrations use sample data and a made-up brand.
				</p>
			</LandingContainer>

			{/* TODO: add Privacy and Terms links once /privacy and /terms pages exist */}
		</footer>
	);
}
