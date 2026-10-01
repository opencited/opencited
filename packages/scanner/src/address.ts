import { isIP } from "node:net";
import { ScanTargetError } from "./errors";

const BLOCKED_HOSTNAMES = new Set([
	"localhost",
	"localhost.localdomain",
	"ip6-localhost",
	"ip6-loopback",
]);

const BLOCKED_TLDS = new Set([
	"local",
	"localdomain",
	"internal",
	"intranet",
	"lan",
	"home",
	"corp",
	"private",
	"test",
	"example",
	"invalid",
	"onion",
	"localhost",
	"mail",
	"alt",
]);

function isPublicIPv4(address: string): boolean {
	const parts = address.split(".");
	if (parts.length !== 4) return false;
	const octets: number[] = [];
	for (const part of parts) {
		if (!/^\d{1,3}$/.test(part)) return false;
		const value = Number(part);
		if (value > 255) return false;
		octets.push(value);
	}
	const a = octets[0] as number;
	const b = octets[1] as number;
	if (a === 0) return false;
	if (a === 10) return false;
	if (a === 127) return false;
	if (a === 169 && b === 254) return false;
	if (a === 172 && b >= 16 && b <= 31) return false;
	if (a === 192 && b === 168) return false;
	if (a === 192 && b === 0) return false;
	if (a === 100 && b >= 64 && b <= 127) return false;
	if (a === 198 && (b === 18 || b === 19)) return false;
	if (a >= 224) return false;
	return true;
}

function isPublicIPv6(address: string): boolean {
	const addr = address.split("%")[0]?.toLowerCase();
	if (!addr) return false;
	if (addr === "::" || addr === "::1") return false;
	const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
	if (mapped?.[1]) return isPublicIPv4(mapped[1]);
	if (addr.startsWith("::")) return false;
	const firstHextet = addr.split(":")[0];
	if (!firstHextet) return false;
	const first = Number.parseInt(firstHextet, 16);
	if (Number.isNaN(first)) return false;
	if ((first & 0xfe00) === 0xfc00) return false;
	if ((first & 0xffc0) === 0xfe80) return false;
	if ((first & 0xff00) === 0xff00) return false;
	if (first === 0) return false;
	if (addr.startsWith("2001:db8")) return false;
	return true;
}

export function isPublicAddress(address: string): boolean {
	const family = isIP(address);
	if (family === 4) return isPublicIPv4(address);
	if (family === 6) return isPublicIPv6(address);
	return false;
}

export function validateHostnameShape(hostname: string): string {
	if (isIP(hostname) !== 0) {
		if (!isPublicAddress(hostname)) {
			throw new ScanTargetError(
				`"${hostname}" is a private network address and cannot be scanned.`,
			);
		}
		return hostname;
	}
	if (BLOCKED_HOSTNAMES.has(hostname)) {
		throw new ScanTargetError(
			`"${hostname}" is not a public domain and cannot be scanned.`,
		);
	}
	const labels = hostname.split(".");
	if (labels.length < 2) {
		throw new ScanTargetError(
			`"${hostname}" is not a public domain. Enter a domain like example.com.`,
		);
	}
	for (const label of labels) {
		if (
			!label ||
			label.length > 63 ||
			!/^[a-z0-9-]+$/i.test(label) ||
			label.startsWith("-") ||
			label.endsWith("-")
		) {
			throw new ScanTargetError(`"${hostname}" is not a valid domain name.`);
		}
	}
	const tld = labels[labels.length - 1] as string;
	if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(tld)) {
		throw new ScanTargetError(
			`"${hostname}" is not a public domain. Enter a domain like example.com.`,
		);
	}
	if (BLOCKED_TLDS.has(tld.toLowerCase())) {
		throw new ScanTargetError(
			`"${hostname}" uses a private suffix and cannot be scanned.`,
		);
	}
	return hostname;
}

export function normalizeHostname(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) {
		throw new ScanTargetError("Enter a domain to scan.");
	}
	const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
	let url: URL;
	try {
		url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
	} catch {
		throw new ScanTargetError(`"${input}" is not a valid domain or URL.`);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new ScanTargetError(
			`Only http and https URLs can be scanned (got "${url.protocol.replace(":", "")}").`,
		);
	}
	if (url.username || url.password) {
		throw new ScanTargetError("URLs with credentials cannot be scanned.");
	}
	if (url.port && url.port !== "80" && url.port !== "443") {
		throw new ScanTargetError("Only standard ports (80 and 443) are allowed.");
	}
	let hostname = url.hostname.toLowerCase().replace(/\.$/, "");
	if (hostname.startsWith("[") && hostname.endsWith("]")) {
		hostname = hostname.slice(1, -1);
	}
	if (!hostname) {
		throw new ScanTargetError(`"${input}" is not a valid domain or URL.`);
	}
	return validateHostnameShape(hostname);
}
