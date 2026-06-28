import { describe, expect, it } from "bun:test";
import { getScoreTier } from "./score-display";

describe("getScoreTier", () => {
	it("returns 'high' for values >= 70", () => {
		expect(getScoreTier(70)).toBe("high");
		expect(getScoreTier(85)).toBe("high");
		expect(getScoreTier(100)).toBe("high");
	});

	it("returns 'mid' for values >= 40 and < 70", () => {
		expect(getScoreTier(40)).toBe("mid");
		expect(getScoreTier(55)).toBe("mid");
		expect(getScoreTier(69)).toBe("mid");
	});

	it("returns 'low' for values < 40", () => {
		expect(getScoreTier(0)).toBe("low");
		expect(getScoreTier(25)).toBe("low");
		expect(getScoreTier(39)).toBe("low");
	});
});
