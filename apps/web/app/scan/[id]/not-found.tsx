import Link from "next/link";
import type { Metadata } from "next";
import { BrandNameLink } from "@/app/components/brand-name";
import { scanResultRobots } from "@/app/lib/scan-seo";

export const metadata: Metadata = {
	title: "Scan not found",
	robots: scanResultRobots,
};

export default function ScanResultNotFound() {
	return (
		<div className="min-h-screen flex flex-col">
			<header className="flex justify-center px-6 pt-10">
				<BrandNameLink className="text-lg font-semibold" />
			</header>
			<main className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
				<h1 className="text-xl font-semibold tracking-tight">Scan not found</h1>
				<p className="mt-2 max-w-sm text-sm text-muted-foreground">
					This link may be wrong or expired. Run a new scan to get a fresh
					result.
				</p>
				<Link
					href="/"
					className="mt-6 text-sm underline-offset-4 hover:underline"
				>
					Back to scanner
				</Link>
			</main>
		</div>
	);
}
