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
}): Promise<{ subject: string; text: string; html: string }> {
	const subject = `Your OpenCited verification code for ${params.domain}`;
	const html = await render(
		ScanVerificationCodeEmail({
			domain: params.domain,
			code: params.code,
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
}): Promise<{ subject: string; text: string; html: string }> {
	const _readiness = readinessStyle(params.readiness);
	const subject = `Your OpenCited scan report for ${params.domain}`;
	const html = await render(
		ScanFullReportEmail({
			domain: params.domain,
			score: params.score,
			readiness: params.readiness,
			issues: params.issues,
		}),
	);
	return {
		subject,
		text: buildFullReportPlainText(params),
		html,
	};
}
