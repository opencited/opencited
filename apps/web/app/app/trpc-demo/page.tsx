"use client";

import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/app/components/page-shell";
import { useTRPC } from "@/app/_trpc/client";

export default function TrpcDemoPage() {
	const trpc = useTRPC();
	const { data, isLoading } = useQuery(trpc.user.me.queryOptions());

	return (
		<PageShell title="tRPC Demo">
			{isLoading ? (
				<p className="text-muted-foreground">Loading user data...</p>
			) : (
				<div className="space-y-2">
					<p className="text-sm text-muted-foreground">
						<span className="font-medium text-foreground">User ID:</span>{" "}
						{data?.userId}
					</p>
				</div>
			)}
		</PageShell>
	);
}
