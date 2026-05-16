"use client";

import { Badge } from "@opencited/ui";

interface AnswerFormatBadgeProps {
	format: string | null;
}

const formatConfig: Record<
	string,
	{ variant: "default" | "secondary" | "outline"; label: string }
> = {
	paragraph: { variant: "default", label: "Paragraph" },
	list: { variant: "secondary", label: "List" },
	table: { variant: "outline", label: "Table" },
	comparison: { variant: "secondary", label: "Comparison" },
	steps: { variant: "outline", label: "Steps" },
	code: { variant: "secondary", label: "Code" },
	mixed: { variant: "default", label: "Mixed" },
};

export function AnswerFormatBadge({ format }: AnswerFormatBadgeProps) {
	if (!format) {
		return <Badge variant="outline">Unknown</Badge>;
	}

	const config = formatConfig[format.toLowerCase()] ?? {
		variant: "outline",
		label: format,
	};

	return <Badge variant={config.variant}>{config.label}</Badge>;
}
