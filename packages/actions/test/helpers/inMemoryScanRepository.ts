import type { PublicScanFunnelEvent } from "../../src/scan/publicScanFunnelEvents";
import type {
	ScanRepository,
	StoredPublicScan,
	StoredScanLead,
} from "../../src/scan/scanRepository";

type StoredFunnelEvent = {
	id: string;
	publicScanId: string | null;
	event: PublicScanFunnelEvent;
	createdAt: Date;
};

export function createInMemoryScanRepository(): ScanRepository {
	const publicScans: StoredPublicScan[] = [];
	const scanLeads: StoredScanLead[] = [];
	const funnelEvents: StoredFunnelEvent[] = [];

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
				homepageSnapshot: data.homepageSnapshot ?? null,
				aiMentionProbe: null,
				probeCompletedAt: null,
				createdAt: new Date(),
			};
			publicScans.push(row);
			return row;
		},

		async getPublicScanById(id) {
			return publicScans.find((scan) => scan.id === id) ?? null;
		},

		async findFreshProbeForDomain(domain, since) {
			const match = publicScans
				.filter(
					(scan) =>
						scan.domain === domain &&
						scan.probeCompletedAt &&
						scan.probeCompletedAt >= since &&
						scan.aiMentionProbe?.status === "ok",
				)
				.sort(
					(a, b) =>
						(b.probeCompletedAt?.getTime() ?? 0) -
						(a.probeCompletedAt?.getTime() ?? 0),
				)[0];
			return match?.aiMentionProbe?.status === "ok"
				? match.aiMentionProbe
				: null;
		},

		async setPublicScanProbePending(id, probe) {
			const index = publicScans.findIndex((scan) => scan.id === id);
			const current = publicScans[index];
			if (!current) {
				throw new Error("Failed to set public scan probe pending");
			}
			const updated: StoredPublicScan = {
				...current,
				aiMentionProbe: probe,
				probeCompletedAt: null,
			};
			publicScans[index] = updated;
			return updated;
		},

		async updatePublicScanProbe(id, data) {
			const index = publicScans.findIndex((scan) => scan.id === id);
			const current = publicScans[index];
			if (!current) {
				throw new Error("Failed to update public scan probe");
			}
			const updated: StoredPublicScan = {
				...current,
				aiMentionProbe: data.aiMentionProbe,
				probeCompletedAt: data.probeCompletedAt,
			};
			publicScans[index] = updated;
			return updated;
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

		async hasVerifiedLeadForEmailAndDomain(email, domain) {
			return scanLeads.some(
				(lead) =>
					lead.email === email &&
					lead.domain === domain &&
					lead.verifiedAt !== null,
			);
		},

		async listLeadsNeedingProbeReport(publicScanId) {
			return scanLeads.filter(
				(lead) =>
					lead.publicScanId === publicScanId &&
					lead.verifiedAt !== null &&
					lead.reportSentAt !== null &&
					lead.probeReportSentAt === null,
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
				probeReportSentAt: null,
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
				probeReportSentAt:
					data.probeReportSentAt === undefined
						? current.probeReportSentAt
						: data.probeReportSentAt,
			};
			scanLeads[index] = updated;
			return updated;
		},

		async insertFunnelEvent(params) {
			const row: StoredFunnelEvent = {
				id: crypto.randomUUID(),
				publicScanId: params.publicScanId ?? null,
				event: params.event,
				createdAt: new Date(),
			};
			funnelEvents.push(row);
			return { id: row.id };
		},

		async linkFunnelEventToScan(eventId, publicScanId) {
			const event = funnelEvents.find((row) => row.id === eventId);
			if (!event) {
				throw new Error("Funnel event not found");
			}
			event.publicScanId = publicScanId;
		},

		async recordFunnelEventIfAbsent(params) {
			const exists = funnelEvents.some(
				(row) =>
					row.publicScanId === params.publicScanId &&
					row.event === params.event,
			);
			if (!exists) {
				funnelEvents.push({
					id: crypto.randomUUID(),
					publicScanId: params.publicScanId,
					event: params.event,
					createdAt: new Date(),
				});
			}
		},

		async hasVerifiedLeadForScan(publicScanId) {
			return scanLeads.some(
				(lead) =>
					lead.publicScanId === publicScanId && lead.verifiedAt !== null,
			);
		},

		async listFunnelEventsForScan(publicScanId) {
			return funnelEvents
				.filter((row) => row.publicScanId === publicScanId)
				.map((row) => ({ event: row.event }));
		},

		async countFunnelEvents(params) {
			return funnelEvents.filter((row) => {
				if (row.event !== params.event) {
					return false;
				}
				if (params.publicScanId === undefined) {
					return true;
				}
				return row.publicScanId === params.publicScanId;
			}).length;
		},
	};
}
