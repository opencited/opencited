import { BrandNameLink } from "./components/brand-name";
import { WaitlistForm } from "./components/waitlist/waitlist-form";
import "./components/animations.css";

export default function Home() {
	return (
		<div className="min-h-screen flex flex-col">
			<main className="flex-1 flex items-center justify-center px-6">
				<div className="max-w-xl text-center space-y-8">
					<div className="space-y-4">
						<div
							className="animate-fade-up"
							style={{ "--i": 0 } as React.CSSProperties}
						>
							<BrandNameLink className="text-2xl lg:text-4xl" />
						</div>
						<p
							className="text-base text-muted-foreground leading-relaxed max-w-[800px] mx-auto animate-fade-up"
							style={{ "--i": 1 } as React.CSSProperties}
						>
							Open source Answer Engine Optimization (AEO) tool to analyze and
							optimize your website&apos;s visibility in AI answer engines
						</p>
					</div>
					<div
						className="animate-fade-up"
						style={{ "--i": 2 } as React.CSSProperties}
					>
						<WaitlistForm />
					</div>
				</div>
			</main>

			<footer
				className="py-6 text-center text-xs text-muted-foreground animate-fade-up"
				style={{ "--i": 4 } as React.CSSProperties}
			>
				<p>OpenCited — Built for developers</p>
			</footer>
		</div>
	);
}
