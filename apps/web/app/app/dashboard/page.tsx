import Link from "next/link";
import { PageShell } from "../../components/page-shell";

export default function DashboardPage() {
	return (
		<PageShell title="Dashboard">
			<div className="text-muted-foreground">
				Welcome to your dashboard. This page is under construction.
			</div>
			<div className="mt-4">
				<Link href="/app/trpc-demo" className="text-primary hover:underline">
					View tRPC Demo
				</Link>
			</div>
		</PageShell>
	);
}
