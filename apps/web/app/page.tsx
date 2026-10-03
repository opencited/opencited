"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { BrandNameLink } from "./components/brand-name";
import { TRPCReactProvider } from "./_trpc/client";
import "./components/animations.css";

const Scanner = dynamic(() =>
	import("./components/scan/scanner").then((module) => module.Scanner),
);

const REPO_URL = "https://github.com/opencited/opencited";

export default function Home() {
	const [heroCompact, setHeroCompact] = useState(false);

	return (
		<div className="min-h-screen flex flex-col overflow-x-clip">
			<TRPCReactProvider devtools={false}>
				<header className="flex justify-center px-6 pt-10">
					<BrandNameLink className="text-lg font-semibold" />
				</header>

				<main
					className={`scan-hero-shell flex-1 flex flex-col items-center px-6 pb-10 pt-10 ${
						heroCompact ? "justify-start gap-6 pt-6" : "justify-center gap-8"
					}`}
				>
					<div
						className="scan-hero-copy max-w-xl text-center space-y-3"
						data-compact={heroCompact ? "true" : "false"}
					>
						<h1
							className="scan-hero-headline text-2xl font-semibold tracking-tight lg:text-3xl animate-fade-up"
							style={{ "--i": 0 } as React.CSSProperties}
						>
							See if answer engines cite your site
						</h1>
						<p
							className="scan-hero-subcopy text-sm text-muted-foreground leading-relaxed max-w-[36rem] mx-auto animate-fade-up"
							style={{ "--i": 1 } as React.CSSProperties}
						>
							Free checklist score and top issues here. Verify a work email on
							your domain for three live Perplexity queries and the full report
							by email.
						</p>
					</div>

					<section
						className={`w-full ${heroCompact ? "max-w-2xl" : "max-w-xl"}`}
						aria-label="Domain scanner"
					>
						<Scanner
							onScanStart={() => setHeroCompact(true)}
							onScanIdle={() => setHeroCompact(false)}
							onSuccess={() => setHeroCompact(true)}
						/>
					</section>
				</main>

				<footer className="py-6 text-center text-xs text-muted-foreground space-y-1">
					<p>OpenCited — MIT · Built for developers</p>
					<p>
						<Link
							href={REPO_URL}
							className="underline-offset-4 hover:underline"
							target="_blank"
							rel="noreferrer"
						>
							View source on GitHub
						</Link>
					</p>
				</footer>
			</TRPCReactProvider>
		</div>
	);
}
