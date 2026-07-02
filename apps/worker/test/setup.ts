import { mock } from "bun:test";

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.HEADLESS ??= "true";
process.env.CRAWL_RATE_LIMITS ??= "{}";

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
