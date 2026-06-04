"use client";

import { ActiveCrawlIndicator } from "@/app/components/active-crawl-indicator";

interface ActiveCrawlIndicatorWrapperProps {
	domainProjectId: string;
}

export function ActiveCrawlIndicatorWrapper({
	domainProjectId,
}: ActiveCrawlIndicatorWrapperProps) {
	return <ActiveCrawlIndicator domainProjectId={domainProjectId} />;
}
