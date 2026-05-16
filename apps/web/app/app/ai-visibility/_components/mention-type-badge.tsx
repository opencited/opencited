"use client";

import { Badge } from "@opencited/ui";

interface MentionTypeBadgeProps {
	type: string | null;
}

const typeConfig: Record<
	string,
	{ variant: "default" | "secondary" | "outline" | "success"; label: string }
> = {
	target: { variant: "success", label: "Target" },
	competitor: { variant: "secondary", label: "Competitor" },
	other: { variant: "outline", label: "Other" },
};

export function MentionTypeBadge({ type }: MentionTypeBadgeProps) {
	if (!type) {
		return <Badge variant="outline">Unknown</Badge>;
	}

	const config = typeConfig[type.toLowerCase()] ?? {
		variant: "outline",
		label: type,
	};

	return <Badge variant={config.variant}>{config.label}</Badge>;
}
