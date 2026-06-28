import { mock } from "bun:test";

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.LLM_PROVIDER ??= "openai";
process.env.LLM_MODEL ??= "test-model";
process.env.LLM_API_KEY ??= "test-key";
process.env.REDIS_URL ??= "redis://localhost:6379";

// drizzle-orm pulls in @opentelemetry/api, which has ESM subpath-import
// problems under some test runners. We don't need otel in these tests, so
// stub its public surface. The real package is never loaded.
mock.module("@opentelemetry/api", () => ({
	trace: {
		getTracer: () => ({
			startSpan: (_name: string, _opts: unknown, fn: unknown) => {
				if (typeof fn === "function") return fn({}, { active: () => ({}) });
				return {};
			},
		}),
	},
	context: {
		active: () => ({}),
		with: (_ctx: unknown, fn: (...args: unknown[]) => unknown) => fn(),
	},
	propagation: { getBaggage: () => undefined },
	metrics: { getMeter: () => ({}) },
	diag: { setLogger: () => {}, createDiagLogger: () => ({}) },
	SpanStatusCode: { OK: 0, ERROR: 1, UNSET: 2 },
	SpanKind: { INTERNAL: 0, SERVER: 1, CLIENT: 2, PRODUCER: 3, CONSUMER: 4 },
	ValueType: { INT: 0, DOUBLE: 1 },
}));

mock.module("@clerk/nextjs/server", () => ({
	auth: () => Promise.resolve({ orgId: null, userId: null }),
}));
