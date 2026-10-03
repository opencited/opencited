import type { Metadata } from "next";
import Link from "next/link";
import { BrandNameLink } from "@/app/components/brand-name";
import { PublicScanResultView } from "@/app/components/scan/public-scan-result-view";
import { loadPublicScanResult } from "@/app/lib/load-public-scan-result";
import { getRequestOrigin } from "@/app/lib/request-origin";
import { scanResultRobots } from "@/app/lib/scan-seo";
import { READINESS_LABELS } from "@/app/lib/scan-display";

type PageProps = {
	params: Promise<{ id: string }>;
};

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { id } = await params;
	const result = await loadPublicScanResult(id);
	const origin = await getRequestOrigin();

	return {
		metadataBase: new URL(origin),
		title: `${result.domain} — ${result.score}/100 scan`,
		description: `Technical readiness for ${result.domain}: ${result.score}/100 (${READINESS_LABELS[result.readiness]}). Top issues from the OpenCited checklist.`,
		robots: scanResultRobots,
	};
}

export default async function PublicScanResultPage({ params }: PageProps) {
	const { id } = await params;
	const result = await loadPublicScanResult(id);

	return (
		<div className="min-h-screen flex flex-col">
			<header className="flex justify-center px-6 pt-10">
				<BrandNameLink className="text-lg font-semibold" />
			</header>
			<main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
				<div className="scan-workbench">
					<PublicScanResultView result={result} />
				</div>
				<p className="mt-10 border-t border-border/60 pt-8 text-center text-sm text-muted-foreground">
					<Link href="/" className="underline-offset-4 hover:underline">
						Scan another domain
					</Link>
				</p>
			</main>
		</div>
	);
}
