import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { TRPCError } from "@trpc/server";

const authState: { userId: string | null; orgId: string | null } = {
	userId: null,
	orgId: null,
};

mock.module("@clerk/nextjs/server", () => ({
	auth: () =>
		Promise.resolve({
			userId: authState.userId,
			orgId: authState.orgId,
			isAuthenticated: authState.userId != null,
		}),
}));

import { appRouter } from "../src/router/root";

type DomainProjectRow = {
	id: string;
	clerkOrganizationId: string | null;
	domain: string;
	name: string | null;
	aliases: unknown;
	logoUrl: string | null;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
};

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
</urlset>`;

function orgIdFromWhere(condition: { queryChunks?: unknown[] } | undefined) {
	for (const chunk of condition?.queryChunks ?? []) {
		if (
			!chunk ||
			typeof chunk !== "object" ||
			chunk.constructor.name !== "Param" ||
			!("value" in chunk)
		) {
			continue;
		}
		const value = chunk.value;
		if (typeof value === "string") return value;
	}
	return undefined;
}

function createMemoryDb(seed: DomainProjectRow[] = []) {
	const rows = [...seed];

	function chain(matched: DomainProjectRow[], isCount: boolean) {
		const result = isCount ? [{ count: matched.length }] : matched;
		const promise = Promise.resolve(result);
		return Object.assign(promise, {
			from() {
				return chain(matched, isCount);
			},
			where(condition: { queryChunks?: unknown[] }) {
				const orgId = orgIdFromWhere(condition);
				const filtered = orgId
					? matched.filter((row) => row.clerkOrganizationId === orgId)
					: matched;
				return chain(filtered, isCount);
			},
			limit(count: number) {
				return chain(matched.slice(0, count), isCount);
			},
			leftJoin() {
				return chain(matched, isCount);
			},
			innerJoin() {
				return chain(matched, isCount);
			},
			groupBy() {
				return chain(matched, isCount);
			},
			orderBy() {
				return chain(matched, isCount);
			},
		});
	}

	function select(shape?: Record<string, unknown>) {
		return chain(rows, shape != null && "count" in shape);
	}

	function insert() {
		return {
			values(input: Partial<DomainProjectRow>) {
				return {
					returning() {
						const now = new Date();
						const row: DomainProjectRow = {
							id: crypto.randomUUID(),
							clerkOrganizationId: input.clerkOrganizationId ?? null,
							domain: input.domain ?? "",
							name: input.name ?? null,
							aliases: input.aliases ?? [],
							logoUrl: input.logoUrl ?? null,
							active: input.active ?? true,
							createdAt: now,
							updatedAt: now,
						};
						rows.push(row);
						return Promise.resolve([row]);
					},
				};
			},
		};
	}

	return { db: { select, insert }, rows };
}

function projectRow(
	orgId: string,
	domain: string,
	id = crypto.randomUUID(),
): DomainProjectRow {
	const now = new Date("2026-01-01T00:00:00.000Z");
	return {
		id,
		clerkOrganizationId: orgId,
		domain,
		name: null,
		aliases: [],
		logoUrl: "https://example.com/logo.png",
		active: true,
		createdAt: now,
		updatedAt: now,
	};
}

function callerFor(
	db: ReturnType<typeof createMemoryDb>["db"],
	orgId: string | null,
	userId: string | null = "user_test",
) {
	authState.userId = userId;
	authState.orgId = orgId;
	return appRouter.createCaller({
		userId,
		isAuthenticated: userId != null,
		db: db as never,
	});
}

async function captureError(
	promise: Promise<unknown>,
): Promise<TRPCError | undefined> {
	try {
		await promise;
		return undefined;
	} catch (err) {
		return err as TRPCError;
	}
}

beforeEach(() => {
	authState.userId = null;
	authState.orgId = null;
});

describe("domainProject onboarding access", () => {
	it("returns null from get when the org has no project", async () => {
		const { db } = createMemoryDb();
		const caller = callerFor(db, "org_new");

		const project = await caller.domainProject.get();

		expect(project).toBeNull();
	});

	it("returns the project from get when the org has one", async () => {
		const row = projectRow("org_ready", "ready.example");
		const { db } = createMemoryDb([row]);
		const caller = callerFor(db, "org_ready");

		const project = await caller.domainProject.get();

		expect(project?.id).toBe(row.id);
		expect(project?.domain).toBe("ready.example");
		expect(project?.clerkOrganizationId).toBe("org_ready");
	});

	it("creates a project for an org that has none and stores ctx.orgId", async () => {
		const memory = createMemoryDb();
		const caller = callerFor(memory.db, "org_new");

		const created = await caller.domainProject.create({
			domain: "example.com",
			logoUrl: "https://example.com/logo.png",
			clerkOrganizationId: "org_attacker",
		});

		expect(created.clerkOrganizationId).toBe("org_new");
		expect(created.domain).toBe("example.com");
		expect(memory.rows).toHaveLength(1);
		expect(memory.rows[0]?.clerkOrganizationId).toBe("org_new");
	});

	it("rejects a second create for the same org with CONFLICT", async () => {
		const memory = createMemoryDb();
		const caller = callerFor(memory.db, "org_new");
		const input = {
			domain: "example.com",
			logoUrl: "https://example.com/logo.png",
		};

		await caller.domainProject.create(input);
		const error = await captureError(caller.domainProject.create(input));

		expect(error?.code).toBe("CONFLICT");
		expect(memory.rows).toHaveLength(1);
	});

	it("reports hasDomainProject from the caller's org only", async () => {
		const { db } = createMemoryDb([projectRow("org_other", "other.example")]);
		const caller = callerFor(db, "org_new");

		await expect(caller.domainProject.hasDomainProject()).resolves.toBe(false);

		const withProject = callerFor(
			createMemoryDb([projectRow("org_ready", "ready.example")]).db,
			"org_ready",
		);
		await expect(withProject.domainProject.hasDomainProject()).resolves.toBe(
			true,
		);
	});

	it("lets discoverSitemaps and sitemap.preview run before a project exists", async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			if (url.endsWith("/sitemap.xml")) {
				return new Response(SITEMAP_XML, {
					status: 200,
					headers: { "content-type": "application/xml" },
				});
			}
			return new Response("not found", { status: 404 });
		}) as typeof fetch;

		try {
			const { db } = createMemoryDb([projectRow("org_other", "other.example")]);
			const caller = callerFor(db, "org_new");

			const discovered = await caller.domainProject.discoverSitemaps({
				domain: "example.com",
			});
			expect(discovered.sitemaps.length).toBeGreaterThan(0);

			const preview = await caller.sitemap.preview({
				sitemapUrl: "https://example.com/sitemap.xml",
			});
			expect(preview.urls.length).toBeGreaterThan(0);
			expect(preview.type).toBe("urlset");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("still rejects orgProtectedProcedure when the org has no project", async () => {
		const { db } = createMemoryDb([projectRow("org_other", "other.example")]);
		const caller = callerFor(db, "org_new");

		const error = await captureError(caller.sitemap.list({}));

		expect(error?.code).toBe("NOT_FOUND");
		expect(error?.message).toBe("Organization not set up");
	});

	it("does not return another org's project from an org-scoped list", async () => {
		const { db } = createMemoryDb([
			projectRow("org_a", "a.example", "project_a"),
			projectRow("org_b", "b.example", "project_b"),
		]);
		const caller = callerFor(db, "org_a");

		const projects = await caller.domainProject.list({});

		expect(projects.map((project) => project.id)).toEqual(["project_a"]);
	});
});
