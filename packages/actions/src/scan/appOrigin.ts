import { env } from "../env";
import { publicScanResultUrl } from "./publicScanResultUrl";

export function resolvePublicAppOrigin(
	override?: string | null,
): string | null {
	const explicit = override ?? env.PUBLIC_APP_URL;
	if (explicit) {
		return explicit.replace(/\/$/, "");
	}
	if (env.VERCEL_URL) {
		return `https://${env.VERCEL_URL}`;
	}
	return null;
}

export function publicScanResultLink(
	scanId: string,
	originOverride?: string | null,
): string | null {
	const origin = resolvePublicAppOrigin(originOverride);
	if (!origin) {
		return null;
	}
	return publicScanResultUrl(origin, scanId);
}
