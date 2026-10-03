"use client";

import { useEffect, useState } from "react";

export function useRotatingLine(
	lines: readonly string[],
	intervalMs = 3200,
): string {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		if (lines.length <= 1) {
			return;
		}
		const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		const step = motionQuery.matches ? lines.length : 1;
		const id = window.setInterval(() => {
			setIndex((current) => (current + step) % lines.length);
		}, intervalMs);
		return () => window.clearInterval(id);
	}, [lines, intervalMs]);

	const line = lines[index] ?? lines[0];
	return line ?? "";
}
