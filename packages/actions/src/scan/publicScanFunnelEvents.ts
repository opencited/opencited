import { z } from "zod";

export const publicScanFunnelEventSchema = z.enum([
	"scan_started",
	"score_shown",
	"email_submitted",
	"email_verified",
	"report_viewed",
]);

export type PublicScanFunnelEvent = z.infer<typeof publicScanFunnelEventSchema>;
