import { Badge } from "@opencited/ui";

type PromptQueryCrawlStatus = "pending" | "running" | "completed" | "failed";

interface PromptQueryCrawlStatusBadgeProps {
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
}: PromptQueryCrawlStatusBadgeProps) {
	if (!status) {
		return <Badge variant="outline">Unknown</Badge>;
	}

	const config = STATUS_CONFIG[status as PromptQueryCrawlStatus];
	if (!config) {
		return <Badge variant="outline">{status}</Badge>;
	}
	return <Badge variant={config.variant}>{config.label}</Badge>;
}
