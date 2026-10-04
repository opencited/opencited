import { describe, expect, it } from "bun:test";
import { createTargetGuard, resolveTarget } from "../src";
import { ScanTargetError } from "../src/errors";
import { publicLookup } from "./helpers";

describe("resolveTarget", () => {
	it("resolves a public domain", async () => {
		const target = await resolveTarget("example.com", publicLookup);
		expect(target.hostname).toBe("example.com");
		expect(target.httpsUrl).toBe("https://example.com/");
		expect(target.httpUrl).toBe("http://example.com/");
	});

	it("wraps IPv6 literals in brackets for URLs", async () => {
		const target = await resolveTarget(
			"https://[2606:4700:4700::1111]/",
			publicLookup,
		);
		expect(target.httpsUrl).toBe("https://[2606:4700:4700::1111]/");
	});

	it("rejects domains that do not resolve", async () => {
		await expect(
			resolveTarget("example.com", async () => {
				throw new Error("ENOTFOUND");
			}),
		).rejects.toThrow(ScanTargetError);
	});

	it("rejects domains resolving to no addresses", async () => {
		await expect(resolveTarget("example.com", async () => [])).rejects.toThrow(
			ScanTargetError,
		);
	});

	it("rejects domains resolving to private addresses", async () => {
		await expect(
			resolveTarget("example.com", async () => ["10.0.0.5"]),
		).rejects.toThrow(/private network address/);
	});

	it("rejects domains resolving to any private address among public ones", async () => {
		await expect(
			resolveTarget("example.com", async () => ["93.184.216.34", "127.0.0.1"]),
		).rejects.toThrow(/private network address/);
	});
});

describe("createTargetGuard", () => {
	it("allows public http and https URLs", async () => {
		const guard = createTargetGuard(publicLookup);
		await expect(
			guard.assertUrl("https://example.com/path"),
		).resolves.toBeInstanceOf(URL);
		await expect(
			guard.assertUrl("http://example.com/"),
		).resolves.toBeInstanceOf(URL);
	});

	it("rejects non-http protocols", async () => {
		const guard = createTargetGuard(publicLookup);
		await expect(guard.assertUrl("file:///etc/passwd")).rejects.toThrow(
			ScanTargetError,
		);
		await expect(guard.assertUrl("ftp://example.com/")).rejects.toThrow(
			ScanTargetError,
		);
	});

	it("rejects URLs with credentials", async () => {
		const guard = createTargetGuard(publicLookup);
		await expect(
			guard.assertUrl("https://user:pass@example.com/"),
		).rejects.toThrow(ScanTargetError);
	});

	it("rejects non-standard ports", async () => {
		const guard = createTargetGuard(publicLookup);
		await expect(guard.assertUrl("https://example.com:8443/")).rejects.toThrow(
			ScanTargetError,
		);
	});

	it("rejects private IP literal targets", async () => {
		const guard = createTargetGuard(publicLookup);
		await expect(guard.assertUrl("http://192.168.1.1/")).rejects.toThrow(
			ScanTargetError,
		);
		await expect(guard.assertUrl("http://[::1]/")).rejects.toThrow(
			ScanTargetError,
		);
		await expect(guard.assertUrl("http://169.254.169.254/")).rejects.toThrow(
			ScanTargetError,
		);
	});

	it("rejects single-label and private-suffix hostnames", async () => {
		const guard = createTargetGuard(publicLookup);
		await expect(guard.assertUrl("http://localhost/")).rejects.toThrow(
			ScanTargetError,
		);
		await expect(guard.assertUrl("http://printer.local/")).rejects.toThrow(
			ScanTargetError,
		);
	});

	it("rejects hostnames resolving to private addresses", async () => {
		const guard = createTargetGuard(async () => ["10.1.2.3"]);
		await expect(
			guard.assertUrl("https://rebind.example.com/"),
		).rejects.toThrow(/private network address/);
	});

	it("caches DNS lookups per hostname", async () => {
		let calls = 0;
		const guard = createTargetGuard(async () => {
			calls += 1;
			return ["93.184.216.34"];
		});
		await guard.assertUrl("https://example.com/a");
		await guard.assertUrl("https://example.com/b");
		await guard.assertUrl("https://other.com/");
		expect(calls).toBe(2);
	});
});
