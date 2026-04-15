"use client";

import { useTRPC } from "@/app/_trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";

export function DomainDisplay() {
	const trpc = useTRPC();
	const { data: domainProject } = useQuery(
		trpc.domainProject.get.queryOptions(),
	);

	if (!domainProject?.domain) {
		return null;
	}

	return (
		<div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
			<Globe className="size-3.5" />
			<span className="truncate">{domainProject.domain}</span>
		</div>
	);
}
