import { useTRPC } from "@/app/_trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { QueryCell } from "@/app/components/query-cell";
import { Skeleton } from "@opencited/ui";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";
import { cn } from "@/lib/utils";

type RouterOutput = inferRouterOutputs<AppRouter>;
type DomainProject = RouterOutput["domainProject"]["get"];

function DomainDisplaySkeleton({ className }: { className?: string }) {
	return (
		<div className={cn("flex items-center gap-2 px-2 py-1", className)}>
			<Skeleton className="h-4 w-4 animate-pulse rounded" />
			<Skeleton className="h-4 w-24 animate-pulse" />
		</div>
	);
}

export function DomainDisplay({
	className,
	iconClassName,
}: {
	className?: string;
	iconClassName?: string;
}) {
	const trpc = useTRPC();
	const query = useQuery(trpc.domainProject.get.queryOptions());

	return (
		<QueryCell
			query={query}
			loading={<DomainDisplaySkeleton className="text-muted-foreground" />}
			error={(_error) => (
				<div
					className={cn(
						"flex items-center gap-2 px-2 py-1 text-sm text-destructive",
						className,
					)}
				>
					<Globe className={cn("size-3.5", iconClassName)} />
					<span className="truncate">Error loading domain</span>
				</div>
			)}
			success={(domainProject) => {
				if (!domainProject) return null;
				const logoUrl = (domainProject as DomainProject)?.logoUrl;
				return (
					<div
						className={cn(
							"flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground",
							className,
						)}
					>
						{logoUrl ? (
							<img
								src={logoUrl}
								alt=""
								className={cn("size-4 rounded", iconClassName)}
								onError={(e) => {
									(e.target as HTMLImageElement).style.display = "none";
								}}
							/>
						) : (
							<Globe className={cn("size-3.5", iconClassName)} />
						)}
						<span className="truncate">
							{(domainProject as DomainProject)?.domain}
						</span>
					</div>
				);
			}}
		/>
	);
}
