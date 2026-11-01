import {
	at,
	easeInOut,
	easeOut,
	HAIRLINE,
	lerp,
	pill,
	progress,
	resetReveal,
	SCENE_COLORS as C,
	type SegmentKind,
	setOpacity,
	type SvgCanvas,
	reveal,
} from "./engine";
import type { SceneDefinition, SceneLayout } from "./use-scene";

const QUERY = "What's the best CRM for a small agency?";
const DURATION = 11;

const TEXT: readonly (readonly [string, SegmentKind])[] = [
	["For a small agency, ", 0],
	["Acme CRM", "b"],
	[
		" is a strong choice: it's quick to set up, includes client portals and is priced per seat",
		0,
	],
	["1", "n1"],
	[". ", 0],
	["Northwind", "c"],
	[" offers deeper automation but suits larger teams", 0],
	["2", "n"],
	[", while ", 0],
	["Globex", "c"],
	[" is the cheapest option with fewer reporting features", 0],
	["3", "n"],
	[". Many agencies start with ", 0],
	["Acme CRM", "b"],
	[" and grow into it", 0],
	["1", "n1"],
	[".", 0],
];

const SOURCES = [
	{ marker: "1", domain: "acmecrm.com/agencies", mine: true },
	{ marker: "2", domain: "northwind.io/blog", mine: false },
	{ marker: "3", domain: "g2.com/crm", mine: false },
] as const;

const TEXT_START = 1.7;
const TEXT_END = 3.6;
const HIGHLIGHT_START = 4.25;
const HIGHLIGHT_DURATION = 0.27;
const HIGHLIGHT_GAP = 0.03;
const FOLD_START = 6.5;
const FOLD_END = 7.6;

type MarkKind = "mention" | "citation" | "competitor";

const MARK_KIND: Record<string, MarkKind> = {
	b: "mention",
	n1: "citation",
	c: "competitor",
};

/** Stagger order when the folded tokens hand over to the report row. */
const CELL_ORDER: Record<string, number> = {
	e: 0,
	q: 0,
	mention: 2,
	citation: 3,
	competitor: 4,
};

type Box = { x: number; y: number; w: number; h: number };
type SourceChipLayout = {
	marker: string;
	domain: string;
	mine: boolean;
	x: number;
	y: number;
	w: number;
};

type AnswerLayout = SceneLayout & {
	mobile: boolean;
	fontSize: number;
	lineHeight: number;
	text: ReturnType<SvgCanvas["rich"]>;
	chips: SourceChipLayout[];
	card: Box;
	row: Box;
	ghosts: Box[];
};

function layout(mobile: boolean, canvas: SvgCanvas): AnswerLayout {
	const fontSize = mobile ? 13.5 : 14.5;
	const lineHeight = mobile ? 22 : 24;
	const cardWidth = mobile ? 345 : 620;
	const initialTop = 40;
	const markerGap = 4;

	const segments = TEXT.map(
		([value, kind]) =>
			[kind === "n" || kind === "n1" ? `[${value}]` : value, kind] as const,
	);
	const text = canvas.rich(segments, cardWidth - 36 - 12, fontSize, lineHeight);

	// Breathing room before citation markers.
	let shift = 0;
	let lastLine = -1;
	for (const unit of text.units) {
		if (unit.y !== lastLine) {
			shift = 0;
			lastLine = unit.y;
		}
		if (unit.kind === "n" || unit.kind === "n1") {
			shift += markerGap;
		}
		unit.x += shift;
	}

	let chipX = 0;
	let chipRow = 0;
	const chips: SourceChipLayout[] = SOURCES.map((source) => {
		const w = canvas.measure(source.domain, 10.5, 500, true) + 34;
		if (chipX && chipX + w > cardWidth - 36) {
			chipX = 0;
			chipRow += 28;
		}
		const chip = { ...source, x: chipX, y: chipRow, w };
		chipX += w + 8;
		return chip;
	});

	const height = 98 + text.lines * lineHeight + 14 + 18 + chipRow + 22 + 18;
	const cardTop = mobile
		? initialTop
		: Math.round(
				30 +
					Math.max(
						10,
						(Math.max(initialTop + height + 4, 346) - 30 - height) / 2,
					),
			);
	const stageHeight = Math.max(initialTop + height + 4, 346);
	const rowTop = 30 + Math.max(0, (stageHeight - 30 - 312) / 2) + 58;

	return {
		W: cardWidth,
		H: stageHeight,
		mobile,
		fontSize,
		lineHeight,
		text,
		chips,
		card: { x: 0, y: cardTop, w: cardWidth, h: height },
		row: { x: 0, y: rowTop, w: cardWidth, h: 108 },
		ghosts: [
			{ x: 0, y: rowTop - 58, w: cardWidth, h: 46 },
			{ x: 0, y: rowTop + 120, w: cardWidth, h: 46 },
			{ x: 0, y: rowTop + 178, w: cardWidth, h: 46 },
		],
	};
}

type ChipNode = {
	group: SVGGElement;
	fill: SVGPathElement;
	box: SVGPathElement;
	markerText: SVGTextElement;
	domainText: SVGTextElement;
	x: number;
	y: number;
	w: number;
};

type MarkNode = {
	kind: "b" | "n1" | "c";
	x: number;
	y: number;
	width: number;
	layer: SVGElement | null;
	box: SVGPathElement | null;
	text: SVGTextElement;
	chipNode: ChipNode | null;
	start: number;
};

type UnitNode = {
	index: number;
	textNode: SVGTextElement;
	markerBox: SVGPathElement | null;
};

type TokenKind = "e" | "q" | "mention" | "citation" | "competitor";

type TokenNode = {
	group: SVGGElement;
	x: number;
	y: number;
	kind: TokenKind;
	target?: readonly [number, number, number];
	scale: number;
	exact: boolean;
};

function build(canvas: SvgCanvas, layout: AnswerLayout) {
	const root = canvas.el("g", {});
	const { mobile, card, row } = layout;

	// --- legend ------------------------------------------------------------
	const legend = canvas.el("g", {}, root);
	const legendItems = [
		{ key: "mention" as const, label: mobile ? "Mention" : "Brand mention" },
		{ key: "citation" as const, label: "Cited source" },
		{ key: "competitor" as const, label: "Competitor" },
	];

	let legendCursor = 0;
	const legendParts = legendItems.map((item) => {
		const width =
			22 + canvas.measure(item.label, 11.5, 500) + (mobile ? 0 : 20);
		const part = { ...item, x: legendCursor, w: width };
		legendCursor += width + (mobile ? 14 : 24);
		return part;
	});
	const legendWidth = legendCursor - (mobile ? 14 : 24);
	const legendLeft = (layout.W - legendWidth) / 2;

	const legendNodes = legendParts.map((part) => {
		const group = canvas.el("g", {}, legend);
		const x = legendLeft + part.x;
		const y = 14;
		if (part.key === "mention") {
			canvas.el(
				"rect",
				{
					x,
					y: y - 9,
					width: 16,
					height: 11,
					rx: 3,
					fill: C.accentHighlight,
					stroke: C.accent,
					"stroke-width": 1,
				},
				group,
			);
		} else if (part.key === "citation") {
			canvas.stroke(
				"path",
				{ d: pill(x + 0.5, y - 9, 16, 11, 5.5) },
				group,
				C.accent,
			);
		} else {
			canvas.el(
				"rect",
				{
					x,
					y: y - 9,
					width: 16,
					height: 11,
					rx: 3,
					fill: C.competitorWash,
					stroke: C.competitor,
					"stroke-width": 1,
				},
				group,
			);
		}
		canvas.text(
			part.label,
			x + 22,
			y + 1,
			{ "font-size": 11.5, "font-weight": 500, fill: C.inkSoft },
			group,
		);
		const count = mobile
			? null
			: canvas.text(
					"0",
					x + part.w,
					y + 1,
					{
						class: "mono",
						"font-size": 11,
						fill: C.hairline,
						"text-anchor": "end",
					},
					group,
				);
		return { group, count, key: part.key };
	});

	// --- report rows behind the card --------------------------------------
	const report = canvas.el("g", {}, root);
	const ghostNodes = layout.ghosts.map((ghost) => {
		const group = canvas.el("g", {}, report);
		canvas.stroke(
			"path",
			{ d: pill(ghost.x + 0.5, ghost.y + 0.5, ghost.w - 1, ghost.h - 1, 10) },
			group,
			C.rule,
		);
		const scale = layout.W / 345;
		const bars: readonly (readonly [number, number])[] = [
			[16, 74],
			[100, 150],
			[282, 46],
		];
		for (const [barX, barWidth] of bars) {
			canvas.el(
				"rect",
				{
					x: ghost.x + barX * scale,
					y: ghost.y + ghost.h / 2 - 3,
					width: barWidth * scale - (barX > 200 ? 0 : 6),
					height: 6,
					rx: 3,
					fill: C.rule,
				},
				group,
			);
		}
		return group;
	});

	// --- the folded report row --------------------------------------------
	const rowGroup = canvas.el("g", {}, root);
	const rowCells: SVGGElement[] = [];
	const cell = () => {
		const group = canvas.el("g", {}, rowGroup);
		rowCells.push(group);
		return group;
	};
	const tick = (group: SVGElement, x: number, y: number) =>
		canvas.stroke("path", { d: `M${x},${y} l3,3.2 l6,-6.4` }, group, C.accent);

	const valueSize = mobile ? 12.5 : 13.5;
	const rowBaseline = row.y + 30;
	const rowLeft = row.x;
	const rowRight = row.x + row.w;
	const valueTargets: Record<string, readonly [number, number, number]> = {};

	let rowCell = cell();
	const engineIconX = rowLeft + 23;
	const engineIconY = rowBaseline - 4.5;
	canvas.stroke(
		"path",
		{
			d: `M${engineIconX},${engineIconY - 6.5} V${engineIconY + 6.5} M${engineIconX - 5.5},${engineIconY - 3.5} L${engineIconX + 5.5},${engineIconY + 3.5} M${engineIconX + 5.5},${engineIconY - 3.5} L${engineIconX - 5.5},${engineIconY + 3.5}`,
		},
		rowCell,
		C.inkSoft,
	);
	canvas.text(
		"Perplexity",
		rowLeft + 37,
		rowBaseline,
		{ "font-size": valueSize, "font-weight": 550, fill: C.ink },
		rowCell,
	);
	const queryX =
		rowLeft + 37 + canvas.measure("Perplexity", valueSize, 550) + 14;
	const querySize = mobile
		? Math.min(
				12,
				(12 * (layout.W - 10 - queryX)) / canvas.measure(QUERY, 12, 500),
			)
		: 13;
	canvas.text(
		QUERY,
		queryX,
		rowBaseline,
		{ "font-size": querySize, "font-weight": 500, fill: C.inkSoft },
		rowCell,
	);
	valueTargets.e = [engineIconX, engineIconY, 1];
	canvas.stroke(
		"line",
		{ x1: rowLeft + 16, y1: row.y + 46, x2: rowRight - 16, y2: row.y + 46 },
		cell(),
		C.rule,
	);

	const columnWidth = (row.w - 32) / 4;
	const labelY = row.y + 64;
	const valueY = row.y + 86;
	const label = (target: SVGElement, value: string, x: number) =>
		canvas.text(
			value,
			x,
			labelY,
			{ class: "mono", "font-size": 8.5, fill: C.hairline },
			target,
		);

	let columnX = rowLeft + 16;
	rowCell = cell();
	label(rowCell, "MENTIONED", columnX);
	tick(rowCell, columnX, valueY - 5);
	canvas.text(
		"Yes",
		columnX + 15,
		valueY,
		{ "font-size": valueSize, "font-weight": 600, fill: C.accentStrong },
		rowCell,
	);
	valueTargets.mention = [columnX, valueY, 0.72];
	columnX += columnWidth;

	rowCell = cell();
	label(rowCell, "CITED", columnX);
	tick(rowCell, columnX, valueY - 5);
	canvas.text(
		"Yes",
		columnX + 15,
		valueY,
		{ "font-size": valueSize, "font-weight": 600, fill: C.accentStrong },
		rowCell,
	);
	valueTargets.citation = [columnX, valueY, 0.72];
	columnX += columnWidth;

	rowCell = cell();
	label(rowCell, mobile ? "COMPET." : "COMPETITORS", columnX);
	canvas.text(
		"2",
		columnX,
		valueY,
		{ "font-size": valueSize, "font-weight": 600, fill: C.ink },
		rowCell,
	);
	if (!mobile) {
		canvas.text(
			"Northwind, Globex",
			columnX + 14,
			valueY,
			{ "font-size": 11, fill: C.competitorStrong },
			rowCell,
		);
	}
	valueTargets.competitor = [columnX, valueY, 0.72];
	const competitorNameTargets: (readonly [number, number, number])[] = mobile
		? []
		: [
				[columnX + 14, valueY, 11 / layout.fontSize],
				[
					columnX + 14 + canvas.measure("Northwind, ", 11, 400),
					valueY,
					11 / layout.fontSize,
				],
			];
	columnX += columnWidth;

	rowCell = cell();
	label(rowCell, mobile ? "SCORE" : "SCORE CHANGE", columnX);
	canvas.stroke(
		"path",
		{ d: `M${columnX},${valueY - 1} l4.5,-6.5 l4.5,6.5` },
		rowCell,
		C.accent,
	);
	const scoreLabel = canvas.text(
		"+0",
		columnX + 14,
		valueY + 1,
		{ "font-size": mobile ? 15 : 16, "font-weight": 650, fill: C.accent },
		rowCell,
	);
	canvas.text(
		"pts",
		columnX + (mobile ? 40 : 42),
		valueY,
		{ "font-size": 10.5, fill: C.text },
		rowCell,
	);

	// --- the answer card ---------------------------------------------------
	const cardGroup = canvas.el("g", {}, root);
	const cardBackground = canvas.el("path", { fill: C.paper }, cardGroup);
	const cardFrame = canvas.stroke("path", {}, cardGroup, C.inkSoft);
	const cardHalo = canvas.stroke("path", {}, cardGroup, C.accentFaint);
	const content = canvas.el("g", {}, cardGroup);

	const contentX = card.x + 18;
	const contentY = card.y;
	const header = canvas.el("g", {}, content);
	const headerIconX = contentX + 6;
	const headerIconY = contentY + 22;
	canvas.stroke(
		"path",
		{
			d: `M${headerIconX},${headerIconY - 6.5} V${headerIconY + 6.5} M${headerIconX - 5.5},${headerIconY - 3.5} L${headerIconX + 5.5},${headerIconY + 3.5} M${headerIconX + 5.5},${headerIconY - 3.5} L${headerIconX - 5.5},${headerIconY + 3.5}`,
		},
		header,
		C.inkSoft,
	);
	canvas.text(
		"PERPLEXITY  ·  ANSWER",
		contentX + 20,
		contentY + 26,
		{ class: "mono", "font-size": 9.5, fill: C.text },
		header,
	);

	const tagWidth = canvas.measure("SAMPLE DATA", 8.5, 500, true) + 14;
	const cardTag = canvas.el("g", {}, root);
	const tagX = card.x + card.w - 16 - tagWidth;
	const tagY = card.y + 13;
	canvas.stroke(
		"path",
		{ d: pill(tagX + 0.5, tagY + 0.5, tagWidth - 1, 16, 8) },
		cardTag,
		C.faint,
	);
	canvas.text(
		"SAMPLE DATA",
		tagX + tagWidth / 2,
		tagY + 11.5,
		{
			class: "mono",
			"font-size": 8.5,
			fill: C.hairline,
			"text-anchor": "middle",
		},
		cardTag,
	);

	const divider = canvas.stroke(
		"line",
		{
			x1: contentX,
			y1: contentY + 38,
			x2: card.x + card.w - 18,
			y2: contentY + 38,
		},
		content,
		C.rule,
	);

	const queryWidth = canvas.measure(QUERY, 13, 500) + 26;
	const queryBoxX = card.x + card.w - 18 - queryWidth;
	const queryBoxY = contentY + 50;
	const queryBackground = canvas.el(
		"path",
		{
			d: pill(queryBoxX + 0.5, queryBoxY + 0.5, queryWidth - 1, 29, 14.5),
			fill: "#f8fafc",
		},
		content,
	);
	const queryBox = canvas.stroke(
		"path",
		{ d: pill(queryBoxX + 0.5, queryBoxY + 0.5, queryWidth - 1, 29, 14.5) },
		content,
		C.faint,
	);
	const queryText = canvas.text(
		"",
		queryBoxX + 13,
		queryBoxY + 19.5,
		{
			"font-size": 13,
			"font-weight": 500,
			fill: C.ink,
		},
		content,
	);

	const highlightLayer = canvas.el("g", {}, content);
	const marks: MarkNode[] = [];
	const unitNodes: UnitNode[] = layout.text.units.map((unit, index) => {
		const x = contentX + unit.x;
		const y = contentY + 98 + 14 + unit.y;

		if (unit.kind === "n" || unit.kind === "n1") {
			const markerBox = canvas.stroke(
				"path",
				{ d: pill(x + 1, y - 11, unit.width - 2, 14, 4) },
				content,
				C.faint,
			);
			const marker = canvas.text(
				unit.text.replace(/[[\]]/g, ""),
				x + unit.width / 2,
				y - 0.5,
				{
					class: "mono",
					"font-size": 9.5,
					fill: C.text,
					"text-anchor": "middle",
				},
				content,
			);
			if (unit.kind === "n1") {
				const layer = canvas.el(
					"path",
					{ d: pill(x + 1, y - 11, unit.width - 2, 14, 4), fill: C.accentWash },
					highlightLayer,
				);
				marks.push({
					kind: "n1",
					x,
					y,
					width: unit.width,
					layer,
					box: markerBox,
					text: marker,
					chipNode: null,
					start: 0,
				});
			}
			return { index, textNode: marker, markerBox };
		}

		let layer: SVGElement | null = null;
		if (unit.kind) {
			layer = canvas.el(
				"rect",
				{
					x: x - 3,
					y: y - 15,
					width: unit.width + 6,
					height: 21,
					rx: 4,
					fill: unit.kind === "b" ? C.accentHighlight : C.competitorWash,
				},
				highlightLayer,
			);
		}
		const text = canvas.text(
			unit.text,
			x,
			y,
			{ "font-size": layout.fontSize, "font-weight": 400, fill: C.inkSoft },
			content,
		);
		if (unit.kind === "b" || unit.kind === "c") {
			marks.push({
				kind: unit.kind,
				x,
				y,
				width: unit.width,
				layer,
				box: null,
				text,
				chipNode: null,
				start: 0,
			});
		}
		return { index, textNode: text, markerBox: null };
	});

	const sourcesY = contentY + 98 + layout.text.lines * layout.lineHeight + 16;
	const sourcesLabel = canvas.text(
		"SOURCES",
		contentX,
		sourcesY + 4,
		{
			class: "mono",
			"font-size": 9.5,
			fill: C.hairline,
		},
		content,
	);

	const chipNodes: ChipNode[] = layout.chips.map((chip) => {
		const x = contentX + chip.x;
		const y = sourcesY + 14 + chip.y;
		const group = canvas.el("g", {}, content);
		const fill = canvas.el(
			"path",
			{
				d: pill(x + 0.5, y + 0.5, chip.w - 1, 21, 10.5),
				fill: C.accentWash,
				opacity: 0,
			},
			group,
		);
		const box = canvas.stroke(
			"path",
			{ d: pill(x + 0.5, y + 0.5, chip.w - 1, 21, 10.5) },
			group,
			C.faint,
		);
		const markerText = canvas.text(
			chip.marker,
			x + 12,
			y + 15,
			{
				class: "mono",
				"font-size": 9.5,
				fill: C.hairline,
				"text-anchor": "middle",
			},
			group,
		);
		const domainText = canvas.text(
			chip.domain,
			x + 24,
			y + 15,
			{ class: "mono", "font-size": 10.5, "font-weight": 500, fill: C.text },
			group,
		);
		return { group, fill, box, markerText, domainText, x, y, w: chip.w };
	});

	for (const chip of chipNodes) {
		if (!layout.chips[chipNodes.indexOf(chip)]?.mine) {
			continue;
		}
		marks.push({
			kind: "n1",
			x: chip.x + 2,
			y: chip.y + 15,
			width: chip.w - 4,
			layer: chip.fill,
			box: null,
			text: chip.domainText,
			chipNode: chip,
			start: 0,
		});
	}

	marks.forEach((mark, index) => {
		mark.start = HIGHLIGHT_START + index * (HIGHLIGHT_DURATION + HIGHLIGHT_GAP);
	});

	// Paint the report row above the card it morphs out of.
	root.appendChild(rowGroup);

	const rowTagY = at(layout.ghosts, 2).y + at(layout.ghosts, 2).h + 14;
	const rowTag = canvas.el("g", {}, root);
	canvas.stroke(
		"path",
		{ d: pill(layout.W - tagWidth + 0.5, rowTagY + 0.5, tagWidth - 1, 16, 8) },
		rowTag,
		C.faint,
	);
	canvas.text(
		"SAMPLE DATA",
		layout.W - tagWidth / 2,
		rowTagY + 11.5,
		{
			class: "mono",
			"font-size": 8.5,
			fill: C.hairline,
			"text-anchor": "middle",
		},
		rowTag,
	);

	// --- highlighter pen ---------------------------------------------------
	const pen = canvas.el("g", {}, root);
	canvas.stroke(
		"path",
		{ d: "M0,0 l-3,-6 l0,-16 l6,0 l0,16 Z M-3,-12 h6" },
		pen,
		C.inkSoft,
	);
	const penTip = canvas.el(
		"path",
		{ d: "M0,0 l-3,-6 h6 Z", fill: C.accent },
		pen,
	);

	// --- tokens that fold into the row ------------------------------------
	const tokens: TokenNode[] = [];
	let competitorToken = 0;
	const addToken = (
		x: number,
		y: number,
		kind: TokenKind,
		drawContent: (group: SVGGElement) => void,
		scale: number,
	) => {
		const group = canvas.el("g", {}, root);
		drawContent(group);
		const target =
			kind === "competitor" && competitorNameTargets.length
				? at(competitorNameTargets, competitorToken++ % 2)
				: undefined;
		tokens.push({
			group,
			x,
			y,
			kind,
			scale,
			target,
			exact: kind === "q" || target !== undefined,
		});
	};

	addToken(
		contentX + 6,
		contentY + 22,
		"e",
		(group) => {
			canvas.stroke(
				"path",
				{ d: "M0,-6.5 V6.5 M-5.5,-3.5 L5.5,3.5 M5.5,-3.5 L-5.5,3.5" },
				group,
				C.inkSoft,
			);
			canvas.text(
				"PERPLEXITY",
				14,
				4,
				{ class: "mono", "font-size": 9.5, fill: C.text },
				group,
			);
		},
		1,
	);

	addToken(
		queryBoxX + 13,
		queryBoxY + 19.5,
		"q",
		(group) => {
			canvas.el(
				"path",
				{
					d: pill(-12.5, -19, queryWidth - 1, 29, 14.5),
					fill: "#f8fafc",
					stroke: C.faint,
					"stroke-width": HAIRLINE,
					class: "bubble",
				},
				group,
			);
			canvas.text(
				QUERY,
				0,
				0,
				{ "font-size": 13, "font-weight": 500, fill: C.ink },
				group,
			);
		},
		1,
	);

	for (const mark of marks) {
		if (mark.chipNode) {
			const chip = mark.chipNode;
			addToken(
				chip.x,
				chip.y + 15,
				"citation",
				(group) => {
					canvas.el(
						"path",
						{
							d: pill(0.5, -14.5, chip.w - 1, 21, 10.5),
							fill: C.accentWash,
							stroke: C.accent,
							"stroke-width": HAIRLINE,
						},
						group,
					);
					canvas.text(
						chip.markerText.textContent ?? "",
						12,
						0,
						{
							class: "mono",
							"font-size": 9.5,
							fill: C.accent,
							"text-anchor": "middle",
						},
						group,
					);
					canvas.text(
						chip.domainText.textContent ?? "",
						24,
						0,
						{
							class: "mono",
							"font-size": 10.5,
							"font-weight": 500,
							fill: C.accentStrong,
						},
						group,
					);
				},
				mobile ? 0.4 : 0.5,
			);
			continue;
		}
		if (mark.kind === "n1") {
			addToken(
				mark.x,
				mark.y,
				"citation",
				(group) => {
					canvas.el(
						"path",
						{
							d: pill(1, -11, mark.width - 2, 14, 4),
							fill: C.accentWash,
							stroke: C.accent,
							"stroke-width": HAIRLINE,
						},
						group,
					);
					canvas.text(
						mark.text.textContent ?? "",
						mark.width / 2,
						-0.5,
						{
							class: "mono",
							"font-size": 9.5,
							fill: C.accentStrong,
							"text-anchor": "middle",
						},
						group,
					);
				},
				1,
			);
			continue;
		}
		const kind = MARK_KIND[mark.kind] ?? "mention";
		addToken(
			mark.x,
			mark.y,
			kind,
			(group) => {
				canvas.el(
					"rect",
					{
						x: -3,
						y: -15,
						width: mark.width + 6,
						height: 21,
						rx: 4,
						fill: mark.kind === "b" ? C.accentHighlight : C.competitorWash,
					},
					group,
				);
				canvas.text(
					mark.text.textContent ?? "",
					0,
					0,
					{
						"font-size": layout.fontSize,
						"font-weight": mark.kind === "b" ? 600 : 400,
						fill: mark.kind === "b" ? C.accentStrong : C.competitorStrong,
					},
					group,
				);
			},
			1,
		);
	}

	return (time: number) => {
		root.style.opacity = String(
			easeOut(progress(0, 0.2, time)) *
				(1 - progress(DURATION - 0.6, DURATION - 0.12, time)),
		);

		for (const [index, item] of legendNodes.entries()) {
			setOpacity(
				item.group,
				easeOut(progress(0.45 + index * 0.08, 0.8 + index * 0.08, time)),
			);
		}
		const counts: Record<MarkKind, number> = {
			mention: 0,
			citation: 0,
			competitor: 0,
		};
		for (const mark of marks) {
			if (time >= mark.start + HIGHLIGHT_DURATION) {
				const kind = MARK_KIND[mark.kind] ?? "mention";
				if (kind === "citation") {
					counts.citation = 1;
				} else {
					counts[kind] += 1;
				}
			}
		}
		for (const item of legendNodes) {
			if (!item.count) {
				continue;
			}
			const value = counts[item.key];
			item.count.textContent = String(value);
			item.count.setAttribute("fill", value ? C.accentStrong : C.hairline);
		}

		// Card frame morphs into the row.
		const fold = easeInOut(progress(FOLD_START + 0.15, FOLD_END - 0.1, time));
		const x = lerp(card.x, row.x, fold);
		const y = lerp(card.y, row.y, fold);
		const width = lerp(card.w, row.w, fold);
		const height = lerp(card.h, row.h, fold);
		const radius = lerp(14, 10, fold);
		const path = pill(x + 0.5, y + 0.5, width - 1, height - 1, radius);
		cardBackground.setAttribute("d", path);
		cardFrame.setAttribute("d", path);
		resetReveal(cardFrame);
		cardHalo.setAttribute("d", path);
		reveal(cardFrame, easeInOut(progress(0.2, 0.85, time)));
		cardBackground.style.opacity = String(easeOut(progress(0.5, 0.9, time)));
		const haloProgress = progress(FOLD_END - 0.1, FOLD_END + 0.6, time);
		cardHalo.style.opacity =
			haloProgress > 0 && haloProgress < 1
				? String((1 - haloProgress) * 0.9)
				: "0";
		cardHalo.setAttribute(
			"transform",
			`translate(${x + width / 2},${y + height / 2}) scale(${1 + haloProgress * 0.03},${1 + haloProgress * 0.25}) translate(${-(x + width / 2)},${-(y + height / 2)})`,
		);
		cardFrame.setAttribute(
			"stroke",
			fold > 0 && fold < 1 ? C.accent : C.inkSoft,
		);
		const folding = time >= FOLD_START;
		setOpacity(content, folding ? 0 : 1);
		content.style.display = folding ? "none" : "";
		setOpacity(
			cardTag,
			easeOut(progress(0.7, 1, time)) *
				(1 - easeOut(progress(FOLD_START, FOLD_START + 0.25, time))),
		);
		setOpacity(rowTag, easeOut(progress(FOLD_END, FOLD_END + 0.4, time)));
		setOpacity(header, easeOut(progress(0.6, 0.9, time)));
		reveal(divider, easeInOut(progress(0.65, 1, time)));
		reveal(queryBox, easeInOut(progress(0.9, 1.2, time)));
		queryBackground.style.opacity = String(easeOut(progress(1, 1.2, time)));
		queryText.textContent = QUERY.slice(
			0,
			Math.round(QUERY.length * progress(1.05, 1.55, time)),
		);

		const unitCount = unitNodes.length;
		for (const unit of unitNodes) {
			const start =
				TEXT_START + ((TEXT_END - TEXT_START) * unit.index) / unitCount;
			setOpacity(unit.textNode, easeOut(progress(start, start + 0.15, time)));
			if (unit.markerBox) {
				reveal(unit.markerBox, easeInOut(progress(start, start + 0.2, time)));
			}
		}
		setOpacity(
			sourcesLabel,
			easeOut(progress(TEXT_END, TEXT_END + 0.25, time)),
		);
		for (const [index, chip] of chipNodes.entries()) {
			const start = TEXT_END + 0.1 + index * 0.12;
			const amount = easeOut(progress(start, start + 0.25, time));
			setOpacity(chip.group, amount);
			chip.group.setAttribute("transform", `translate(0,${(1 - amount) * 5})`);
		}

		// Highlighter.
		let penPoint: readonly [number, number, string] | null = null;
		for (const mark of marks) {
			const amount = easeInOut(
				progress(mark.start, mark.start + HIGHLIGHT_DURATION, time),
			);
			if (mark.chipNode) {
				const chip = mark.chipNode;
				chip.fill.setAttribute("opacity", String(amount));
				chip.box.setAttribute("stroke", amount > 0.5 ? C.accent : C.faint);
				chip.domainText.setAttribute(
					"fill",
					amount > 0.5 ? C.accentStrong : C.text,
				);
				chip.markerText.setAttribute(
					"fill",
					amount > 0.5 ? C.accent : C.hairline,
				);
				if (
					time >= mark.start - 0.06 &&
					time < mark.start + HIGHLIGHT_DURATION + 0.05
				) {
					penPoint = [
						chip.x + 6 + (chip.w - 10) * amount,
						chip.y + 18,
						C.accent,
					];
				}
				continue;
			}
			if (mark.kind === "n1") {
				if (mark.layer) {
					mark.layer.style.opacity = String(amount);
				}
				mark.box?.setAttribute("stroke", amount > 0.5 ? C.accent : C.faint);
				mark.text.setAttribute("fill", amount > 0.5 ? C.accentStrong : C.text);
				if (
					time >= mark.start - 0.06 &&
					time < mark.start + HIGHLIGHT_DURATION + 0.05
				) {
					penPoint = [
						mark.x + 2 + (mark.width - 4) * amount,
						mark.y + 3,
						C.accent,
					];
				}
				continue;
			}
			if (!mark.layer) {
				continue;
			}
			mark.layer.setAttribute("width", String((mark.width + 6) * amount));
			mark.layer.style.opacity = amount > 0 ? "1" : "0";
			mark.text.setAttribute(
				"fill",
				amount > 0.5
					? mark.kind === "b"
						? C.accentStrong
						: C.competitorStrong
					: C.inkSoft,
			);
			mark.text.setAttribute(
				"font-weight",
				amount > 0.5 && mark.kind === "b" ? "600" : "400",
			);
			if (
				time >= mark.start - 0.06 &&
				time < mark.start + HIGHLIGHT_DURATION + 0.05
			) {
				penPoint = [
					mark.x - 3 + (mark.width + 6) * amount,
					mark.y + 6,
					mark.kind === "c" ? C.competitor : C.accent,
				];
			}
		}

		const lastMark = marks[marks.length - 1];
		const penStart = lastMark ? lastMark.start : HIGHLIGHT_START;
		if (
			!penPoint &&
			time > HIGHLIGHT_START - 0.3 &&
			time < penStart + HIGHLIGHT_DURATION + 0.25
		) {
			const next = marks.find((mark) => mark.start > time) ?? null;
			const previous =
				[...marks]
					.reverse()
					.find((mark) => mark.start + HIGHLIGHT_DURATION <= time) ?? null;
			const startOf = (mark: MarkNode): readonly [number, number] => {
				if (mark.chipNode) {
					return [mark.chipNode.x + 6, mark.chipNode.y + 18];
				}
				return mark.kind === "n1"
					? [mark.x + 2, mark.y + 3]
					: [mark.x - 3, mark.y + 6];
			};
			const endOf = (mark: MarkNode): readonly [number, number] => {
				if (mark.chipNode) {
					return [mark.chipNode.x + mark.chipNode.w - 4, mark.chipNode.y + 18];
				}
				return mark.kind === "n1"
					? [mark.x + mark.width - 2, mark.y + 3]
					: [mark.x + mark.width + 3, mark.y + 6];
			};
			if (next && previous) {
				const amount = easeInOut(
					progress(previous.start + HIGHLIGHT_DURATION, next.start, time),
				);
				const from = endOf(previous);
				const to = startOf(next);
				penPoint = [
					lerp(from[0], to[0], amount),
					lerp(from[1], to[1], amount),
					C.accent,
				];
			} else if (next) {
				const to = startOf(next);
				const appear = easeOut(
					progress(HIGHLIGHT_START - 0.3, HIGHLIGHT_START, time),
				);
				penPoint = [
					to[0] - 30 * (1 - appear),
					to[1] + 10 * (1 - appear),
					C.accent,
				];
			} else if (previous) {
				const from = endOf(previous);
				const leave = easeOut(
					progress(
						previous.start + HIGHLIGHT_DURATION,
						previous.start + HIGHLIGHT_DURATION + 0.25,
						time,
					),
				);
				penPoint = [from[0] + 20 * leave, from[1], C.accent];
			}
		}
		const penOpacity =
			easeOut(progress(HIGHLIGHT_START - 0.3, HIGHLIGHT_START - 0.1, time)) *
			(1 -
				easeOut(
					progress(
						penStart + HIGHLIGHT_DURATION + 0.05,
						penStart + HIGHLIGHT_DURATION + 0.25,
						time,
					),
				));
		if (penPoint && penOpacity > 0) {
			pen.style.opacity = String(penOpacity);
			pen.setAttribute(
				"transform",
				`translate(${penPoint[0]},${penPoint[1]}) rotate(28)`,
			);
			penTip.setAttribute("fill", penPoint[2]);
		} else {
			pen.style.opacity = "0";
		}

		// Tokens fly into their cells, then hand over to the cell content.
		tokens.forEach((token, index) => {
			const target = token.target ?? valueTargets[token.kind] ?? [0, 0, 1];
			const order = CELL_ORDER[token.kind] ?? 0;
			const start = FOLD_START + 0.05 + index * 0.035;
			const amount = easeInOut(progress(start, FOLD_END - 0.05, time));
			const scale = lerp(1, token.scale ?? target[2], amount);
			const tx = lerp(token.x, target[0], amount);
			const ty =
				lerp(token.y, target[1], amount) - Math.sin(amount * Math.PI) * 14;
			token.group.setAttribute(
				"transform",
				`translate(${tx},${ty}) scale(${scale})`,
			);
			const out = token.exact
				? progress(
						FOLD_END - 0.05 + order * 0.07,
						FOLD_END + 0.2 + order * 0.07,
						time,
					)
				: progress(0.6, 1, amount);
			token.group.style.display =
				time < FOLD_START || out >= 1 || time > FOLD_END + 0.6 ? "none" : "";
			token.group.style.opacity = String(1 - out);
			const bubble = token.group.querySelector(".bubble");
			if (bubble instanceof SVGElement) {
				bubble.style.opacity = String(
					1 - easeOut(progress(start, start + 0.5, time)),
				);
			}
		});

		for (const [index, ghost] of ghostNodes.entries()) {
			const amount = easeOut(
				progress(
					FOLD_START + 0.4 + index * 0.1,
					FOLD_END + 0.2 + index * 0.1,
					time,
				),
			);
			setOpacity(ghost, 0.9 * amount);
			ghost.setAttribute(
				"transform",
				`translate(0,${(1 - amount) * (index ? 8 : -8)})`,
			);
		}
		for (const [index, rowCellNode] of rowCells.entries()) {
			const start = FOLD_END - 0.25 + index * 0.07;
			setOpacity(rowCellNode, easeOut(progress(start, start + 0.3, time)));
		}
		scoreLabel.textContent = `+${Math.round(4 * easeInOut(progress(FOLD_END + 0.5, FOLD_END + 1.2, time)))}`;
	};
}

export const answerFoldScene: SceneDefinition<AnswerLayout> = {
	id: "answer-fold",
	duration: DURATION,
	finalTime: 9.8,
	layout,
	build,
};
