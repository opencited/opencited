import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@opencited/trpc";

export type StoredScanUnlock = {
	scanId: string;
	email: string;
	report: inferRouterOutputs<AppRouter>["scan"]["verifyReport"];
};

function storageKey(scanId: string): string {
	return `opencited-scan-unlock:${scanId}`;
}

export function readScanUnlock(scanId: string): StoredScanUnlock | null {
	if (typeof window === "undefined") {
		return null;
	}
	try {
		const raw = sessionStorage.getItem(storageKey(scanId));
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as StoredScanUnlock;
		if (parsed.scanId !== scanId || !parsed.email || !parsed.report) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function writeScanUnlock(state: StoredScanUnlock): void {
	if (typeof window === "undefined") {
		return;
	}
	try {
		sessionStorage.setItem(storageKey(state.scanId), JSON.stringify(state));
	} catch {
		// quota / private mode
	}
}
