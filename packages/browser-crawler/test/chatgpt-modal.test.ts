import { describe, expect, it, mock } from "bun:test";
import { ChatGPTProvider } from "../src/providers/chatgpt";
import type { BrowserSession } from "../src/types";

function createMockSession(
	options: { dialogPresent?: boolean; buttonFound?: boolean } = {},
): BrowserSession {
	const { dialogPresent = false, buttonFound = true } = options;

	const evaluateCalls: Array<{ fn: string; args: unknown }> = [];
	let timeoutMs = 0;

	let gotoUrl: string | undefined;

	const fakePage = {
		url: () => "https://chatgpt.com/",
		title: () => Promise.resolve("ChatGPT"),
		goto: mock((url: string, _opts?: unknown) => {
			gotoUrl = url;
			return Promise.resolve();
		}),
		waitForTimeout: (ms: number) => {
			timeoutMs = ms;
			return Promise.resolve();
		},
		evaluate: mock((fnOrFn: Function | string, args?: unknown) => {
			const fnStr = typeof fnOrFn === "function" ? fnOrFn.toString() : fnOrFn;
			evaluateCalls.push({ fn: fnStr, args });
			if (fnStr.includes("dialog")) {
				return Promise.resolve(dialogPresent);
			}
			if (fnStr.includes("button")) {
				return Promise.resolve(buttonFound);
			}
			return Promise.resolve(false);
		}),
	};

	return {
		browser: {} as never,
		context: {} as never,
		page: fakePage as never,
		_getState: () => ({
			evaluateCalls,
			timeoutMs,
			gotoUrl,
		}),
	} as unknown as BrowserSession & {
		_getState: () => {
			evaluateCalls: typeof evaluateCalls;
			timeoutMs: number;
			gotoUrl: string | undefined;
		};
	};
}

describe("ChatGPTProvider.modal dismissal", () => {
	it("clicks 'Stay logged out' when auth modal is present", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			dialogPresent: true,
			buttonFound: true,
		}) as BrowserSession & { _getState: () => { timeoutMs: number } };

		await provider.beforePrompt(session, "test query");

		const state = session._getState();
		expect(state.timeoutMs).toBe(500);
	});

	it("is a no-op when no auth modal is present", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			dialogPresent: false,
		}) as BrowserSession & { _getState: () => { timeoutMs: number } };

		await provider.beforePrompt(session, "test query");

		const state = session._getState();
		expect(state.timeoutMs).toBe(0);
	});

	it("beforePrompt uses 500ms timeout", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			dialogPresent: true,
			buttonFound: true,
		}) as BrowserSession & { _getState: () => { timeoutMs: number } };

		await provider.beforePrompt(session, "query");
		expect(session._getState().timeoutMs).toBe(500);
	});

	it("afterTyping uses 1500ms timeout", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			dialogPresent: true,
			buttonFound: true,
		}) as BrowserSession & { _getState: () => { timeoutMs: number } };

		await provider.afterTyping(session, "query");
		expect(session._getState().timeoutMs).toBe(1500);
	});

	it("beforeSubmit uses 1500ms timeout", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			dialogPresent: true,
			buttonFound: true,
		}) as BrowserSession & { _getState: () => { timeoutMs: number } };

		await provider.beforeSubmit(session, "query");
		expect(session._getState().timeoutMs).toBe(1500);
	});

	it("afterSubmit uses 1500ms timeout", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			dialogPresent: true,
			buttonFound: true,
		}) as BrowserSession & { _getState: () => { timeoutMs: number } };

		await provider.afterSubmit(session, "query");
		expect(session._getState().timeoutMs).toBe(1500);
	});
});

describe("ChatGPTProvider.navigate", () => {
	it("navigates to chatgpt.com", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession() as BrowserSession & {
			_getState: () => { gotoUrl: string | undefined };
		};

		await provider.navigate(session);

		expect(session._getState().gotoUrl).toBe("https://chatgpt.com/");
	});
});

describe("ChatGPTProvider.PROVIDER_TIMINGS", () => {
	it("exports expected timing constants", () => {
		const { PROVIDER_TIMINGS } = require("../src/providers/chatgpt");
		expect(PROVIDER_TIMINGS.noOutputTimeout).toBe(90_000);
		expect(PROVIDER_TIMINGS.forceExitStable).toBe(45_000);
		expect(PROVIDER_TIMINGS.typing.chunkMin).toBe(3);
		expect(PROVIDER_TIMINGS.typing.chunkMax).toBe(8);
		expect(PROVIDER_TIMINGS.click.delayMin).toBe(35);
		expect(PROVIDER_TIMINGS.click.delayMax).toBe(120);
	});
});
