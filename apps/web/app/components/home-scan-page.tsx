"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Separator } from "@opencited/ui";
import { BrandNameLink } from "./brand-name";
import { TRPCReactProvider } from "../_trpc/client";
import { HOME_SCAN_FAQ } from "../lib/home-scan-seo";
import "../components/animations.css";

const FAQ_MONO_PATTERN = /(JSON-LD|llms\.txt)/g;

function FaqAnswer({ text }: { text: string }) {
	const parts = text.split(FAQ_MONO_PATTERN);
	return (
		<>
			{parts.map((part, index) =>
				part === "JSON-LD" || part === "llms.txt" ? (
					<span key={index} className="font-mono text-foreground">
						{part}
					</span>
				) : (
					part
				),
			)}
		</>
	);
}

const Scanner = dynamic(() =>
	import("./scan/scanner").then((module) => module.Scanner),
);

const REPO_URL = "https://github.com/opencited/opencited";

export function HomeScanPage() {
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

					<section className="w-full max-w-xl" aria-label="Domain scanner">
						<Scanner
							onScanStart={() => setHeroCompact(true)}
							onScanIdle={() => setHeroCompact(false)}
							onSuccess={() => setHeroCompact(true)}
						/>
					</section>

					<section
						className="w-full max-w-xl text-left"
						aria-labelledby="scan-faq-heading"
					>
						<div className="scan-workbench space-y-5">
							<h2
								id="scan-faq-heading"
								className="text-base font-semibold tracking-tight"
							>
								FAQ
							</h2>
							<Separator />
							<dl className="space-y-6">
								{HOME_SCAN_FAQ.map((item) => (
									<div key={item.question} className="space-y-2">
										<dt className="text-sm font-semibold">{item.question}</dt>
										<dd className="text-sm text-muted-foreground leading-relaxed">
											<FaqAnswer text={item.answer} />
										</dd>
									</div>
								))}
							</dl>
						</div>
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
