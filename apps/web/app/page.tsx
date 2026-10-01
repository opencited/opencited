"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { BrandNameLink } from "./components/brand-name";
import { WaitlistForm } from "./components/waitlist/waitlist-form";
import { TRPCReactProvider } from "./_trpc/client";
import "./components/animations.css";

const Scanner = dynamic(() =>
	import("./components/scan/scanner").then((module) => module.Scanner),
);

export default function Home() {
	const [scanCompleted, setScanCompleted] = useState(false);

	return (
		<div className="min-h-screen flex flex-col">
			<TRPCReactProvider devtools={false}>
				<main className="flex-1 flex flex-col items-center justify-center gap-10 px-6 py-12">
					<div className="max-w-xl text-center space-y-4">
						<h1
							className="animate-fade-up"
							style={{ "--i": 0 } as React.CSSProperties}
						>
							<BrandNameLink className="text-2xl lg:text-4xl" />
						</h1>
						<p
							className="text-base text-muted-foreground leading-relaxed max-w-[800px] mx-auto animate-fade-up"
							style={{ "--i": 1 } as React.CSSProperties}
						>
							Open source Answer Engine Optimization (AEO) tool to analyze and
							optimize your website&apos;s visibility in AI answer engines
						</p>
					</div>

					<section
						className="w-full max-w-xl space-y-4 animate-fade-up"
						style={{ "--i": 2 } as React.CSSProperties}
					>
						<div className="text-center space-y-1">
							<h2 className="text-lg font-semibold">
								Check your site&apos;s AI readiness
							</h2>
							<p className="text-sm text-muted-foreground">
								Free technical scan — score, readiness level, and top 3 issues.
								No signup.
							</p>
						</div>
						<Scanner onSuccess={() => setScanCompleted(true)} />
					</section>

					{!scanCompleted && (
						<section
							className="w-full max-w-xl text-center space-y-3 animate-fade-up"
							style={{ "--i": 3 } as React.CSSProperties}
						>
							<h2 className="text-base font-semibold">Join the waitlist</h2>
							<p className="text-sm text-muted-foreground">
								Be first to use OpenCited when it launches — we&apos;ll email
								you when it&apos;s out.
							</p>
							<WaitlistForm />
						</section>
					)}
				</main>

				<footer
					className="py-6 text-center text-xs text-muted-foreground animate-fade-up"
					style={{ "--i": 4 } as React.CSSProperties}
				>
					<p>OpenCited — Built for developers</p>
				</footer>
			</TRPCReactProvider>
		</div>
	);
}
