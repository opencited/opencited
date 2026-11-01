import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { LandingPage } from "./components/landing/landing-page";
import { landingMetadata } from "./lib/landing-seo";

export const metadata: Metadata = landingMetadata;

export default async function Home() {
	// Read the session on the server so the CTA is correct in the first HTML.
	const { userId } = await auth();

	return <LandingPage signedIn={Boolean(userId)} />;
}
