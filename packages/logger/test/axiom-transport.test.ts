import { describe, expect, it } from "bun:test";
import { type AxiomClient, AxiomTransport } from "../src/transports/axiom";

interface IngestedEvent {
	level?: string;
	message?: string;
	status?: string;
	[key: string]: unknown;
}

function createFakeAxiomClient() {
	const ingested: Array<{ dataset: string; events: IngestedEvent[] }> = [];

	const client: AxiomClient = {
		ingest(dataset, events) {
			ingested.push({
				dataset,
				events: (Array.isArray(events) ? events : [events]) as IngestedEvent[],
			});
			return Promise.resolve();
		},
		flush() {
			return Promise.resolve();
		},
	};

	return { client, ingested };
}

describe("AxiomTransport", () => {
	it("ingests warn events when its level is info", () => {
		const { client, ingested } = createFakeAxiomClient();
		const transport = new AxiomTransport({
			level: "info",
			client,
			dataset: "worker-app",
		});

		transport.log("warn", "crawl_health_check", { status: "degraded" });

		expect(ingested).toHaveLength(1);
		expect(ingested[0]?.dataset).toBe("worker-app");
		expect(ingested[0]?.events).toHaveLength(1);
		expect(ingested[0]?.events[0]).toMatchObject({
			level: "warn",
			message: "crawl_health_check",
			status: "degraded",
		});
	});

	it("drops debug events when its level is info", () => {
		const { client, ingested } = createFakeAxiomClient();
		const transport = new AxiomTransport({
			level: "info",
			client,
			dataset: "worker-app",
		});

		transport.log("debug", "debug message", {});

		expect(ingested).toEqual([]);
	});

	it("ingests nothing when its level is off", () => {
		const { client, ingested } = createFakeAxiomClient();
		const transport = new AxiomTransport({
			level: "off",
			client,
			dataset: "worker-app",
		});

		transport.log("error", "error message", {});
		transport.log("warn", "warn message", {});
		transport.log("info", "info message", {});
		transport.log("debug", "debug message", {});

		expect(ingested).toEqual([]);
	});
});
