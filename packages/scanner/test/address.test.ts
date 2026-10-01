import { describe, expect, it } from "bun:test";
import { isPublicAddress, normalizeHostname } from "../src";
import { ScanTargetError } from "../src/errors";

describe("isPublicAddress", () => {
	it("accepts public IPv4 addresses", () => {
		expect(isPublicAddress("93.184.216.34")).toBe(true);
		expect(isPublicAddress("8.8.8.8")).toBe(true);
		expect(isPublicAddress("1.1.1.1")).toBe(true);
		expect(isPublicAddress("172.15.0.1")).toBe(true);
		expect(isPublicAddress("172.32.0.1")).toBe(true);
		expect(isPublicAddress("192.169.0.1")).toBe(true);
	});

	it("rejects private, loopback and reserved IPv4 addresses", () => {
		expect(isPublicAddress("10.0.0.1")).toBe(false);
		expect(isPublicAddress("127.0.0.1")).toBe(false);
		expect(isPublicAddress("169.254.169.254")).toBe(false);
		expect(isPublicAddress("172.16.0.1")).toBe(false);
		expect(isPublicAddress("172.31.255.255")).toBe(false);
		expect(isPublicAddress("192.168.1.1")).toBe(false);
		expect(isPublicAddress("192.0.0.1")).toBe(false);
		expect(isPublicAddress("100.64.0.1")).toBe(false);
		expect(isPublicAddress("100.127.0.1")).toBe(false);
		expect(isPublicAddress("198.18.0.1")).toBe(false);
		expect(isPublicAddress("0.0.0.0")).toBe(false);
		expect(isPublicAddress("224.0.0.1")).toBe(false);
		expect(isPublicAddress("255.255.255.255")).toBe(false);
	});

	it("accepts public IPv6 addresses", () => {
		expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
		expect(isPublicAddress("2001:4860:4860::8888")).toBe(true);
	});

	it("rejects loopback, link-local, ULA and mapped-private IPv6 addresses", () => {
		expect(isPublicAddress("::1")).toBe(false);
		expect(isPublicAddress("::")).toBe(false);
		expect(isPublicAddress("fe80::1")).toBe(false);
		expect(isPublicAddress("fc00::1")).toBe(false);
		expect(isPublicAddress("fd12:3456::1")).toBe(false);
		expect(isPublicAddress("ff02::1")).toBe(false);
		expect(isPublicAddress("::ffff:10.0.0.1")).toBe(false);
		expect(isPublicAddress("::ffff:192.168.1.1")).toBe(false);
		expect(isPublicAddress("2001:db8::1")).toBe(false);
	});

	it("rejects non-IP strings", () => {
		expect(isPublicAddress("example.com")).toBe(false);
		expect(isPublicAddress("")).toBe(false);
	});
});

describe("normalizeHostname", () => {
	it("accepts bare domains and full URLs", () => {
		expect(normalizeHostname("example.com")).toBe("example.com");
		expect(normalizeHostname("https://example.com")).toBe("example.com");
		expect(normalizeHostname("http://example.com/path?q=1")).toBe(
			"example.com",
		);
		expect(normalizeHostname("  Example.COM  ")).toBe("example.com");
		expect(normalizeHostname("example.com.")).toBe("example.com");
		expect(normalizeHostname("www.example.com")).toBe("www.example.com");
	});

	it("accepts public IP literals", () => {
		expect(normalizeHostname("93.184.216.34")).toBe("93.184.216.34");
		expect(normalizeHostname("https://[2606:4700:4700::1111]/")).toBe(
			"2606:4700:4700::1111",
		);
	});

	it("rejects empty input", () => {
		expect(() => normalizeHostname("")).toThrow(ScanTargetError);
		expect(() => normalizeHostname("   ")).toThrow(ScanTargetError);
	});

	it("rejects localhost and single-label hostnames", () => {
		expect(() => normalizeHostname("localhost")).toThrow(ScanTargetError);
		expect(() => normalizeHostname("myhost")).toThrow(ScanTargetError);
	});

	it("rejects private suffixes", () => {
		expect(() => normalizeHostname("foo.local")).toThrow(ScanTargetError);
		expect(() => normalizeHostname("nas.lan")).toThrow(ScanTargetError);
		expect(() => normalizeHostname("a.internal")).toThrow(ScanTargetError);
		expect(() => normalizeHostname("foo.onion")).toThrow(ScanTargetError);
	});

	it("rejects private IP literals", () => {
		expect(() => normalizeHostname("192.168.1.1")).toThrow(ScanTargetError);
		expect(() => normalizeHostname("127.0.0.1")).toThrow(ScanTargetError);
		expect(() => normalizeHostname("10.0.0.1")).toThrow(ScanTargetError);
		expect(() => normalizeHostname("169.254.169.254")).toThrow(ScanTargetError);
		expect(() => normalizeHostname("0.0.0.0")).toThrow(ScanTargetError);
		expect(() => normalizeHostname("2130706433")).toThrow(ScanTargetError);
		expect(() => normalizeHostname("http://[::1]/")).toThrow(ScanTargetError);
	});

	it("rejects credentials, non-http schemes and custom ports", () => {
		expect(() => normalizeHostname("https://user:pass@example.com")).toThrow(
			ScanTargetError,
		);
		expect(() => normalizeHostname("ftp://example.com")).toThrow(
			ScanTargetError,
		);
		expect(() => normalizeHostname("example.com:8080")).toThrow(
			ScanTargetError,
		);
		expect(() => normalizeHostname("https://example.com:3000/")).toThrow(
			ScanTargetError,
		);
	});

	it("allows standard ports", () => {
		expect(normalizeHostname("https://example.com:443/")).toBe("example.com");
		expect(normalizeHostname("http://example.com:80/")).toBe("example.com");
	});
});
