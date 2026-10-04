import type { aiMentionProbeSchema } from "@opencited/db";
import type { z } from "zod";

export interface ScanMailer {
	sendVerificationCode(params: {
		to: string;
		domain: string;
		code: string;
		resultUrl?: string | null;
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
		probe: z.infer<typeof aiMentionProbeSchema>;
		/** Second email after live Perplexity probe finishes (subject line differs). */
		visibilityUpdate?: boolean;
		resultUrl?: string | null;
	}): Promise<void>;
}
