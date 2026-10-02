import { Resend } from "resend";
import { env } from "../env";
import type { ScanMailer } from "./mailer";

export function createResendScanMailer(): ScanMailer {
	const resend = new Resend(env.RESEND_API_KEY);

	return {
		async sendVerificationCode({ to, domain, code }) {
			await resend.emails.send({
				from: env.SCAN_FROM_EMAIL,
				to,
				subject: `Your OpenCited verification code for ${domain}`,
				text: `Your verification code is ${code}. It expires in 10 minutes.`,
			});
		},
		async sendFullReport({ to, domain, score, readiness, issues }) {
			const lines = [
				`Full technical report for ${domain}`,
				`Score: ${score}/100 (${readiness})`,
				"",
				...issues.flatMap((issue, index) => [
					`${index + 1}. [${issue.check}] ${issue.issue}`,
					`   Fix: ${issue.howToFix}`,
					"",
				]),
			];

			await resend.emails.send({
				from: env.SCAN_FROM_EMAIL,
				to,
				subject: `Your OpenCited scan report for ${domain}`,
				text: lines.join("\n"),
			});
		},
	};
}
