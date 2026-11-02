import {
	at,
	easeInOut,
	easeOut,
	lerp,
	pill,
	progress,
	SCENE_COLORS as C,
	setOpacity,
	type SvgCanvas,
	reveal,
} from "./engine";
import type { SceneDefinition, SceneLayout } from "./use-scene";

const DURATION = 11;
const SCORE = 58;

const QUESTIONS = [
	"best CRM for small agencies",
	"Acme CRM vs Northwind",
	"CRM with client portals",
	"affordable CRM for startups",
	"Acme CRM pricing",
	"CRM that works with Gmail",
] as const;

type CellState = "C" | "N" | "R" | "M";
/** C = cited + named, N = named only, R = cited only, M = missing. */
const GRID: readonly (readonly [CellState, CellState])[] = [
	["C", "N"],
	["N", "C"],
	["M", "R"],
	["C", "M"],
	["C", "C"],
	["M", "N"],
];

const TREND = [41, 44, 43, 47, 50, 49, 54, 58] as const;

const CELL_START = [1.3, 1.65] as const;
const CELL_STEP = 0.3;
const RUN_TIME = 0.38;
const FLY_START = 4.75;
const FLY_DURATION = 0.7;
const SCORE_START = 5.75;
const SCORE_END = 6.9;

type ReportLayout = SceneLayout & {
	mobile: boolean;
	questionFontSize: number;
	columns: readonly [number, number];
	soonColumns: readonly number[];
	headerY: number;
	rows: readonly number[];
	rowHeight: number;
	legendY: number;
	gridRight: number;
	card: { x: number; y: number; w: number; h: number };
};

function layout(mobile: boolean): ReportLayout {
	if (!mobile) {
		const rows = QUESTIONS.map((_, index) => 82 + index * 46);
		return {
			mobile,
			W: 1080,
			H: 400,
			questionFontSize: 14.5,
			columns: [350, 460],
			soonColumns: [552, 624],
			headerY: 24,
			rows,
			rowHeight: 46,
			legendY: 378,
			gridRight: 656,
			card: { x: 700, y: 6, w: 380, h: 388 },
		};
	}
	const rows = QUESTIONS.map((_, index) => 70 + index * 40);
	const legendY = at(rows, 5) + 44;
	const cardY = legendY + 40;
	return {
		mobile,
		W: 345,
		H: cardY + 180 + 4,
		questionFontSize: 12,
		columns: [204, 272],
		soonColumns: [332],
		headerY: 22,
		rows,
		rowHeight: 40,
		legendY,
		gridRight: 345,
		card: { x: 0, y: cardY, w: 345, h: 180 },
	};
}

function build(canvas: SvgCanvas, layout: ReportLayout) {
	const root = canvas.el("g", {});
	const { mobile } = layout;
	const grid = canvas.el("g", {}, root);

	const drawDot = (
		parent: SVGElement,
		state: CellState,
		x: number,
		y: number,
		radius: number,
	) => {
		const group = canvas.el("g", { transform: `translate(${x},${y})` }, parent);
		if (state === "C") {
			canvas.el("circle", { r: radius, fill: C.accent }, group);
			canvas.stroke(
				"path",
				{
					d: `M${-radius * 0.42},0 l${radius * 0.3},${radius * 0.32} l${radius * 0.55},${-radius * 0.6}`,
					"stroke-width": 1.5,
				},
				group,
				C.paper,
			);
		} else if (state === "N") {
			canvas.stroke("circle", { r: radius - 0.5 }, group, C.accent);
			canvas.el(
				"path",
				{
					d: `M0,${-radius + 0.5} A${radius - 0.5},${radius - 0.5} 0 0 0 0,${radius - 0.5} Z`,
					fill: C.accent,
				},
				group,
			);
		} else if (state === "R") {
			canvas.stroke("circle", { r: radius - 0.5 }, group, C.accent);
			canvas.el("circle", { r: 2.2, fill: C.accent }, group);
		} else {
			canvas.stroke(
				"circle",
				{ r: radius - 0.5, "stroke-dasharray": "2.5 2.5" },
				group,
				C.hairline,
			);
			canvas.stroke("path", { d: "M-3,0 h6" }, group, C.hairline);
		}
		return { group };
	};

	const engineIcon = (
		engine: 0 | 1,
		x: number,
		y: number,
		parent: SVGElement,
	) =>
		engine === 0
			? canvas.stroke(
					"path",
					{
						d: `M${x},${y - 6} L${x + 5.2},${y - 3} V${y + 3} L${x},${y + 6} L${x - 5.2},${y + 3} V${y - 3} Z`,
					},
					parent,
					C.inkSoft,
				)
			: canvas.stroke(
					"path",
					{
						d: `M${x},${y - 6.5} V${y + 6.5} M${x - 5.5},${y - 3.5} L${x + 5.5},${y + 3.5} M${x + 5.5},${y - 3.5} L${x - 5.5},${y + 3.5}`,
					},
					parent,
					C.inkSoft,
				);

	// --- column headers ----------------------------------------------------
	const engineNames = ["ChatGPT", "Perplexity"] as const;
	const headNodes = layout.columns.map((centerX, index) => {
		const group = canvas.el("g", {}, grid);
		const name = at(engineNames, index);
		if (!mobile) {
			const width = canvas.measure(name, 12.5, 550) + 40;
			const x = centerX - width / 2;
			const box = canvas.stroke(
				"path",
				{ d: pill(x + 0.5, layout.headerY - 13, width - 1, 27, 13.5) },
				group,
				C.inkSoft,
			);
			engineIcon(index === 0 ? 0 : 1, x + 15, layout.headerY + 0.5, group);
			canvas.text(
				name,
				x + 27,
				layout.headerY + 5,
				{ "font-size": 12.5, "font-weight": 550, fill: C.ink },
				group,
			);
			return { group, box };
		}
		engineIcon(index === 0 ? 0 : 1, centerX, layout.headerY - 6, group);
		canvas.text(
			name.toUpperCase(),
			centerX,
			layout.headerY + 14,
			{
				class: "mono",
				"font-size": 11,
				fill: C.text,
				"text-anchor": "middle",
			},
			group,
		);
		return { group, box: null };
	});

	const soonNodes = layout.soonColumns.map((centerX) => {
		const group = canvas.el("g", {}, grid);
		if (!mobile) {
			const width = 56;
			canvas.stroke(
				"path",
				{
					d: pill(
						centerX - width / 2 + 0.5,
						layout.headerY - 12,
						width - 1,
						25,
						12.5,
					),
					"stroke-dasharray": "3 3",
				},
				group,
				C.faint,
			);
			canvas.text(
				"SOON",
				centerX,
				layout.headerY + 4,
				{
					class: "mono",
					"font-size": 11,
					fill: C.text,
					"text-anchor": "middle",
				},
				group,
			);
		} else {
			canvas.stroke(
				"circle",
				{
					cx: centerX,
					cy: layout.headerY - 6,
					r: 6,
					"stroke-dasharray": "2.5 2.5",
				},
				group,
				C.faint,
			);
			canvas.text(
				"SOON",
				centerX,
				layout.headerY + 14,
				{
					class: "mono",
					"font-size": 11,
					fill: C.text,
					"text-anchor": "middle",
				},
				group,
			);
		}
		for (const rowY of layout.rows) {
			canvas.stroke(
				"circle",
				{ cx: centerX, cy: rowY, r: mobile ? 7 : 8, "stroke-dasharray": "2 3" },
				group,
				C.rule,
			);
		}
		return group;
	});

	// --- question rows -----------------------------------------------------
	const rowNodes = layout.rows.map((rowY, index) => {
		const group = canvas.el("g", {}, grid);
		const separator = canvas.stroke(
			"line",
			{
				x1: 0,
				y1: rowY + layout.rowHeight / 2,
				x2: layout.gridRight,
				y2: rowY + layout.rowHeight / 2,
			},
			group,
			C.rule,
		);
		const number = canvas.text(
			String(index + 1).padStart(2, "0"),
			0,
			rowY + 4,
			{ class: "mono", "font-size": 11, fill: C.text },
			group,
		);
		const question = canvas.text(
			at(QUESTIONS, index),
			mobile ? 22 : 30,
			rowY + 4.5,
			{ "font-size": layout.questionFontSize, fill: C.inkSoft },
			group,
		);
		return { group, separator, number, question };
	});
	const topSeparator = canvas.stroke(
		"line",
		{
			x1: 0,
			y1: at(layout.rows, 0) - layout.rowHeight / 2,
			x2: layout.gridRight,
			y2: at(layout.rows, 0) - layout.rowHeight / 2,
		},
		grid,
		C.faint,
	);

	// --- result cells ------------------------------------------------------
	const cellRadius = mobile ? 7.5 : 8.5;
	const cellNodes: {
		state: CellState;
		x: number;
		y: number;
		row: number;
		column: number;
		empty: SVGCircleElement;
		ring: SVGCircleElement;
		dot: { group: SVGGElement };
		start: number;
	}[] = [];
	GRID.forEach((states, row) => {
		states.forEach((state, column) => {
			const x = at(layout.columns, column);
			const y = at(layout.rows, row);
			const empty = canvas.el(
				"circle",
				{ cx: x, cy: y, r: 2, fill: C.faint },
				grid,
			);
			const ring = canvas.stroke(
				"circle",
				{ cx: x, cy: y, r: cellRadius + 3 },
				grid,
				C.accentFaint,
			);
			const dot = drawDot(grid, state, x, y, cellRadius);
			cellNodes.push({
				state,
				x,
				y,
				row,
				column,
				empty,
				ring,
				dot,
				start: at(CELL_START, column) + row * CELL_STEP,
			});
		});
	});

	// --- legend ------------------------------------------------------------
	const legend = canvas.el("g", {}, root);
	const legendItems: readonly { state: CellState; label: string }[] = [
		{ state: "C", label: "Cited + named" },
		{ state: "N", label: "Named only" },
		{ state: "R", label: "Cited only" },
		{ state: "M", label: "Missing" },
	];
	let legendNodes: SVGGElement[];
	if (!mobile) {
		let x = 0;
		legendNodes = legendItems.map((item) => {
			const group = canvas.el("g", {}, legend);
			drawDot(group, item.state, x + 6, layout.legendY - 4, 6);
			canvas.text(
				item.label,
				x + 17,
				layout.legendY,
				{ "font-size": 11.5, fill: C.text },
				group,
			);
			x += canvas.measure(item.label, 11.5) + 40;
			return group;
		});
	} else {
		legendNodes = legendItems.map((item, index) => {
			const group = canvas.el("g", {}, legend);
			const x = (index % 2) * 150;
			const y = layout.legendY + Math.floor(index / 2) * 20;
			drawDot(group, item.state, x + 6, y - 4, 6);
			canvas.text(
				item.label,
				x + 17,
				y,
				{ "font-size": 11.5, fill: C.text },
				group,
			);
			return group;
		});
	}

	// --- score card --------------------------------------------------------
	const card = layout.card;
	const cardGroup = canvas.el("g", {}, root);
	const cardBackground = canvas.el(
		"path",
		{
			d: pill(card.x + 0.5, card.y + 0.5, card.w - 1, card.h - 1, 16),
			fill: C.paper,
		},
		cardGroup,
	);
	const cardFrame = canvas.stroke(
		"path",
		{ d: pill(card.x + 0.5, card.y + 0.5, card.w - 1, card.h - 1, 16) },
		cardGroup,
		C.inkSoft,
	);
	const cardContent = canvas.el("g", {}, cardGroup);
	const contentX = card.x + 22;
	canvas.text(
		"AI VISIBILITY SCORE",
		contentX,
		card.y + 30,
		{ class: "mono", "font-size": 11, fill: C.text },
		cardContent,
	);
	const tagWidth = canvas.measure("SAMPLE DATA", 11, 500, true) + 14;
	const tagX = card.x + card.w - 18 - tagWidth;
	canvas.stroke(
		"path",
		{ d: pill(tagX + 0.5, card.y + 17.5, tagWidth - 1, 16, 8) },
		cardContent,
		C.faint,
	);
	canvas.text(
		"SAMPLE DATA",
		tagX + tagWidth / 2,
		card.y + 29,
		{
			class: "mono",
			"font-size": 11,
			fill: C.text,
			"text-anchor": "middle",
		},
		cardContent,
	);

	const numberY = card.y + (mobile ? 92 : 100);
	const number = canvas.text(
		"0",
		contentX - 2,
		numberY,
		{
			"font-size": mobile ? 50 : 60,
			"font-weight": 600,
			fill: C.ink,
			"letter-spacing": "-2",
		},
		cardGroup,
	);
	const numberX = contentX;
	const ofLabel = canvas.text(
		"/ 100",
		contentX,
		numberY,
		{
			"font-size": 13,
			fill: C.text,
		},
		cardContent,
	);
	canvas.text(
		"PEER-RELATIVE",
		contentX,
		numberY + 18,
		{
			class: "mono",
			"font-size": 11,
			fill: C.text,
		},
		cardContent,
	);
	const halo = canvas.el(
		"circle",
		{
			cx: contentX + 34,
			cy: numberY - 20,
			r: 30,
			fill: C.accentHighlight,
			opacity: 0,
		},
		cardGroup,
	);
	cardGroup.insertBefore(halo, number);

	const sparkStartX = mobile ? card.x + 156 : contentX;
	const sparkEndX = mobile ? card.x + card.w - 22 : card.x + card.w - 22;
	const sparkTopY = mobile ? card.y + 52 : card.y + 128;
	const sparkBottomY = mobile ? card.y + 98 : card.y + 196;
	const points = TREND.map(
		(value, index) =>
			[
				lerp(sparkStartX, sparkEndX, index / (TREND.length - 1)),
				lerp(sparkBottomY, sparkTopY, (value - 38) / 22),
			] as const,
	);
	canvas.stroke(
		"line",
		{
			x1: sparkStartX,
			y1: sparkBottomY + 6,
			x2: sparkEndX,
			y2: sparkBottomY + 6,
			"stroke-dasharray": "2 4",
		},
		cardContent,
		C.faint,
	);
	const area = canvas.el(
		"path",
		{
			d:
				`M${points.map((point) => point.join(",")).join(" L")}` +
				` L${sparkEndX},${sparkBottomY + 6} L${sparkStartX},${sparkBottomY + 6} Z`,
			fill: C.accentWash,
			opacity: 0,
		},
		cardGroup,
	);
	const spark = canvas.stroke(
		"path",
		{
			d: `M${points.map((point) => point.join(",")).join(" L")}`,
			"stroke-linejoin": "round",
		},
		cardGroup,
		C.accent,
	);
	const lastPoint = at(points, points.length - 1);
	const endDot = canvas.el(
		"circle",
		{ cx: lastPoint[0], cy: lastPoint[1], r: 3.5, fill: C.accent },
		cardGroup,
	);
	const endRing = canvas.stroke(
		"circle",
		{ cx: lastPoint[0], cy: lastPoint[1], r: 4 },
		cardGroup,
		C.accent,
	);
	canvas.text(
		mobile ? "8 RUNS" : "LAST 8 RUNS",
		sparkStartX,
		sparkBottomY + 22,
		{ class: "mono", "font-size": 11, fill: C.text },
		cardContent,
	);

	const delta = canvas.el("g", {}, cardGroup);
	{
		const deltaX = mobile
			? contentX
			: card.x + card.w - 22 - canvas.measure("+17 pts", 12.5, 600) - 13;
		const deltaY = mobile ? numberY + 38 : numberY - 4;
		canvas.stroke(
			"path",
			{ d: `M${deltaX},${deltaY - 1} l4.5,-6.5 l4.5,6.5` },
			delta,
			C.accent,
		);
		canvas.text(
			"+17 pts",
			deltaX + 13,
			deltaY,
			{ "font-size": 12.5, "font-weight": 600, fill: C.accentStrong },
			delta,
		);
	}

	const tallyDefinitions: readonly {
		label: string;
		value: number;
		state: CellState;
	}[] = [
		{ label: "Named", value: 8, state: "N" },
		{ label: "Cited", value: 6, state: "R" },
		{ label: "Missing", value: 3, state: "M" },
	];
	const tallies = tallyDefinitions.map((definition, index) => {
		const group = canvas.el("g", {}, cardGroup);
		const x = mobile ? contentX + index * 104 : contentX;
		const y = mobile ? card.y + 150 : card.y + 252 + index * 40;
		const width = mobile ? 90 : card.w - 44;
		canvas.text(
			definition.label,
			x,
			y,
			{ "font-size": 12, fill: C.inkSoft },
			group,
		);
		const value = canvas.text(
			"0/12",
			x + width,
			y,
			{
				class: "mono",
				"font-size": 11,
				fill: definition.state === "M" ? C.text : C.accentStrong,
				"text-anchor": "end",
			},
			group,
		);
		canvas.el(
			"rect",
			{ x, y: y + 9, width, height: 4, rx: 2, fill: C.rule },
			group,
		);
		const bar = canvas.el(
			"rect",
			{
				x,
				y: y + 9,
				width: 0,
				height: 4,
				rx: 2,
				fill: definition.state === "M" ? C.hairline : C.accent,
			},
			group,
		);
		return {
			group,
			value,
			bar,
			amount: definition.value,
			width,
		};
	});

	const tokens = cellNodes
		.filter((cell) => cell.state !== "M")
		.map((cell) => ({
			cell,
			dot: canvas.el("circle", { r: 4, fill: C.accent }, root),
		}));

	return (time: number) => {
		root.style.opacity = String(
			easeOut(progress(0, 0.2, time)) *
				(1 - progress(DURATION - 0.6, DURATION - 0.12, time)),
		);

		for (const [index, head] of headNodes.entries()) {
			setOpacity(
				head.group,
				easeOut(progress(0.25 + index * 0.12, 0.6 + index * 0.12, time)),
			);
			if (head.box) {
				reveal(
					head.box,
					easeInOut(progress(0.2 + index * 0.12, 0.7 + index * 0.12, time)),
				);
			}
		}
		soonNodes.forEach((node, index) => {
			setOpacity(
				node,
				0.9 * easeOut(progress(0.6 + index * 0.1, 1.1 + index * 0.1, time)),
			);
		});
		reveal(topSeparator, easeInOut(progress(0.2, 0.8, time)));
		rowNodes.forEach((row, index) => {
			reveal(
				row.separator,
				easeInOut(progress(0.3 + index * 0.06, 0.9 + index * 0.06, time)),
			);
			const amount = easeOut(
				progress(0.45 + index * 0.08, 0.8 + index * 0.08, time),
			);
			setOpacity(row.number, amount);
			setOpacity(row.question, amount);
			row.question.setAttribute(
				"transform",
				`translate(${(1 - amount) * -6},0)`,
			);
		});

		let activeRow = -1;
		for (const cell of cellNodes) {
			const start = cell.start;
			const pop = progress(start + RUN_TIME, start + RUN_TIME + 0.3, time);
			setOpacity(
				cell.empty,
				easeOut(progress(0.6, 1, time)) * (pop > 0 ? 0 : 1),
			);
			const run = progress(start, start + RUN_TIME, time);
			const ringOn = run > 0 && pop < 1;
			cell.ring.style.opacity = ringOn
				? String(
						run < 1 ? 0.5 + 0.5 * Math.sin(run * Math.PI * 2) ** 2 : 1 - pop,
					)
				: "0";
			cell.ring.setAttribute("stroke-dasharray", run < 1 ? "4 4" : "none");
			cell.ring.setAttribute("stroke-dashoffset", String(-time * 30));
			const scale = easeOut(pop);
			cell.dot.group.setAttribute(
				"transform",
				`translate(${cell.x},${cell.y}) scale(${pop > 0 ? scale : 0})`,
			);
			cell.dot.group.style.opacity = pop > 0 ? "1" : "0";
			if (run > 0 && pop < 1) {
				activeRow = cell.row;
			}
		}
		rowNodes.forEach((row, index) => {
			row.question.setAttribute(
				"fill",
				index === activeRow ? C.ink : C.inkSoft,
			);
		});
		legendNodes.forEach((node, index) => {
			setOpacity(
				node,
				easeOut(progress(3.7 + index * 0.1, 4.1 + index * 0.1, time)),
			);
		});

		// Score card.
		reveal(cardFrame, easeInOut(progress(4.4, 5.1, time)));
		cardBackground.style.opacity = String(easeOut(progress(4.6, 5, time)));
		setOpacity(cardContent, easeOut(progress(4.9, 5.3, time)));

		const targetX = numberX + (mobile ? 28 : 34);
		const targetY = numberY - (mobile ? 17 : 20);
		for (const token of tokens) {
			const start = FLY_START + token.cell.row * 0.07;
			const amount = easeInOut(progress(start, start + FLY_DURATION, time));
			const x = lerp(token.cell.x, targetX, amount);
			const y =
				lerp(token.cell.y, targetY, amount) -
				Math.sin(amount * Math.PI) * (mobile ? 30 : 50);
			token.dot.setAttribute("cx", String(x));
			token.dot.setAttribute("cy", String(y));
			token.dot.setAttribute("r", String(4 * (1 - 0.4 * amount)));
			token.dot.style.opacity = time < start || amount >= 1 ? "0" : "1";
		}

		const scoreProgress = easeInOut(progress(SCORE_START, SCORE_END, time));
		const score = Math.round(SCORE * scoreProgress);
		number.textContent = String(score);
		setOpacity(number, easeOut(progress(5.2, 5.6, time)));
		number.setAttribute(
			"fill",
			scoreProgress > 0 && scoreProgress < 1 ? C.accentStrong : C.ink,
		);
		// Measure the real element, not the shared measurer: the number's
		// letter-spacing is part of its rendered width.
		const numberWidth = number.getComputedTextLength();
		ofLabel.setAttribute("x", String(numberX - 2 + numberWidth + 6));
		const haloProgress = progress(SCORE_START - 0.2, SCORE_END + 0.4, time);
		halo.setAttribute(
			"opacity",
			haloProgress > 0 && haloProgress < 1
				? String(Math.sin(haloProgress * Math.PI) * 0.8)
				: "0",
		);

		reveal(spark, easeInOut(progress(6.2, 7.4, time)));
		area.setAttribute("opacity", String(easeOut(progress(7, 7.6, time))));
		const endProgress = progress(7.35, 7.7, time);
		endDot.setAttribute("r", String(3.5 * easeOut(endProgress)));
		endDot.style.opacity = endProgress > 0 ? "1" : "0";
		const ringProgress = progress(7.5, 8.6, time);
		endRing.setAttribute("r", String(4 + 10 * ringProgress));
		endRing.style.opacity =
			ringProgress > 0 && ringProgress < 1 ? String(1 - ringProgress) : "0";
		setOpacity(delta, easeOut(progress(7.6, 8, time)));

		tallies.forEach((tally, index) => {
			const amount = easeInOut(
				progress(6 + index * 0.2, 6.9 + index * 0.2, time),
			);
			setOpacity(
				tally.group,
				easeOut(progress(5.8 + index * 0.2, 6.1 + index * 0.2, time)),
			);
			tally.bar.setAttribute(
				"width",
				String((tally.width * tally.amount * amount) / 12),
			);
			tally.value.textContent = `${Math.round(tally.amount * amount)}/12`;
		});

		// The grid settles slightly once it resolves.
		grid.style.opacity = String(
			1 - 0.35 * easeOut(progress(FLY_START, FLY_START + 0.8, time)),
		);
	};
}

export const reportGridScene: SceneDefinition<ReportLayout> = {
	id: "report-grid",
	duration: DURATION,
	finalTime: 9.8,
	layout,
	build,
};
