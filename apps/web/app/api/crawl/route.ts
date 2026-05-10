import type { perplexityCrawlTask } from "@opencited/trigger";
import { tasks } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	const { query } = await request.json();

	const handle = await tasks.trigger<typeof perplexityCrawlTask>(
		"perplexity-crawl",
		{ query },
	);

	return NextResponse.json({
		runId: handle.id,
		status: "triggered",
		message: "Crawl task triggered successfully",
	});
}
