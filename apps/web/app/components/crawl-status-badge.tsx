import { Badge } from "@opencited/ui";

type CrawlStatus = "pending" | "fetched" | "analyzed" | "error";

interface CrawlStatusBadgeProps {
	status: CrawlStatus | null;
}

const STATUS_CONFIG: Record<
	CrawlStatus,
	{
		label: string;
		variant: "default" | "secondary" | "destructive" | "outline";
	}
> = {
	pending: { label: "Pending", variant: "outline" },
	fetched: { label: "Fetched", variant: "secondary" },
	analyzed: { label: "Analyzed", variant: "default" },
	error: { label: "Error", variant: "destructive" },
};

export function CrawlStatusBadge({ status }: CrawlStatusBadgeProps) {
	if (status === null) {
		return <Badge variant="warning">Pending</Badge>;
	}

	const config = STATUS_CONFIG[status];
	return <Badge variant={config.variant}>{config.label}</Badge>;
}
