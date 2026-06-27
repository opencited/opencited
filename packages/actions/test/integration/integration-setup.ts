import { mock } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(__dirname, "../../../../.env.local");
if (existsSync(envPath)) {
	const content = readFileSync(envPath, "utf-8");
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIdx = trimmed.indexOf("=");
		if (eqIdx === -1) continue;
		const key = trimmed.slice(0, eqIdx);
		const value = trimmed.slice(eqIdx + 1);
		if (key && value) {
			process.env[key] = value;
		}
	}
}

process.env.LLM_PROVIDER ??= "groq";
process.env.LLM_MODEL ??= "qwen/qwen3-32b";

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
