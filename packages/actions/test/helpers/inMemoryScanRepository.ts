import type {
	ScanRepository,
	StoredPublicScan,
	StoredScanLead,
} from "../../src/scan/scanRepository";

export function createInMemoryScanRepository(): ScanRepository {
	const publicScans: StoredPublicScan[] = [];
	const scanLeads: StoredScanLead[] = [];

	return {
		async countScansByIpSince(ip, since) {
			return publicScans.filter(
				(scan) => scan.clientIp === ip && scan.createdAt >= since,
			).length;
		},

		async insertPublicScan(data) {
			const row: StoredPublicScan = {
				id: crypto.randomUUID(),
				domain: data.domain,
				finalUrl: data.finalUrl,
				score: data.score,
				readiness: data.readiness,
				issues: data.issues,
				durationMs: data.durationMs,
				clientIp: data.clientIp ?? null,
				createdAt: new Date(),
			};
			publicScans.push(row);
			return row;
		},

		async getPublicScanById(id) {
			return publicScans.find((scan) => scan.id === id) ?? null;
		},

		async countLeadsByEmailSince(email, since) {
			return scanLeads.filter(
				(lead) => lead.email === email && lead.createdAt >= since,
			).length;
		},

		async getLeadByScanAndEmail(publicScanId, email) {
			return (
				scanLeads.find(
					(lead) => lead.publicScanId === publicScanId && lead.email === email,
				) ?? null
			);
		},

		async insertLead(data) {
			const row: StoredScanLead = {
				id: crypto.randomUUID(),
				email: data.email,
				domain: data.domain,
				publicScanId: data.publicScanId,
				consentToOnChangeUpdates: data.consentToOnChangeUpdates,
				codeHash: data.codeHash,
				codeExpiresAt: data.codeExpiresAt,
				attemptCount: 0,
				verifiedAt: null,
				reportSentAt: null,
				createdAt: new Date(),
			};
			scanLeads.push(row);
			return row;
		},

		async updateLead(id, data) {
			const index = scanLeads.findIndex((lead) => lead.id === id);
			const current = scanLeads[index];
			if (!current) {
				throw new Error("Failed to update scan lead");
			}
			const updated: StoredScanLead = {
				id: current.id,
				email: current.email,
				domain: current.domain,
				publicScanId: current.publicScanId,
				createdAt: current.createdAt,
				consentToOnChangeUpdates:
					data.consentToOnChangeUpdates ?? current.consentToOnChangeUpdates,
				codeHash: data.codeHash ?? current.codeHash,
				codeExpiresAt: data.codeExpiresAt ?? current.codeExpiresAt,
				attemptCount: data.attemptCount ?? current.attemptCount,
				verifiedAt:
					data.verifiedAt === undefined ? current.verifiedAt : data.verifiedAt,
				reportSentAt:
					data.reportSentAt === undefined
						? current.reportSentAt
						: data.reportSentAt,
			};
			scanLeads[index] = updated;
			return updated;
		},
	};
}
