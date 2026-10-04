import { Resend } from "resend";
import {
	buildFullReportEmail,
	buildVerificationCodeEmail,
} from "@opencited/transactional-email";
import { env } from "../env";
import type { ScanMailer } from "./mailer";
import { ScanReportError } from "./scanErrors";

export function assertResendSent(
	result: Awaited<ReturnType<Resend["emails"]["send"]>>,
): void {
	if (result.error) {
		const message = result.error.message;
		if (
			message.includes("only send testing emails to your own email address")
		) {
			throw new ScanReportError(
				"Email could not be sent to this address yet. With Resend’s test sender (onboarding@resend.dev), mail only goes to your Resend account email. Verify a domain in Resend and set SCAN_FROM_EMAIL to an address on that domain, or test with your Resend account email.",
			);
		}
		throw new ScanReportError(
			message || "Failed to send email. Please try again.",
		);
	}
	if (!result.data?.id) {
		throw new ScanReportError("Failed to send email. Please try again.");
	}
}

export function createResendScanMailer(): ScanMailer {
	const resend = new Resend(env.RESEND_API_KEY);

	return {
		async sendVerificationCode({ to, domain, code, resultUrl }) {
			const email = await buildVerificationCodeEmail({
				domain,
				code,
				resultUrl: resultUrl ?? undefined,
			});
			const result = await resend.emails.send({
				from: env.SCAN_FROM_EMAIL,
				to,
				subject: email.subject,
				text: email.text,
				html: email.html,
			});
			assertResendSent(result);
		},
		async sendFullReport({
			to,
			domain,
			score,
			readiness,
			issues,
			probe,
			visibilityUpdate,
			resultUrl,
		}) {
			const email = await buildFullReportEmail({
				domain,
				score,
				readiness,
				issues,
				probe,
				visibilityUpdate,
				resultUrl: resultUrl ?? undefined,
			});
			const result = await resend.emails.send({
				from: env.SCAN_FROM_EMAIL,
				to,
				subject: email.subject,
				text: email.text,
				html: email.html,
			});
			assertResendSent(result);
		},
	};
}
