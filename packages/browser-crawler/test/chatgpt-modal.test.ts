import { describe, expect, it, mock } from "bun:test";
import { ChatGPTProvider } from "../src/providers/chatgpt";
import type { BrowserSession } from "../src/types";

function createMockSession(
	options: { dialogPresent?: boolean } = {},
): BrowserSession {
	const { dialogPresent = false } = options;

	const evaluateCalls: Array<{ fn: string; args: unknown }> = [];
	const waitForTimeoutCalls: number[] = [];
	const pressCalls: string[] = [];

	let dialogVisible = dialogPresent;
	let gotoUrl: string | undefined;

	const fakePage = {
		url: () => "https://chatgpt.com/",
		title: () => Promise.resolve("ChatGPT"),
		goto: mock((url: string, _opts?: unknown) => {
			gotoUrl = url;
			return Promise.resolve();
		}),
		waitForTimeout: mock((ms: number) => {
			waitForTimeoutCalls.push(ms);
			return Promise.resolve();
		}),
		keyboard: {
			press: mock((key: string) => {
				pressCalls.push(key);
				if (key === "Escape") {
					dialogVisible = false;
				}
				return Promise.resolve();
			}),
		},
		press: mock((key: string) => {
			pressCalls.push(key);
			if (key === "Escape") {
				dialogVisible = false;
			}
			return Promise.resolve();
		}),
		evaluate: mock((fnOrFn: Function | string, args?: unknown) => {
			const fnStr = typeof fnOrFn === "function" ? fnOrFn.toString() : fnOrFn;
			evaluateCalls.push({ fn: fnStr, args });
			if (fnStr.includes("querySelectorAll")) {
				return Promise.resolve(dialogVisible);
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
			waitForTimeoutCalls,
			pressCalls,
			gotoUrl,
		}),
	} as unknown as BrowserSession & {
		_getState: () => {
			evaluateCalls: typeof evaluateCalls;
			waitForTimeoutCalls: number[];
			pressCalls: string[];
			gotoUrl: string | undefined;
		};
	};
}

describe("ChatGPTProvider.modal dismissal", () => {
	it("dismisses auth modal via Escape (no button click) when present", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			dialogPresent: true,
		}) as BrowserSession & {
			_getState: () => { pressCalls: string[]; waitForTimeoutCalls: number[] };
		};

		await provider.beforePrompt(session, "test query");

		const state = session._getState();
		expect(state.pressCalls).toContain("Escape");
		expect(state.waitForTimeoutCalls[0]).toBe(500);
	});

	it("is a no-op when no auth modal is present", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			dialogPresent: false,
		}) as BrowserSession & {
			_getState: () => { pressCalls: string[]; waitForTimeoutCalls: number[] };
		};

		await provider.beforePrompt(session, "test query");

		const state = session._getState();
		expect(state.pressCalls).not.toContain("Escape");
		expect(state.waitForTimeoutCalls).toHaveLength(0);
	});

	it("beforePrompt uses 500ms initial wait", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			dialogPresent: true,
		}) as BrowserSession & {
			_getState: () => { waitForTimeoutCalls: number[] };
		};

		await provider.beforePrompt(session, "query");
		expect(session._getState().waitForTimeoutCalls[0]).toBe(500);
	});

	it("afterTyping uses 1500ms initial wait", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			dialogPresent: true,
		}) as BrowserSession & {
			_getState: () => { waitForTimeoutCalls: number[] };
		};

		await provider.afterTyping(session, "query");
		expect(session._getState().waitForTimeoutCalls[0]).toBe(1500);
	});

	it("beforeSubmit uses 1500ms initial wait", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			dialogPresent: true,
		}) as BrowserSession & {
			_getState: () => { waitForTimeoutCalls: number[] };
		};

		await provider.beforeSubmit(session, "query");
		expect(session._getState().waitForTimeoutCalls[0]).toBe(1500);
	});

	it("afterSubmit uses 1500ms initial wait", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			dialogPresent: true,
		}) as BrowserSession & {
			_getState: () => { waitForTimeoutCalls: number[] };
		};

		await provider.afterSubmit(session, "query");
		expect(session._getState().waitForTimeoutCalls[0]).toBe(1500);
	});

	it("does not click the 'Stay logged out' button (clicking it submits the form)", async () => {
		const provider = new ChatGPTProvider();
		const session = createMockSession({
			dialogPresent: true,
		}) as BrowserSession & {
			_getState: () => { evaluateCalls: Array<{ fn: string }> };
		};

		await provider.beforePrompt(session, "query");

		const state = session._getState();
		const clickedButton = state.evaluateCalls.some((c) =>
			c.fn.includes("(btn as HTMLElement).click()"),
		);
		expect(clickedButton).toBe(false);
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
