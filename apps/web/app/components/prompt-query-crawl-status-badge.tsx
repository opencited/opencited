import { Badge, type BadgeProps } from "@opencited/ui";

type PromptQueryCrawlStatus = "pending" | "running" | "completed" | "failed";

interface PromptQueryCrawlStatusBadgeProps extends BadgeProps {
	status: PromptQueryCrawlStatus | string | null;
}

const STATUS_CONFIG: Record<
	PromptQueryCrawlStatus,
	{
		label: string;
		variant: "default" | "secondary" | "destructive" | "outline";
	}
> = {
	pending: { label: "Pending", variant: "outline" },
	running: { label: "Running", variant: "secondary" },
	completed: { label: "Completed", variant: "default" },
	failed: { label: "Failed", variant: "destructive" },
};

export function PromptQueryCrawlStatusBadge({
	status,
	...badgeProps
}: PromptQueryCrawlStatusBadgeProps) {
	if (!status) {
		return (
			<Badge variant="outline" {...badgeProps}>
				Unknown
			</Badge>
		);
	}

	const config = STATUS_CONFIG[status as PromptQueryCrawlStatus];
	if (!config) {
		return (
			<Badge variant="outline" {...badgeProps}>
				{status}
			</Badge>
		);
	}
	return (
		<Badge variant={config.variant} {...badgeProps}>
			{config.label}
		</Badge>
	);
}
