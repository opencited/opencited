import { HomeScanPage } from "./components/home-scan-page";
import { homeScanMetadata } from "./lib/home-scan-seo";

export const metadata = homeScanMetadata;

export default function Home() {
	return <HomeScanPage />;
}
