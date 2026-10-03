import type { aiMentionProbeSchema } from "@opencited/db";
import type { z } from "zod";
import type { ScanRepository, StoredPublicScan } from "../scanRepository";
import { createCategoryQueryDeriver } from "./deriveCategoryQueries";
import { fallbackCategoryQueries } from "./fallbackCategoryQueries";
import { filterCategoryQueries } from "./filterCategoryQueries";
import type { CategoryQueryDeriver } from "./types";

const PROBE_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_QUERIES = 3;

export type ScanMentionProbeDispatcher = (payload: {
	publicScanId: string;
	domain: string;
	brandName: string | null;
	queries: string[];
}) => Promise<void>;

const unavailableProbe = { status: "unavailable" as const };
const pendingProbe = { status: "pending" as const };

function isFinalProbe(
	probe: z.infer<typeof aiMentionProbeSchema> | null,
): boolean {
	return probe?.status === "ok" || probe?.status === "unavailable";
}

async function defaultDispatch(payload: {
	publicScanId: string;
	domain: string;
	brandName: string | null;
	queries: string[];
}) {
	const { dispatchScanMentionProbe } = await import("@opencited/queue");
	await dispatchScanMentionProbe(payload);
}

export async function prepareProbeForVerify(params: {
	scan: StoredPublicScan;
	repo: ScanRepository;
	now: () => Date;
	deps?: {
		deriveQueries?: CategoryQueryDeriver;
		dispatchScanMentionProbe?: ScanMentionProbeDispatcher;
	};
}): Promise<z.infer<typeof aiMentionProbeSchema>> {
	const deriveQueries =
		params.deps?.deriveQueries ?? createCategoryQueryDeriver();
	const dispatch = params.deps?.dispatchScanMentionProbe ?? defaultDispatch;

	if (
		params.scan.probeCompletedAt &&
		isFinalProbe(params.scan.aiMentionProbe)
	) {
		return params.scan.aiMentionProbe!;
	}

	if (params.scan.aiMentionProbe?.status === "pending") {
		return pendingProbe;
	}

	const since = new Date(params.now().getTime() - PROBE_CACHE_MS);
	const cached = await params.repo.findFreshProbeForDomain(
		params.scan.domain,
		since,
	);
	if (cached?.status === "ok") {
		await params.repo.updatePublicScanProbe(params.scan.id, {
			aiMentionProbe: cached,
			probeCompletedAt: params.now(),
		});
		return cached;
	}

	const snapshot = params.scan.homepageSnapshot;
	const brandName =
		snapshot?.brandName ?? snapshot?.title?.split("|")[0]?.trim() ?? null;

	if (!snapshot?.textExcerpt.trim()) {
		await params.repo.updatePublicScanProbe(params.scan.id, {
			aiMentionProbe: unavailableProbe,
			probeCompletedAt: params.now(),
		});
		return unavailableProbe;
	}

	let derived: string[];
	try {
		derived = await deriveQueries(snapshot, params.scan.domain);
	} catch {
		derived = fallbackCategoryQueries(snapshot, params.scan.domain);
	}

	let queries = filterCategoryQueries(derived.slice(0, MAX_QUERIES), {
		brandName,
		domain: params.scan.domain,
	}).slice(0, MAX_QUERIES);

	if (queries.length === 0) {
		queries = filterCategoryQueries(
			fallbackCategoryQueries(snapshot, params.scan.domain),
			{ brandName, domain: params.scan.domain },
		).slice(0, MAX_QUERIES);
	}

	if (queries.length === 0) {
		await params.repo.updatePublicScanProbe(params.scan.id, {
			aiMentionProbe: unavailableProbe,
			probeCompletedAt: params.now(),
		});
		return unavailableProbe;
	}

	await params.repo.setPublicScanProbePending(params.scan.id, pendingProbe);
	try {
		await dispatch({
			publicScanId: params.scan.id,
			domain: params.scan.domain,
			brandName,
			queries,
		});
	} catch {
		await params.repo.updatePublicScanProbe(params.scan.id, {
			aiMentionProbe: unavailableProbe,
			probeCompletedAt: params.now(),
		});
		return unavailableProbe;
	}

	return pendingProbe;
}
