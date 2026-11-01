/**
 * Shared helpers for the landing-page scenes.
 *
 * Each scene is a small SVG drawing driven by a clock in seconds. Scene code
 * lives outside React on purpose: the answer text needs real font metrics to
 * wrap and highlight, so the scene builds DOM nodes and measures them once the
 * webfont is ready. The React wrappers only own the stage, the clock and the
 * accessibility attributes.
 *
 * See DESIGN.md §6 "Motion" for the rules these scenes follow.
 */

export const SCENE_COLORS = {
	ink: "#0f172a",
	inkSoft: "#334155",
	hairline: "#94a3b8",
	faint: "#cbd5e1",
	rule: "#e2e8f0",
	text: "#64748b",
	accent: "#059669",
	accentStrong: "#047857",
	accentGlow: "#10b981",
	accentFaint: "#6ee7b7",
	accentHighlight: "#d1fae5",
	accentWash: "#ecfdf5",
	competitor: "#a8a29e",
	competitorStrong: "#78716c",
	competitorWash: "#efedeb",
	paper: "#ffffff",
} as const;

/** Hairline weight for every stroke on the marketing surface. */
export const HAIRLINE = 1.25;

export type SvgAttrs = Record<string, string | number>;

export function clamp(value: number, min = 0, max = 1): number {
	return Math.min(max, Math.max(min, value));
}

/** Normalised progress of `time` between `start` and `end`. */
export function progress(start: number, end: number, time: number): number {
	return clamp((time - start) / (end - start));
}

/** Ease-out cubic. */
export function easeOut(value: number): number {
	return 1 - (1 - clamp(value)) ** 3;
}

/** Ease-in-out cubic. */
export function easeInOut(value: number): number {
	const t = clamp(value);
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Slight overshoot used for "things landing in place". Never used for text. */
export function easeOutBack(value: number): number {
	const t = clamp(value);
	const c1 = 1.5;
	const c3 = c1 + 1;
	return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function lerp(from: number, to: number, amount: number): number {
	return from + (to - from) * amount;
}

export function at<T>(items: readonly T[], index: number): T {
	const item = items[index];
	if (item === undefined) {
		throw new Error(`Scene layout is missing item ${index}`);
	}
	return item;
}

const pathLengths = new WeakMap<SVGGeometryElement, number>();

/** Forget the cached path length, e.g. after the `d` attribute changed. */
export function resetReveal(element: SVGGeometryElement): void {
	pathLengths.delete(element);
}

/** Reveal a stroke from 0 to 1 by animating its dash offset. */
export function reveal(element: SVGGeometryElement, value: number): void {
	const p = clamp(value);
	let length = pathLengths.get(element);
	if (length === undefined) {
		length = element.getTotalLength() + 1;
		pathLengths.set(element, length);
	}
	element.style.strokeDasharray = `${length} ${length}`;
	element.style.strokeDashoffset = `${length * (1 - p)}`;
	element.style.opacity = p <= 0 ? "0" : "";
}

export function setOpacity(element: Element, value: number): void {
	if (element instanceof SVGElement) {
		element.style.opacity = String(clamp(value));
	}
}

export type SegmentKind = 0 | "b" | "c" | "n" | "n1";
export type Segment = readonly [text: string, kind?: SegmentKind];

export type RichUnit = {
	text: string;
	kind: SegmentKind;
	x: number;
	y: number;
	width: number;
};

export type RichText = { units: RichUnit[]; lines: number };

/** Rounded-rectangle path, used for pills and cards. */
export function pill(
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
): string {
	const r = Math.min(radius, width / 2, height / 2);
	return [
		`M${x + r},${y}`,
		`H${x + width - r}`,
		`A${r},${r} 0 0 1 ${x + width},${y + r}`,
		`V${y + height - r}`,
		`A${r},${r} 0 0 1 ${x + width - r},${y + height}`,
		`H${x + r}`,
		`A${r},${r} 0 0 1 ${x},${y + height - r}`,
		`V${y + r}`,
		`A${r},${r} 0 0 1 ${x + r},${y}`,
		"Z",
	].join(" ");
}

export function arcPath(
	cx: number,
	cy: number,
	radius: number,
	from: number,
	to: number,
): string {
	const point = (angle: number) => [
		cx + radius * Math.cos(angle),
		cy + radius * Math.sin(angle),
	];
	const [x0, y0] = point(from);
	const [x1, y1] = point(to);
	const largeArc = Math.abs(to - from) > Math.PI ? 1 : 0;
	return `M${x0},${y0} A${radius},${radius} 0 ${largeArc} 1 ${x1},${y1}`;
}

/**
 * Builds SVG nodes and measures text with the real webfont.
 * One instance per scene build.
 */
export class SvgCanvas {
	readonly svg: SVGSVGElement;
	private readonly measurer: SVGTextElement;

	constructor(svg: SVGSVGElement) {
		this.svg = svg;
		this.measurer = this.el("text", {
			x: -9999,
			y: -9999,
			opacity: 0,
			"aria-hidden": "true",
		});
	}

	el<K extends keyof SVGElementTagNameMap>(
		tag: K,
		attrs: SvgAttrs,
		parent: SVGElement = this.svg,
	): SVGElementTagNameMap[K] {
		const element = document.createElementNS(
			"http://www.w3.org/2000/svg",
			tag,
		) as SVGElementTagNameMap[K];
		for (const [key, value] of Object.entries(attrs)) {
			element.setAttribute(key, String(value));
		}
		parent.appendChild(element);
		return element;
	}

	stroke<K extends keyof SVGElementTagNameMap>(
		tag: K,
		attrs: SvgAttrs,
		parent: SVGElement = this.svg,
		color: string = SCENE_COLORS.hairline,
	): SVGElementTagNameMap[K] {
		return this.el(
			tag,
			{ fill: "none", stroke: color, "stroke-width": HAIRLINE, ...attrs },
			parent,
		);
	}

	text(
		value: string,
		x: number,
		y: number,
		attrs: SvgAttrs = {},
		parent: SVGElement = this.svg,
	): SVGTextElement {
		const element = this.el("text", { x, y, ...attrs }, parent);
		element.textContent = value;
		return element;
	}

	/** Advance width of `value` at `size`, in user units. */
	measure(value: string, size: number, weight = 400, mono = false): number {
		this.measurer.setAttribute("font-size", String(size));
		this.measurer.setAttribute("font-weight", String(weight));
		this.measurer.setAttribute("class", mono ? "mono" : "");
		this.measurer.textContent = value;
		return this.measurer.getComputedTextLength();
	}

	/**
	 * Lay out rich text: plain segments wrap on spaces, marks stay unbreakable
	 * so a brand or competitor name never splits across lines.
	 */
	rich(
		segments: readonly Segment[],
		maxWidth: number,
		size: number,
		lineHeight: number,
		weight = 400,
	): RichText {
		type Part = { text: string; kind: SegmentKind; space?: boolean };
		const parts: Part[] = [];
		for (const [raw, kind] of segments) {
			if (kind) {
				parts.push({ text: raw, kind });
				continue;
			}
			for (const word of raw.split(/(\s+)/)) {
				if (word) {
					parts.push({ text: word, kind: 0, space: /^\s+$/.test(word) });
				}
			}
		}

		const spaceWidth =
			this.measure("a a", size, weight) - this.measure("aa", size, weight);
		const units: RichUnit[] = [];
		let x = 0;
		let y = 0;
		for (const part of parts) {
			if (part.space) {
				x += spaceWidth;
				continue;
			}
			const width = this.measure(
				part.text,
				size,
				part.kind === "b" ? 600 : weight,
			);
			if (x > 0 && x + width > maxWidth) {
				x = 0;
				y += lineHeight;
			}
			units.push({ text: part.text, kind: part.kind, x, y, width });
			x += width;
		}
		return { units, lines: Math.round(y / lineHeight) + 1 };
	}
}
