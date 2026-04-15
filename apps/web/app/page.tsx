import Link from "next/link";
import { BrandNameLink } from "./components/brand-name";

export default function Home() {
	return (
		<div className="min-h-screen flex flex-col">
			<main className="flex-1 flex items-center justify-center px-6">
				<div className="max-w-xl text-center space-y-8">
					<div className="space-y-4">
						<BrandNameLink className="text-xl lg:text-4xl" />
						<p className="text-lg font-light text-muted-foreground">
							Open source AEO tool to analyze and optimize your website&apos;s
							Answer Engine Optimization
						</p>
					</div>
					<Link
						href="/app/dashboard"
						className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
					>
						Go to the App
					</Link>
				</div>
			</main>

			<footer className="py-6 text-center text-sm text-muted-foreground">
				<p>OpenCited — Built for developers, by developers</p>
			</footer>
		</div>
	);
}
