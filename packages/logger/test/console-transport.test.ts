import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { ConsoleTransport } from "../src/transports/console";

const spies: Array<{ mockRestore(): void }> = [];

afterEach(() => {
	for (const spy of spies.splice(0)) {
		spy.mockRestore();
	}
});

function spyOnConsole() {
	const debug = spyOn(console, "debug").mockImplementation(() => {});
	const log = spyOn(console, "log").mockImplementation(() => {});
	const warn = spyOn(console, "warn").mockImplementation(() => {});
	const error = spyOn(console, "error").mockImplementation(() => {});
	spies.push(debug, log, warn, error);
	return { debug, log, warn, error };
}

describe("ConsoleTransport", () => {
	it("writes warn and error but not debug when its level is info", () => {
		const consoleSpies = spyOnConsole();
		const transport = new ConsoleTransport({ level: "info", pretty: false });

		transport.log("debug", "debug message", {});
		transport.log("info", "info message", {});
		transport.log("warn", "warn message", {});
		transport.log("error", "error message", {});

		expect(consoleSpies.debug).not.toHaveBeenCalled();
		expect(consoleSpies.log).toHaveBeenCalledTimes(1);
		expect(consoleSpies.warn).toHaveBeenCalledTimes(1);
		expect(consoleSpies.error).toHaveBeenCalledTimes(1);
	});

	it("writes nothing when its level is off", () => {
		const consoleSpies = spyOnConsole();
		const transport = new ConsoleTransport({ level: "off", pretty: false });

		transport.log("error", "error message", {});
		transport.log("warn", "warn message", {});
		transport.log("info", "info message", {});
		transport.log("debug", "debug message", {});

		expect(consoleSpies.debug).not.toHaveBeenCalled();
		expect(consoleSpies.log).not.toHaveBeenCalled();
		expect(consoleSpies.warn).not.toHaveBeenCalled();
		expect(consoleSpies.error).not.toHaveBeenCalled();
	});
});
