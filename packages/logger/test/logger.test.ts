import { describe, expect, it } from "bun:test";
import { createLogger } from "../src/logger";
import type { LogLevel, Transport } from "../src/types";

interface LoggedCall {
	level: LogLevel;
	message: string;
	ctx: Record<string, unknown>;
}

class FakeTransport implements Transport {
	calls: LoggedCall[] = [];

	log(level: LogLevel, message: string, ctx: Record<string, unknown>): void {
		this.calls.push({ level, message, ctx });
	}
}

describe("createLogger", () => {
	it("emits error, warn and info but not debug with level info", () => {
		const transport = new FakeTransport();
		const logger = createLogger({ level: "info", transports: [transport] });

		logger.debug("debug message");
		logger.info("info message");
		logger.warn("warn message");
		logger.error("error message");

		expect(transport.calls.map((call) => call.level)).toEqual([
			"info",
			"warn",
			"error",
		]);
	});

	it("emits everything with level debug", () => {
		const transport = new FakeTransport();
		const logger = createLogger({ level: "debug", transports: [transport] });

		logger.debug("debug message");
		logger.info("info message");
		logger.warn("warn message");
		logger.error("error message");

		expect(transport.calls.map((call) => call.level)).toEqual([
			"debug",
			"info",
			"warn",
			"error",
		]);
	});

	it("emits only error with level error", () => {
		const transport = new FakeTransport();
		const logger = createLogger({ level: "error", transports: [transport] });

		logger.debug("debug message");
		logger.info("info message");
		logger.warn("warn message");
		logger.error("error message");

		expect(transport.calls.map((call) => call.level)).toEqual(["error"]);
	});

	it("emits nothing with level off", () => {
		const transport = new FakeTransport();
		const logger = createLogger({ level: "off", transports: [transport] });

		logger.debug("debug message");
		logger.info("info message");
		logger.warn("warn message");
		logger.error("error message");

		expect(transport.calls).toEqual([]);
	});

	it("passes merged context to transports", () => {
		const transport = new FakeTransport();
		const logger = createLogger({ level: "info", transports: [transport] });

		logger.withContext({ jobId: "job-1" }).warn("warn message", {
			status: "degraded",
		});

		expect(transport.calls).toHaveLength(1);
		expect(transport.calls[0]?.ctx).toEqual({
			jobId: "job-1",
			status: "degraded",
		});
	});
});
