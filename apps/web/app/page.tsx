import type { Metadata } from "next";
import { LandingPage } from "./components/landing/landing-page";
import { landingMetadata } from "./lib/landing-seo";

export const metadata: Metadata = landingMetadata;

export default function Home() {
	return <LandingPage />;
}
