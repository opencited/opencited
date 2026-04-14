import { Waitlist } from "@clerk/nextjs";

export default function Home() {
	return (
		<div className="min-h-screen flex flex-col">
			<main className="flex-1 flex items-center justify-center px-6">
				<div className="max-w-xl text-center space-y-8">
					<div className="space-y-4">
						<h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
							OpenCide
						</h1>
						<p className="text-lg text-muted-foreground">
							Open source AEO tool to analyze and optimize your website&apos;s
							Answer Engine Optimization
						</p>
					</div>
					<div className="flex items-center justify-center">
						<Waitlist />
					</div>
				</div>
			</main>

			<footer className="py-6 text-center text-sm text-muted-foreground">
				<p>OpenCide — Built for developers, by developers</p>
			</footer>
		</div>
	);
}
