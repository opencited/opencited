import { readinessStyle } from "./readiness";

export function buildFullReportPlainText(params: {
	domain: string;
	score: number;
	readiness: string;
	issues: Array<{
		check: string;
		issue: string;
		howToFix: string;
	}>;
}): string {
	const readiness = readinessStyle(params.readiness);
	const lines = [
		`Full technical report for ${params.domain}`,
		`Score: ${params.score}/100 (${readiness.label})`,
		"",
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
}): string {
	return `Your verification code for ${params.domain} is ${params.code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`;
}
