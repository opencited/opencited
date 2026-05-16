"use client";

import { Badge } from "@opencited/ui";

interface RelativePositionBadgeProps {
	position: string | null;
}

const positionConfig: Record<
	string,
	{ variant: "default" | "secondary" | "outline" | "success"; label: string }
> = {
	first: { variant: "success", label: "First" },
	early: { variant: "default", label: "Early" },
	middle: { variant: "secondary", label: "Middle" },
	late: { variant: "outline", label: "Late" },
};

export function RelativePositionBadge({
	position,
}: RelativePositionBadgeProps) {
	if (!position) {
		return <Badge variant="outline">Unknown</Badge>;
	}

	const config = positionConfig[position.toLowerCase()] ?? {
		variant: "outline",
		label: position,
	};

	return <Badge variant={config.variant}>{config.label}</Badge>;
}
