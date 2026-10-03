import { and, count, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "@opencited/db";
import {
	publicScanTable,
	scanLeadTable,
	type aiMentionProbeSchema,
	type publicScanHomepageSnapshotSchema,
	type publicScanIssueSchema,
} from "@opencited/db";
import type { z } from "zod";

export type StoredPublicScan = {
	id: string;
	domain: string;
	finalUrl: string;
	score: number;
	readiness: string;
	issues: z.infer<typeof publicScanIssueSchema>[];
	durationMs: number;
	clientIp: string | null;
	homepageSnapshot: z.infer<typeof publicScanHomepageSnapshotSchema> | null;
	aiMentionProbe: z.infer<typeof aiMentionProbeSchema> | null;
	probeCompletedAt: Date | null;
	createdAt: Date;
};

export type StoredScanLead = {
	id: string;
	email: string;
	domain: string;
	publicScanId: string;
	consentToOnChangeUpdates: boolean;
	codeHash: string;
	codeExpiresAt: Date;
	attemptCount: number;
	verifiedAt: Date | null;
	reportSentAt: Date | null;
	probeReportSentAt: Date | null;
	createdAt: Date;
};

export interface ScanRepository {
	countScansByIpSince(ip: string, since: Date): Promise<number>;
	insertPublicScan(data: {
		domain: string;
		finalUrl: string;
		score: number;
		readiness: string;
		issues: z.infer<typeof publicScanIssueSchema>[];
		durationMs: number;
		clientIp?: string;
		homepageSnapshot?: z.infer<typeof publicScanHomepageSnapshotSchema>;
	}): Promise<StoredPublicScan>;
	getPublicScanById(id: string): Promise<StoredPublicScan | null>;
	findFreshProbeForDomain(
		domain: string,
		since: Date,
	): Promise<z.infer<typeof aiMentionProbeSchema> | null>;
	updatePublicScanProbe(
		id: string,
		data: {
			aiMentionProbe: z.infer<typeof aiMentionProbeSchema>;
			probeCompletedAt: Date;
		},
	): Promise<StoredPublicScan>;
	setPublicScanProbePending(
		id: string,
		probe: Extract<z.infer<typeof aiMentionProbeSchema>, { status: "pending" }>,
	): Promise<StoredPublicScan>;
	countLeadsByEmailSince(email: string, since: Date): Promise<number>;
	getLeadByScanAndEmail(
		publicScanId: string,
		email: string,
	): Promise<StoredScanLead | null>;
	listLeadsNeedingProbeReport(publicScanId: string): Promise<StoredScanLead[]>;
	insertLead(data: {
		email: string;
		domain: string;
		publicScanId: string;
		consentToOnChangeUpdates: boolean;
		codeHash: string;
		codeExpiresAt: Date;
	}): Promise<StoredScanLead>;
	updateLead(
		id: string,
		data: Partial<{
			consentToOnChangeUpdates: boolean;
			codeHash: string;
			codeExpiresAt: Date;
			attemptCount: number;
			verifiedAt: Date;
			reportSentAt: Date;
			probeReportSentAt: Date;
		}>,
	): Promise<StoredScanLead>;
}

function mapPublicScan(
	row: typeof publicScanTable.$inferSelect,
): StoredPublicScan {
	return {
		id: row.id,
		domain: row.domain,
		finalUrl: row.finalUrl,
		score: row.score,
		readiness: row.readiness,
		issues: row.issues,
		durationMs: row.durationMs,
		clientIp: row.clientIp,
		homepageSnapshot: row.homepageSnapshot ?? null,
		aiMentionProbe: row.aiMentionProbe ?? null,
		probeCompletedAt: row.probeCompletedAt ?? null,
		createdAt: row.createdAt,
	};
}

function mapScanLead(row: typeof scanLeadTable.$inferSelect): StoredScanLead {
	return {
		id: row.id,
		email: row.email,
		domain: row.domain,
		publicScanId: row.publicScanId,
		consentToOnChangeUpdates: row.consentToOnChangeUpdates,
		codeHash: row.codeHash,
		codeExpiresAt: row.codeExpiresAt,
		attemptCount: row.attemptCount,
		verifiedAt: row.verifiedAt,
		reportSentAt: row.reportSentAt,
		probeReportSentAt: row.probeReportSentAt ?? null,
		createdAt: row.createdAt,
	};
}

export function createDrizzleScanRepository(db: Db): ScanRepository {
	return {
		async countScansByIpSince(ip, since) {
			const [row] = await db
				.select({ value: count() })
				.from(publicScanTable)
				.where(
					and(
						eq(publicScanTable.clientIp, ip),
						gte(publicScanTable.createdAt, since),
					),
				);
			return row?.value ?? 0;
		},

		async insertPublicScan(data) {
			const [row] = await db
				.insert(publicScanTable)
				.values({
					domain: data.domain,
					finalUrl: data.finalUrl,
					score: data.score,
					readiness: data.readiness,
					issues: data.issues,
					durationMs: data.durationMs,
					clientIp: data.clientIp,
					homepageSnapshot: data.homepageSnapshot,
				})
				.returning();
			if (!row) {
				throw new Error("Failed to store public scan");
			}
			return mapPublicScan(row);
		},

		async getPublicScanById(id) {
			const [row] = await db
				.select()
				.from(publicScanTable)
				.where(eq(publicScanTable.id, id))
				.limit(1);
			return row ? mapPublicScan(row) : null;
		},

		async findFreshProbeForDomain(domain, since) {
			const [row] = await db
				.select({ probe: publicScanTable.aiMentionProbe })
				.from(publicScanTable)
				.where(
					and(
						eq(publicScanTable.domain, domain),
						gte(publicScanTable.probeCompletedAt, since),
						isNotNull(publicScanTable.aiMentionProbe),
					),
				)
				.orderBy(desc(publicScanTable.probeCompletedAt))
				.limit(1);
			const probe = row?.probe;
			if (!probe || probe.status !== "ok") {
				return null;
			}
			return probe;
		},

		async updatePublicScanProbe(id, data) {
			const [row] = await db
				.update(publicScanTable)
				.set({
					aiMentionProbe: data.aiMentionProbe,
					probeCompletedAt: data.probeCompletedAt,
				})
				.where(eq(publicScanTable.id, id))
				.returning();
			if (!row) {
				throw new Error("Failed to update public scan probe");
			}
			return mapPublicScan(row);
		},

		async setPublicScanProbePending(id, probe) {
			const [row] = await db
				.update(publicScanTable)
				.set({
					aiMentionProbe: probe,
					probeCompletedAt: null,
				})
				.where(eq(publicScanTable.id, id))
				.returning();
			if (!row) {
				throw new Error("Failed to set public scan probe pending");
			}
			return mapPublicScan(row);
		},

		async countLeadsByEmailSince(email, since) {
			const [row] = await db
				.select({ value: count() })
				.from(scanLeadTable)
				.where(
					and(
						eq(scanLeadTable.email, email),
						gte(scanLeadTable.createdAt, since),
					),
				);
			return row?.value ?? 0;
		},

		async getLeadByScanAndEmail(publicScanId, email) {
			const [row] = await db
				.select()
				.from(scanLeadTable)
				.where(
					and(
						eq(scanLeadTable.publicScanId, publicScanId),
						eq(scanLeadTable.email, email),
					),
				)
				.limit(1);
			return row ? mapScanLead(row) : null;
		},

		async listLeadsNeedingProbeReport(publicScanId) {
			const rows = await db
				.select()
				.from(scanLeadTable)
				.where(
					and(
						eq(scanLeadTable.publicScanId, publicScanId),
						isNotNull(scanLeadTable.verifiedAt),
						isNotNull(scanLeadTable.reportSentAt),
						isNull(scanLeadTable.probeReportSentAt),
					),
				);
			return rows.map(mapScanLead);
		},

		async insertLead(data) {
			const [row] = await db
				.insert(scanLeadTable)
				.values({
					email: data.email,
					domain: data.domain,
					publicScanId: data.publicScanId,
					consentToOnChangeUpdates: data.consentToOnChangeUpdates,
					codeHash: data.codeHash,
					codeExpiresAt: data.codeExpiresAt,
				})
				.returning();
			if (!row) {
				throw new Error("Failed to store scan lead");
			}
			return mapScanLead(row);
		},

		async updateLead(id, data) {
			const [row] = await db
				.update(scanLeadTable)
				.set(data)
				.where(eq(scanLeadTable.id, id))
				.returning();
			if (!row) {
				throw new Error("Failed to update scan lead");
			}
			return mapScanLead(row);
		},
	};
}
