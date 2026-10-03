import { render } from "@react-email/render";
import ScanFullReportEmail from "../emails/scan-full-report";
import ScanVerificationCodeEmail from "../emails/scan-verification-code";
import {
	buildFullReportPlainText,
	buildVerificationPlainText,
} from "./plain-text";
import { readinessStyle } from "./readiness";

export async function buildVerificationCodeEmail(params: {
	domain: string;
	code: string;
	resultUrl?: string;
}): Promise<{ subject: string; text: string; html: string }> {
	const subject = `Your OpenCited verification code for ${params.domain}`;
	const html = await render(
		ScanVerificationCodeEmail({
			domain: params.domain,
			code: params.code,
			resultUrl: params.resultUrl,
		}),
	);
	return {
		subject,
		text: buildVerificationPlainText(params),
		html,
	};
}

export async function buildFullReportEmail(params: {
	domain: string;
	score: number;
	readiness: string;
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
	visibilityUpdate?: boolean;
	resultUrl?: string;
}): Promise<{ subject: string; text: string; html: string }> {
	const _readiness = readinessStyle(params.readiness);
	const subject = params.visibilityUpdate
		? `AI visibility results for ${params.domain}`
		: `Your OpenCited scan report for ${params.domain}`;
	const html = await render(
		ScanFullReportEmail({
			domain: params.domain,
			score: params.score,
			readiness: params.readiness,
			issues: params.issues,
			probe: params.probe,
			resultUrl: params.resultUrl,
		}),
	);
	return {
		subject,
		text: buildFullReportPlainText(params),
		html,
	};
}
