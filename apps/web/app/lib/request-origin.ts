import { headers } from "next/headers";
import { env } from "@/env";

export async function getRequestOrigin(): Promise<string> {
	const headerList = await headers();
	const host =
		headerList.get("x-forwarded-host") ?? headerList.get("host") ?? null;
	const proto = headerList.get("x-forwarded-proto") ?? "https";
	if (host) {
		return `${proto}://${host}`;
	}
	if (env.VERCEL_URL) {
		return `https://${env.VERCEL_URL}`;
	}
	return "http://localhost:3000";
}
