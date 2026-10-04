import { describe, expect, it } from "bun:test";
import { createTargetGuard, fetchGuarded } from "../src";
import { FetchError, ScanTargetError } from "../src/errors";
import { makeRedirect, makeText, mockFetcher, publicLookup } from "./helpers";

function guard() {
	return createTargetGuard(publicLookup);
}

describe("fetchGuarded", () => {
	it("returns the response for a direct 200", async () => {
		const { fetcher, calls } = mockFetcher({
			"https://example.com/": () => makeText("hello"),
		});
		const result = await fetchGuarded("https://example.com/", {
			fetcher,
			guard: guard(),
		});
		expect(result.status).toBe(200);
		expect(result.body).toBe("hello");
		expect(result.finalUrl).toBe("https://example.com/");
		expect(result.redirects).toEqual([]);
		expect(calls).toHaveLength(1);
	});

	it("follows redirect chains manually", async () => {
		const { fetcher, calls } = mockFetcher({
			"http://example.com/": () => makeRedirect("https://example.com/"),
			"https://example.com/": () => makeRedirect("https://www.example.com/"),
			"https://www.example.com/": () => makeText("final"),
		});
		const result = await fetchGuarded("http://example.com/", {
			fetcher,
			guard: guard(),
		});
		expect(result.status).toBe(200);
		expect(result.finalUrl).toBe("https://www.example.com/");
		expect(result.redirects).toEqual([
			"https://example.com/",
			"https://www.example.com/",
		]);
		expect(calls).toEqual([
			"http://example.com/",
			"https://example.com/",
			"https://www.example.com/",
		]);
	});

	it("resolves relative redirect locations", async () => {
		const { fetcher } = mockFetcher({
			"https://example.com/old": () => makeRedirect("/new", 302),
			"https://example.com/new": () => makeText("ok"),
		});
		const result = await fetchGuarded("https://example.com/old", {
			fetcher,
			guard: guard(),
		});
		expect(result.finalUrl).toBe("https://example.com/new");
		expect(result.status).toBe(200);
	});

	it("throws FetchError when redirected too many times", async () => {
		const { fetcher } = mockFetcher({
			"https://example.com/": () => makeRedirect("https://example.com/loop"),
			"https://example.com/loop": () => makeRedirect("https://example.com/"),
		});
		await expect(
			fetchGuarded("https://example.com/", { fetcher, guard: guard() }),
		).rejects.toThrow(FetchError);
	});

	it("blocks redirects to private network addresses", async () => {
		const { fetcher, calls } = mockFetcher({
			"https://example.com/": () =>
				makeRedirect("http://169.254.169.254/latest/meta-data/"),
		});
		await expect(
			fetchGuarded("https://example.com/", { fetcher, guard: guard() }),
		).rejects.toThrow(ScanTargetError);
		await Promise.resolve();
		expect(calls).toEqual(["https://example.com/"]);
	});

	it("blocks redirects to non-standard ports", async () => {
		const { fetcher } = mockFetcher({
			"https://example.com/": () => makeRedirect("https://example.com:8443/"),
		});
		await expect(
			fetchGuarded("https://example.com/", { fetcher, guard: guard() }),
		).rejects.toThrow(ScanTargetError);
	});

	it("blocks redirects to http schemes with credentials", async () => {
		const { fetcher } = mockFetcher({
			"https://example.com/": () =>
				makeRedirect("https://user:pass@example.com/"),
		});
		await expect(
			fetchGuarded("https://example.com/", { fetcher, guard: guard() }),
		).rejects.toThrow(ScanTargetError);
	});

	it("returns non-2xx responses instead of throwing", async () => {
		const { fetcher } = mockFetcher({
			"https://example.com/robots.txt": () => makeText("nope", 404),
		});
		const result = await fetchGuarded("https://example.com/robots.txt", {
			fetcher,
			guard: guard(),
		});
		expect(result.status).toBe(404);
		expect(result.body).toBe("nope");
	});

	it("wraps network failures in FetchError", async () => {
		const fetcher = async (): Promise<Response> => {
			throw new Error("connection refused");
		};
		await expect(
			fetchGuarded("https://example.com/", { fetcher, guard: guard() }),
		).rejects.toThrow(FetchError);
	});
});
