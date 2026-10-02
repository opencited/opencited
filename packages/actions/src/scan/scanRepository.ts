import { and, count, eq, gte } from "drizzle-orm";
import type { Db } from "@opencited/db";
import {
	publicScanTable,
	scanLeadTable,
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
	}): Promise<StoredPublicScan>;
	getPublicScanById(id: string): Promise<StoredPublicScan | null>;
	countLeadsByEmailSince(email: string, since: Date): Promise<number>;
	getLeadByScanAndEmail(
		publicScanId: string,
		email: string,
	): Promise<StoredScanLead | null>;
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
