import type { Metadata } from "next";
import { scanResultRobots } from "@/app/lib/scan-seo";

export const metadata: Metadata = {
	robots: scanResultRobots,
};

export default function ScanResultLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
