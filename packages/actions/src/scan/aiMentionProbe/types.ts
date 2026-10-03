import type { z } from "zod";
import type {
	aiMentionProbeSchema,
	publicScanHomepageSnapshotSchema,
} from "@opencited/db";

export type AiMentionProbe = z.infer<typeof aiMentionProbeSchema>;
export type HomepageSnapshot = z.infer<typeof publicScanHomepageSnapshotSchema>;

export type CategoryQueryDeriver = (
	snapshot: HomepageSnapshot,
	domain: string,
) => Promise<string[]>;
