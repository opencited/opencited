import { readinessStyle } from "./readiness";

export function buildFullReportPlainText(params: {
	domain: string;
	score: number;
	readiness: string;
	resultUrl?: string;
	issues: Array<{
		check: string;
		issue: string;
		howToFix: string;
	}>;
	probe:
		| { status: "unavailable" }
		| { status: "pending" }
		| {
				status: "ok";
				queries: Array<{
					query: string;
					visibility: "visible" | "not-visible";
					excerpt: string;
					citationUrls: string[];
				}>;
		  };
}): string {
	const readiness = readinessStyle(params.readiness);
	const probeLines =
		params.probe.status === "pending"
			? [
					"AI answer visibility: live Perplexity check in progress (see your scan page)",
					"",
				]
			: params.probe.status === "unavailable"
				? ["AI answer visibility: probe unavailable", ""]
				: [
						"AI answer visibility:",
						...params.probe.queries.flatMap((row) => [
							`- ${row.visibility === "visible" ? "Visible" : "Not visible"}: ${row.query}`,
							`  ${row.excerpt}`,
							...(row.citationUrls.length > 0
								? [`  Sources: ${row.citationUrls.join(", ")}`]
								: []),
						]),
						"",
					];
	const shareLine = params.resultUrl
		? [`Share your free result: ${params.resultUrl}`, ""]
		: [];
	const lines = [
		`Full technical report for ${params.domain}`,
		`Score: ${params.score}/100 (${readiness.label})`,
		"",
		...shareLine,
		...probeLines,
		...params.issues.flatMap((issue, index) => [
			`${index + 1}. [${issue.check}] ${issue.issue}`,
			`   Fix: ${issue.howToFix}`,
			"",
		]),
	];
	return lines.join("\n");
}

export function buildVerificationPlainText(params: {
	domain: string;
	code: string;
	resultUrl?: string;
}): string {
	const shareLine = params.resultUrl
		? `\n\nShare your free result: ${params.resultUrl}`
		: "";
	return `Your verification code for ${params.domain} is ${params.code}. It expires in 10 minutes.${shareLine}\n\nIf you didn't request this, you can ignore this email.`;
}
