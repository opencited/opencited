export interface ScanMailer {
	sendVerificationCode(params: {
		to: string;
		domain: string;
		code: string;
	}): Promise<void>;
	sendFullReport(params: {
		to: string;
		domain: string;
		score: number;
		readiness: string;
		issues: Array<{
			check: string;
			issue: string;
			howToFix: string;
		}>;
	}): Promise<void>;
}
