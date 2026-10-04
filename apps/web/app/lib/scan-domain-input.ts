function parseScanDomainHostname(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) {
		return null;
	}
	try {
		const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
		const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return null;
		}
		let hostname = url.hostname.toLowerCase().replace(/\.$/, "");
		if (hostname.startsWith("[") && hostname.endsWith("]")) {
			hostname = hostname.slice(1, -1);
		}
		return hostname || null;
	} catch {
		return null;
	}
}

/** Canonical hostname for display when input is valid (not DNS-verified). */
export function normalizeScanDomainDisplay(input: string): string | null {
	if (!isValidScanDomainInput(input)) {
		return null;
	}
	return parseScanDomainHostname(input);
}

/** Client-side check aligned with public scan hostname rules (not DNS). */
export function isValidScanDomainInput(input: string): boolean {
	const trimmed = input.trim();
	if (!trimmed) {
		return false;
	}
	try {
		const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
		const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return false;
		}
		if (url.username || url.password) {
			return false;
		}
		if (url.port && url.port !== "80" && url.port !== "443") {
			return false;
		}
		let hostname = url.hostname.toLowerCase().replace(/\.$/, "");
		if (hostname.startsWith("[") && hostname.endsWith("]")) {
			hostname = hostname.slice(1, -1);
		}
		if (!hostname) {
			return false;
		}
		const labels = hostname.split(".");
		if (labels.length < 2) {
			return false;
		}
		for (const label of labels) {
			if (
				!label ||
				label.length > 63 ||
				!/^[a-z0-9-]+$/i.test(label) ||
				label.startsWith("-") ||
				label.endsWith("-")
			) {
				return false;
			}
		}
		const tld = labels[labels.length - 1] as string;
		if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(tld)) {
			return false;
		}
		return true;
	} catch {
		return false;
	}
}
