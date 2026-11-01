import {
	at,
	arcPath,
	easeInOut,
	easeOut,
	HAIRLINE,
	pill,
	progress,
	SCENE_COLORS as C,
	type RichText,
	type Segment,
	type SegmentKind,
	setOpacity,
	type SvgCanvas,
	reveal,
} from "./engine";
import type { SceneDefinition, SceneLayout } from "./use-scene";

const QUERY = "best CRM for small agencies";
const SCORE = 64;

type AnswerSpec = {
	engine: string;
	segments: Segment[];
	sources: readonly (readonly [string, boolean])[];
	start: number;
	end: number;
};

const ANSWERS: readonly AnswerSpec[] = [
	{
		engine: "ChatGPT",
		segments: [
			["For a small agency, ", 0],
			["Acme CRM", "b"],
			[" is a strong pick thanks to simple pipelines and client portals. ", 0],
			["Northwind", "c"],
			[" suits bigger teams, while ", 0],
			["Globex", "c"],
			[" is cheaper but more limited.", 0],
		],
		sources: [
			["acmecrm.com", true],
			["g2.com", false],
			["reddit.com", false],
		],
		start: 3.5,
		end: 5,
	},
	{
		engine: "Perplexity",
		segments: [
			["Popular picks are ", 0],
			["Northwind", "c"],
			[" for automation and ", 0],
			["Globex", "c"],
			[" for tight budgets. Agencies also shortlist ", 0],
			["Acme CRM", "b"],
			[" for client reporting.", 0],
		],
		sources: [
			["northwind.io", false],
			["capterra.com", false],
			["globex.com", false],
		],
		start: 3.8,
		end: 5.3,
	},
];

/** When the highlighter lands on each card: brand first, then competitors in order. */
const HIGHLIGHTS = [
	{ brand: 5.6, competitors: [5.78, 5.96], source: 6.12 },
	{ brand: 6.3, competitors: [6, 6.15], source: Number.NaN },
] as const;

type MarkKind = "mention" | "citation" | "competitor";
const MARKS: {
	card: number;
	kind: MarkKind;
	ref: number;
	start: number;
}[] = [
	{ card: 0, kind: "mention", ref: 0, start: 6.6 },
	{ card: 1, kind: "mention", ref: 0, start: 6.75 },
	{ card: 0, kind: "citation", ref: 0, start: 6.9 },
	{ card: 0, kind: "competitor", ref: 0, start: 7.05 },
	{ card: 0, kind: "competitor", ref: 1, start: 7.2 },
];

const MARK_FLY = 0.55;
const GAUGE_START = 7.95;
const GAUGE_END = 9.2;
const DURATION = 11;

type Box = { x: number; y: number; w: number; h: number };
type ChipLayout = {
	domain: string;
	mine: boolean;
	x: number;
	y: number;
	w: number;
};
type CardLayout = Box & {
	text: RichText;
	chips: ChipLayout[];
	chipRows: number;
};
type PillLayout = { x: number; w: number; h: number; cy: number };

type HeroLayout = SceneLayout & {
	mobile: boolean;
	fontSize: number;
	lineHeight: number;
	query: Box;
	cards: CardLayout[];
	engines: PillLayout[];
	soon: PillLayout[];
	report: Box;
};

function layout(mobile: boolean, canvas: SvgCanvas): HeroLayout {
	const fontSize = 12.5;
	const lineHeight = 19;

	const buildCards = (cardWidth: number, left: number): CardLayout[] =>
		ANSWERS.map((answer) => {
			const text = canvas.rich(
				answer.segments,
				cardWidth - 32,
				fontSize,
				lineHeight,
			);
			let chipX = 0;
			let chipRow = 0;
			const chips: ChipLayout[] = answer.sources.map(([domain, mine]) => {
				const width = canvas.measure(domain, 10, 500, true) + 30;
				if (chipX && chipX + width > cardWidth - 32) {
					chipX = 0;
					chipRow += 1;
				}
				const chip = { domain, mine, x: chipX, y: chipRow, w: width };
				chipX += width + 6;
				return chip;
			});
			return {
				x: left,
				y: 0,
				w: cardWidth,
				h: 52 + text.lines * lineHeight + 50 + chipRow * 28,
				text,
				chips,
				chipRows: chipRow + 1,
			};
		});

	if (!mobile) {
		const cards = buildCards(344, 470);
		const first = at(cards, 0);
		const last = at(cards, 1);
		first.y = 16;
		last.y = 400 - 16 - last.h;
		const engines = cards.map((card) => ({
			x: 304,
			w: 124,
			h: 34,
			cy: card.y + card.h / 2,
		}));
		const middle = (at(engines, 0).cy + at(engines, 1).cy) / 2;
		return {
			W: 1080,
			H: 400,
			mobile,
			fontSize,
			lineHeight,
			cards,
			engines,
			query: { x: 0, y: middle - 22, w: 256, h: 44 },
			soon: [
				{ x: 316, w: 100, h: 26, cy: middle - 30 },
				{ x: 316, w: 100, h: 26, cy: middle + 30 },
			],
			report: { x: 864, y: 16, w: 216, h: 368 },
		};
	}

	const cards = buildCards(345, 0);
	const first = at(cards, 0);
	const last = at(cards, 1);
	first.y = 164;
	last.y = first.y + first.h + 14;
	const reportY = last.y + last.h + 26;

	return {
		W: 345,
		H: reportY + 214,
		mobile,
		fontSize,
		lineHeight,
		cards,
		engines: [
			{ x: 0, w: 116, h: 32, cy: 118 },
			{ x: 122, w: 118, h: 32, cy: 118 },
		],
		soon: [{ x: 246, w: 99, h: 26, cy: 118 }],
		query: { x: 0, y: 22, w: 345, h: 42 },
		report: { x: 0, y: reportY, w: 345, h: 210 },
	};
}

type UnitNode = {
	text: SVGTextElement;
	highlight: SVGRectElement | null;
	underline: SVGPathElement | null;
	x: number;
	y: number;
	width: number;
	kind: SegmentKind;
	index: number;
};

type ChipNode = {
	group: SVGGElement;
	fill: SVGRectElement;
	box: SVGPathElement;
	link: SVGPathElement;
	label: SVGTextElement;
	mine: boolean;
	x: number;
	w: number;
	y: number;
};

type CardNode = {
	group: SVGGElement;
	background: SVGRectElement;
	frame: SVGPathElement;
	header: SVGTextElement;
	query: SVGTextElement;
	divider: SVGLineElement;
	units: UnitNode[];
	sourcesLabel: SVGTextElement;
	chips: ChipNode[];
	layout: CardLayout;
};

type EngineNode = {
	group: SVGGElement;
	glow: SVGRectElement;
	box: SVGPathElement;
	icon: SVGPathElement;
	label: SVGTextElement;
	spin: SVGPathElement;
	check: SVGPathElement;
	live: SVGCircleElement;
	spinnerX: number;
};

type RowKey = "mention" | "citation" | "competitor";
type RowNode = {
	key: RowKey;
	required: number;
	group: SVGGElement;
	separator: SVGLineElement;
	value: SVGTextElement;
	ring: SVGCircleElement;
	targetX: number;
	targetY: number;
};

type MarkNode = {
	path: SVGPathElement;
	dot: SVGCircleElement;
	halo: SVGCircleElement;
	kind: MarkKind;
};

function build(canvas: SvgCanvas, layout: HeroLayout) {
	const root = canvas.el("g", {});
	const { mobile, query, cards, engines, soon, report } = layout;

	// --- connectors, behind everything -------------------------------------
	const links = canvas.el("g", {}, root);
	const queryOut = (engine: PillLayout) =>
		mobile
			? ([engine.x + engine.w / 2, query.y + query.h] as const)
			: ([query.x + query.w, query.y + query.h / 2] as const);
	const engineIn = (engine: PillLayout) =>
		mobile
			? ([engine.x + engine.w / 2, engine.cy - engine.h / 2] as const)
			: ([engine.x, engine.cy] as const);
	const curve = (
		from: readonly [number, number],
		to: readonly [number, number],
	) =>
		mobile
			? `M${from[0]},${from[1]} C${from[0]},${from[1] + 22} ${to[0]},${to[1] - 22} ${to[0]},${to[1]}`
			: `M${from[0]},${from[1]} C${from[0] + 34},${from[1]} ${to[0] - 34},${to[1]} ${to[0]},${to[1]}`;

	const fan = engines.map((engine) =>
		canvas.stroke(
			"path",
			{ d: curve(queryOut(engine), engineIn(engine)) },
			links,
		),
	);
	const soonFan = soon.map((engine) =>
		canvas.stroke(
			"path",
			{
				d: curve(queryOut(engine), engineIn(engine)),
				"stroke-dasharray": "2 4",
			},
			links,
			C.faint,
		),
	);
	const fanDots = engines.map(() => ({
		dot: canvas.el("circle", { r: 2.8, fill: C.accent }, root),
		halo: canvas.stroke("circle", { r: 6.5 }, root, C.accentFaint),
	}));
	const engineToCard = mobile
		? []
		: engines.map((engine, index) =>
				canvas.stroke(
					"path",
					{
						d: `M${engine.x + engine.w},${engine.cy} H${at(cards, index).x}`,
					},
					links,
				),
			);
	const cardToReport = mobile
		? [
				canvas.stroke(
					"path",
					{
						d: `M${layout.W / 2},${at(cards, 1).y + at(cards, 1).h} V${report.y}`,
					},
					links,
					C.faint,
				),
			]
		: cards.map((card) =>
				canvas.stroke(
					"path",
					{
						d: `M${card.x + card.w},${card.y + card.h / 2} C${card.x + card.w + 30},${card.y + card.h / 2} ${report.x - 30},${report.y + report.h / 2} ${report.x},${report.y + report.h / 2}`,
					},
					links,
					C.faint,
				),
			);

	// --- buyer question ----------------------------------------------------
	const queryGroup = canvas.el("g", {}, root);
	const queryLabel = canvas.text(
		"BUYER QUESTION",
		query.x + 2,
		query.y - 10,
		{ class: "mono", "font-size": 9.5, fill: C.hairline },
		queryGroup,
	);
	const queryBox = canvas.stroke(
		"path",
		{
			d: pill(
				query.x + 0.5,
				query.y + 0.5,
				query.w - 1,
				query.h - 1,
				query.h / 2 - 0.5,
			),
		},
		queryGroup,
		C.inkSoft,
	);
	const iconX = query.x + 21;
	const iconY = query.y + query.h / 2;
	const queryIcon = [
		canvas.stroke(
			"circle",
			{ cx: iconX - 1, cy: iconY - 1, r: 5.5 },
			queryGroup,
		),
		canvas.stroke("path", { d: `M${iconX + 3},${iconY + 3} l4,4` }, queryGroup),
	];
	const queryText = canvas.text(
		"",
		query.x + 38,
		query.y + query.h / 2 + 4.5,
		{
			"font-size": 13,
			"font-weight": 500,
			fill: C.ink,
		},
		queryGroup,
	);
	const caret = canvas.stroke(
		"line",
		{
			x1: 0,
			y1: query.y + query.h / 2 - 8,
			x2: 0,
			y2: query.y + query.h / 2 + 8,
		},
		queryGroup,
		C.accent,
	);
	const keyX = query.x + query.w - 34;
	const keyY = query.y + query.h / 2 - 10;
	const keyBackground = canvas.el(
		"rect",
		{
			x: keyX,
			y: keyY,
			width: 24,
			height: 20,
			rx: 6,
			fill: C.accentHighlight,
			opacity: 0,
		},
		queryGroup,
	);
	const keyBox = canvas.stroke(
		"rect",
		{ x: keyX + 0.5, y: keyY + 0.5, width: 23, height: 19, rx: 6 },
		queryGroup,
		C.faint,
	);
	const keyIcon = canvas.stroke(
		"path",
		{ d: `M${keyX + 16},${keyY + 6} v4 h-8 m3,-3 l-3,3 l3,3` },
		queryGroup,
		C.hairline,
	);
	const queryRing = canvas.stroke(
		"path",
		{
			d: pill(
				query.x + 0.5,
				query.y + 0.5,
				query.w - 1,
				query.h - 1,
				query.h / 2 - 0.5,
			),
		},
		root,
		C.accentGlow,
	);

	// --- engines -----------------------------------------------------------
	const engineNodes: EngineNode[] = engines.map((engine, index) => {
		const group = canvas.el("g", {}, root);
		const top = engine.cy - engine.h / 2;
		const glow = canvas.el(
			"rect",
			{
				x: engine.x - 4,
				y: top - 4,
				width: engine.w + 8,
				height: engine.h + 8,
				rx: engine.h / 2 + 4,
				fill: C.accentWash,
				opacity: 0,
			},
			group,
		);
		const box = canvas.stroke(
			"path",
			{
				d: pill(
					engine.x + 0.5,
					top + 0.5,
					engine.w - 1,
					engine.h - 1,
					engine.h / 2 - 0.5,
				),
			},
			group,
		);
		const cx = engine.x + 17;
		const cy = engine.cy;
		const icon =
			index === 0
				? canvas.stroke(
						"path",
						{
							d: `M${cx},${cy - 6} L${cx + 5.2},${cy - 3} V${cy + 3} L${cx},${cy + 6} L${cx - 5.2},${cy + 3} V${cy - 3} Z`,
						},
						group,
						C.inkSoft,
					)
				: canvas.stroke(
						"path",
						{
							d: `M${cx},${cy - 6.5} V${cy + 6.5} M${cx - 5.5},${cy - 3.5} L${cx + 5.5},${cy + 3.5} M${cx + 5.5},${cy - 3.5} L${cx - 5.5},${cy + 3.5}`,
						},
						group,
						C.inkSoft,
					);
		const label = canvas.text(
			at(ANSWERS, index).engine,
			engine.x + 31,
			engine.cy + 4.5,
			{ "font-size": 13, "font-weight": 550, fill: C.ink },
			group,
		);
		const spinnerX = engine.x + engine.w - 15;
		const spin = canvas.stroke(
			"path",
			{ d: arcPath(spinnerX, engine.cy, 5, 0, 4.2) },
			group,
			C.accent,
		);
		const check = canvas.stroke(
			"path",
			{ d: `M${spinnerX - 3.5},${engine.cy} l2.4,2.5 l4.8,-5` },
			group,
			C.accent,
		);
		const live = canvas.el(
			"circle",
			{ cx: spinnerX, cy: engine.cy, r: 2.3, fill: C.faint },
			group,
		);
		return { group, glow, box, icon, label, spin, check, live, spinnerX };
	});

	const soonNodes = soon.map((engine) => {
		const group = canvas.el("g", {}, root);
		const top = engine.cy - engine.h / 2;
		const box = canvas.stroke(
			"path",
			{
				d: pill(
					engine.x + 0.5,
					top + 0.5,
					engine.w - 1,
					engine.h - 1,
					engine.h / 2 - 0.5,
				),
				"stroke-dasharray": "3 4",
			},
			group,
			C.faint,
		);
		const label = canvas.text(
			mobile ? "MORE · SOON" : "SOON",
			engine.x + engine.w / 2,
			engine.cy + 3.5,
			{
				class: "mono",
				"font-size": 9,
				fill: C.hairline,
				"text-anchor": "middle",
			},
			group,
		);
		return { group, box, label };
	});

	// --- answer cards ------------------------------------------------------
	const cardNodes: CardNode[] = cards.map((card, cardIndex) => {
		const answer = at(ANSWERS, cardIndex);
		const group = canvas.el("g", {}, root);
		const background = canvas.el(
			"rect",
			{
				x: card.x,
				y: card.y,
				width: card.w,
				height: card.h,
				rx: 12,
				fill: C.paper,
				opacity: 0,
			},
			group,
		);
		const frame = canvas.stroke(
			"path",
			{ d: pill(card.x + 0.5, card.y + 0.5, card.w - 1, card.h - 1, 12) },
			group,
		);
		const header = canvas.text(
			`${answer.engine.toUpperCase()}  ·  ANSWER`,
			card.x + 16,
			card.y + 24,
			{ class: "mono", "font-size": 9.5, fill: C.text },
			group,
		);
		const queryCaption = canvas.text(
			`\u201C${QUERY}\u201D`,
			card.x + card.w - 16,
			card.y + 24,
			{ "font-size": 11, fill: C.hairline, "text-anchor": "end" },
			group,
		);
		if (mobile) {
			queryCaption.style.display = "none";
		}
		const divider = canvas.stroke(
			"line",
			{
				x1: card.x + 16,
				y1: card.y + 36,
				x2: card.x + card.w - 16,
				y2: card.y + 36,
			},
			group,
			C.rule,
		);
		const highlightLayer = canvas.el("g", {}, group);
		const units: UnitNode[] = card.text.units.map((unit, index) => {
			const x = card.x + 16 + unit.x;
			const y = card.y + 62 + unit.y;
			let highlight: SVGRectElement | null = null;
			if (unit.kind) {
				highlight = canvas.el(
					"rect",
					{
						x: x - 3,
						y: y - 13.5,
						width: unit.width + 6,
						height: 19,
						rx: 4,
						fill: unit.kind === "b" ? C.accentHighlight : C.competitorWash,
					},
					highlightLayer,
				);
			}
			let underline: SVGPathElement | null = null;
			if (unit.kind === "b") {
				underline = canvas.stroke(
					"line",
					{ x1: x - 1, y1: y + 4, x2: x + unit.width + 1, y2: y + 4 },
					highlightLayer,
					C.accent,
				);
			} else if (unit.kind === "c") {
				underline = canvas.stroke(
					"line",
					{
						x1: x,
						y1: y + 4,
						x2: x + unit.width,
						y2: y + 4,
						"stroke-dasharray": "1.5 2.5",
					},
					highlightLayer,
					C.competitor,
				);
			}
			const text = canvas.text(
				unit.text,
				x,
				y,
				{ "font-size": layout.fontSize, "font-weight": 400, fill: C.inkSoft },
				group,
			);
			return {
				text,
				highlight,
				underline,
				x,
				y,
				width: unit.width,
				kind: unit.kind,
				index,
			};
		});

		const chipTop = card.y + card.h - 34 - (card.chipRows - 1) * 28;
		const sourcesLabel = canvas.text(
			"SOURCES",
			card.x + 16,
			chipTop - 6,
			{ class: "mono", "font-size": 9.5, fill: C.hairline },
			group,
		);
		const chips: ChipNode[] = card.chips.map((sourceChip) => {
			const width = sourceChip.w;
			const x = card.x + 16 + sourceChip.x;
			const chipY = chipTop + sourceChip.y * 28;
			const chipGroup = canvas.el("g", {}, group);
			const fill = canvas.el(
				"rect",
				{
					x,
					y: chipY,
					width,
					height: 22,
					rx: 11,
					fill: C.accentWash,
					opacity: 0,
				},
				chipGroup,
			);
			const box = canvas.stroke(
				"path",
				{ d: pill(x + 0.5, chipY + 0.5, width - 1, 21, 10.5) },
				chipGroup,
				C.faint,
			);
			const link = canvas.stroke(
				"path",
				{ d: `M${x + 11},${chipY + 14} l5,-6 m-4,0 h4 v4` },
				chipGroup,
				C.hairline,
			);
			const label = canvas.text(
				sourceChip.domain,
				x + 22,
				chipY + 14.5,
				{ class: "mono", "font-size": 10, "font-weight": 500, fill: C.text },
				chipGroup,
			);
			return {
				group: chipGroup,
				fill,
				box,
				link,
				label,
				mine: sourceChip.mine,
				x,
				w: width,
				y: chipY,
			};
		});

		return {
			group,
			background,
			frame,
			header,
			query: queryCaption,
			divider,
			units,
			sourcesLabel,
			chips,
			layout: card,
		};
	});

	// --- report ------------------------------------------------------------
	const reportGroup = canvas.el("g", {}, root);
	const { x: reportX, y: reportY, w: reportWidth, h: reportHeight } = report;
	const reportBackground = canvas.el(
		"rect",
		{
			x: reportX,
			y: reportY,
			width: reportWidth,
			height: reportHeight,
			rx: 14,
			fill: C.paper,
			opacity: 0,
		},
		reportGroup,
	);
	const reportFrame = canvas.stroke(
		"path",
		{
			d: pill(
				reportX + 0.5,
				reportY + 0.5,
				reportWidth - 1,
				reportHeight - 1,
				14,
			),
		},
		reportGroup,
		C.inkSoft,
	);
	const reportHeader = canvas.text(
		"REPORT",
		reportX + 16,
		reportY + 24,
		{ class: "mono", "font-size": 9.5, fill: C.text },
		reportGroup,
	);
	const tagWidth = canvas.measure("SAMPLE DATA", 8.5, 500, true) + 14;
	const reportTag = canvas.el("g", {}, reportGroup);
	canvas.stroke(
		"path",
		{
			d: pill(
				reportX + reportWidth - 14 - tagWidth + 0.5,
				reportY + 12.5,
				tagWidth - 1,
				16,
				8,
			),
		},
		reportTag,
		C.faint,
	);
	canvas.text(
		"SAMPLE DATA",
		reportX + reportWidth - 14 - tagWidth / 2,
		reportY + 23.5,
		{
			class: "mono",
			"font-size": 8.5,
			fill: C.hairline,
			"text-anchor": "middle",
		},
		reportTag,
	);

	const gauge = mobile
		? { cx: reportX + 84, cy: reportY + 112, radius: 58 }
		: { cx: reportX + reportWidth / 2, cy: reportY + 124, radius: 56 };
	const rowStart = mobile ? reportY + 64 : reportY + 222;
	const rowLeft = mobile ? reportX + 170 : reportX + 16;
	const rowRight = mobile
		? reportX + reportWidth - 14
		: reportX + reportWidth - 16;
	const chipY = mobile ? reportY + 162 : reportY + 326;
	const chipX = mobile ? reportX + 170 : reportX + 16;

	const reportQuery = mobile
		? null
		: canvas.text(
				`\u201C${QUERY}\u201D`,
				reportX + 16,
				reportY + 46,
				{ "font-size": 11, fill: C.hairline },
				reportGroup,
			);

	const arcFrom = Math.PI * 0.75;
	const arcTo = Math.PI * 2.25;
	const gaugeTrack = canvas.stroke(
		"path",
		{ d: arcPath(gauge.cx, gauge.cy, gauge.radius, arcFrom, arcTo) },
		reportGroup,
		C.rule,
	);
	gaugeTrack.setAttribute("stroke-width", "5");
	const gaugeArc = canvas.stroke(
		"path",
		{ d: arcPath(gauge.cx, gauge.cy, gauge.radius, arcFrom, arcTo) },
		reportGroup,
		C.accent,
	);
	gaugeArc.setAttribute("stroke-width", "5");

	const gaugeTicks = canvas.el("g", {}, reportGroup);
	for (let tick = 0; tick <= 10; tick += 1) {
		const angle = arcFrom + ((arcTo - arcFrom) * tick) / 10;
		const inner = gauge.radius - 9;
		const outer = gauge.radius - (tick % 5 ? 12 : 15);
		canvas.stroke(
			"line",
			{
				x1: gauge.cx + inner * Math.cos(angle),
				y1: gauge.cy + inner * Math.sin(angle),
				x2: gauge.cx + outer * Math.cos(angle),
				y2: gauge.cy + outer * Math.sin(angle),
			},
			gaugeTicks,
			C.faint,
		);
	}

	const gaugeHalo = canvas.el(
		"circle",
		{
			cx: gauge.cx,
			cy: gauge.cy,
			r: gauge.radius + 8,
			fill: "none",
			stroke: C.accentFaint,
			"stroke-width": HAIRLINE,
			opacity: 0,
		},
		reportGroup,
	);
	const gaugeNumber = canvas.text(
		"0",
		gauge.cx,
		gauge.cy + 9,
		{
			"font-size": 34,
			"font-weight": 650,
			fill: C.ink,
			"text-anchor": "middle",
			"letter-spacing": "-1",
		},
		reportGroup,
	);
	const gaugeLabel = canvas.text(
		"AI VISIBILITY",
		gauge.cx,
		gauge.cy + 28,
		{
			class: "mono",
			"font-size": 8.5,
			fill: C.text,
			"text-anchor": "middle",
		},
		reportGroup,
	);
	const gaugeLabelSecond = canvas.text(
		"SCORE",
		gauge.cx,
		gauge.cy + 40,
		{
			class: "mono",
			"font-size": 8.5,
			fill: C.text,
			"text-anchor": "middle",
		},
		reportGroup,
	);

	const rowDefinitions: { key: RowKey; label: string; required: number }[] = [
		{ key: "mention", label: "Mentioned", required: 2 },
		{ key: "citation", label: "Cited", required: 2 },
		{ key: "competitor", label: "Competitors", required: 0 },
	];
	const rows: RowNode[] = rowDefinitions.map((definition, index) => {
		const y = rowStart + index * 32;
		const group = canvas.el("g", {}, reportGroup);
		const separator = canvas.stroke(
			"line",
			{ x1: rowLeft, y1: y + 12, x2: rowRight, y2: y + 12 },
			group,
			C.rule,
		);
		if (definition.key === "mention") {
			canvas.el(
				"rect",
				{
					x: rowLeft,
					y: y - 9,
					width: 14,
					height: 10,
					rx: 3,
					fill: C.accentHighlight,
					stroke: C.accent,
					"stroke-width": 1,
				},
				group,
			);
		} else if (definition.key === "citation") {
			canvas.stroke(
				"path",
				{ d: pill(rowLeft + 0.5, y - 9, 14, 10, 5) },
				group,
				C.accent,
			);
		} else {
			canvas.el(
				"rect",
				{
					x: rowLeft,
					y: y - 9,
					width: 14,
					height: 10,
					rx: 3,
					fill: C.competitorWash,
					stroke: C.competitor,
					"stroke-width": 1,
				},
				group,
			);
		}
		canvas.text(
			definition.label,
			rowLeft + 22,
			y,
			{ "font-size": 12, fill: C.inkSoft },
			group,
		);
		const value = canvas.text(
			"0",
			rowRight,
			y,
			{
				class: "mono",
				"font-size": 12.5,
				"font-weight": 500,
				fill: C.hairline,
				"text-anchor": "end",
			},
			group,
		);
		const ring = canvas.el(
			"circle",
			{
				cx: rowRight - 8,
				cy: y - 4,
				r: 6,
				fill: "none",
				stroke: C.accent,
				"stroke-width": HAIRLINE,
				opacity: 0,
			},
			group,
		);
		return {
			key: definition.key,
			required: definition.required,
			group,
			separator,
			value,
			ring,
			targetX: rowRight - 10,
			targetY: y - 4,
		};
	});

	let competitorChipX = chipX;
	const competitorChips = ["Northwind", "Globex"].map((name) => {
		const width = canvas.measure(name, 10.5, 500) + 18;
		const x = competitorChipX;
		competitorChipX += width + 6;
		const group = canvas.el("g", {}, reportGroup);
		canvas.el(
			"rect",
			{ x, y: chipY, width, height: 20, rx: 10, fill: C.competitorWash },
			group,
		);
		canvas.text(
			name,
			x + width / 2,
			chipY + 13.8,
			{
				"font-size": 10.5,
				"font-weight": 500,
				fill: C.competitorStrong,
				"text-anchor": "middle",
			},
			group,
		);
		return group;
	});

	// --- marks that fly into the report -----------------------------------
	const marks: MarkNode[] = MARKS.map((mark) => {
		const card = at(cardNodes, mark.card);
		let sourceX: number;
		let sourceY: number;
		if (mark.kind === "citation") {
			const chip = card.chips.find((candidate) => candidate.mine);
			if (!chip) {
				throw new Error("Sample answer has no cited source chip");
			}
			sourceX = chip.x + chip.w / 2;
			sourceY = chip.y + 11;
		} else {
			const units = card.units.filter((unit) =>
				mark.kind === "mention" ? unit.kind === "b" : unit.kind === "c",
			);
			const unit = at(units, mark.ref);
			sourceX = unit.x + unit.width / 2;
			sourceY = unit.y - 4;
		}
		const row = rows.find((candidate) => candidate.key === mark.kind);
		if (!row) {
			throw new Error(`Report has no row for ${mark.kind}`);
		}
		const targetX = row.targetX;
		const targetY = row.targetY;
		const d = mobile
			? `M${sourceX},${sourceY} C${sourceX + 60},${sourceY + 40} ${targetX + 30},${targetY - 90} ${targetX},${targetY}`
			: `M${sourceX},${sourceY} C${sourceX + 90},${sourceY - 30} ${targetX - 80},${targetY - 60} ${targetX},${targetY}`;
		const path = canvas.stroke(
			"path",
			{ d },
			root,
			mark.kind === "competitor" ? C.competitor : C.accentGlow,
		);
		return {
			path,
			dot: canvas.el(
				"circle",
				{
					r: 3,
					fill: mark.kind === "competitor" ? C.competitorStrong : C.accent,
				},
				root,
			),
			halo: canvas.stroke(
				"circle",
				{ r: 7 },
				root,
				mark.kind === "competitor" ? C.competitor : C.accentFaint,
			),
			kind: mark.kind,
		};
	});

	const reduceFade = (time: number) =>
		easeOut(progress(0, 0.2, time)) *
		(1 - progress(DURATION - 0.6, DURATION - 0.12, time));

	return (time: number) => {
		root.style.opacity = String(reduceFade(time));

		// buyer question
		setOpacity(queryLabel, easeOut(progress(0.25, 0.55, time)));
		reveal(queryBox, easeInOut(progress(0.2, 0.75, time)));
		for (const part of queryIcon) {
			reveal(part, easeInOut(progress(0.45, 0.8, time)));
		}
		const typed = Math.round(QUERY.length * progress(0.95, 2, time));
		const typedText = QUERY.slice(0, typed);
		queryText.textContent = typedText;
		const typedWidth = typedText ? canvas.measure(typedText, 13, 500) : 0;
		const caretX = query.x + 39.5 + typedWidth;
		caret.setAttribute("x1", String(caretX));
		caret.setAttribute("x2", String(caretX));
		const caretVisible =
			time > 0.7 && time < 2.1
				? time < 0.95 || time > 2
					? Math.floor(time * 3) % 2
						? 0.2
						: 1
					: 1
				: 0;
		setOpacity(caret, caretVisible);
		reveal(keyBox, easeInOut(progress(0.55, 0.85, time)));
		reveal(keyIcon, easeInOut(progress(0.65, 0.9, time)));
		const press = progress(2.05, 2.15, time) * (1 - progress(2.35, 2.7, time));
		keyBackground.setAttribute("opacity", String(press));
		keyIcon.setAttribute("stroke", press > 0.3 ? C.accent : C.hairline);
		const ringProgress = progress(2.05, 2.75, time);
		reveal(queryRing, ringProgress > 0 ? 1 : 0);
		queryRing.style.opacity =
			ringProgress > 0 && ringProgress < 1
				? String((1 - ringProgress) * 0.9)
				: "0";
		const centreX = query.x + query.w / 2;
		const centreY = query.y + query.h / 2;
		queryRing.setAttribute(
			"transform",
			`translate(${centreX},${centreY}) scale(${1 + ringProgress * 0.06},${1 + ringProgress * 0.35}) translate(${-centreX},${-centreY})`,
		);

		// engines
		engineNodes.forEach((node, index) => {
			const start = 0.5 + index * 0.1;
			reveal(node.box, easeInOut(progress(start, start + 0.5, time)));
			reveal(node.icon, easeInOut(progress(start + 0.2, start + 0.55, time)));
			setOpacity(
				node.label,
				easeOut(progress(start + 0.25, start + 0.5, time)),
			);
			const active = time >= 2.62;
			const answer = at(ANSWERS, index);
			const done = time >= answer.end;
			node.box.setAttribute("stroke", active ? C.accent : C.hairline);
			node.glow.setAttribute(
				"opacity",
				active ? String(0.9 * easeOut(progress(2.62, 2.9, time))) : "0",
			);
			setOpacity(
				node.live,
				easeOut(progress(start + 0.3, start + 0.5, time)) * (active ? 0 : 1),
			);
			if (active && !done) {
				reveal(node.spin, 1);
				node.spin.style.opacity = "1";
				node.spin.setAttribute(
					"transform",
					`rotate(${time * 400} ${node.spinnerX} ${at(layout.engines, index).cy})`,
				);
			} else {
				node.spin.style.opacity = "0";
			}
			reveal(
				node.check,
				easeInOut(progress(answer.end, answer.end + 0.3, time)),
			);
		});

		soonNodes.forEach((node, index) => {
			setOpacity(
				node.group,
				0.9 * easeOut(progress(0.8 + index * 0.1, 1.3 + index * 0.1, time)),
			);
		});

		// fan-out
		fan.forEach((path) => {
			reveal(path, easeInOut(progress(2.1, 2.62, time)));
		});
		soonFan.forEach((path) => {
			path.style.opacity = String(easeOut(progress(2.2, 2.7, time)));
		});
		fanDots.forEach((node, index) => {
			const amount = easeInOut(progress(2.1, 2.62, time));
			const visible = time > 2.1 && time < 2.7;
			const path = at(fan, index);
			const point = path.getPointAtLength(path.getTotalLength() * amount);
			node.dot.setAttribute("cx", String(point.x));
			node.dot.setAttribute("cy", String(point.y));
			node.halo.setAttribute("cx", String(point.x));
			node.halo.setAttribute("cy", String(point.y));
			setOpacity(node.dot, visible ? 1 : 0);
			setOpacity(node.halo, visible ? 0.8 : 0);
		});
		engineToCard.forEach((path, index) => {
			const answer = at(ANSWERS, index);
			reveal(
				path,
				easeInOut(progress(answer.start - 0.5, answer.start - 0.2, time)),
			);
		});
		cardToReport.forEach((path) => {
			reveal(path, easeInOut(progress(6.35, 6.7, time)));
		});

		// answer cards
		cardNodes.forEach((node, cardIndex) => {
			const answer = at(ANSWERS, cardIndex);
			const start = answer.start - 0.5;
			reveal(node.frame, easeInOut(progress(start, start + 0.5, time)));
			node.background.setAttribute(
				"opacity",
				String(easeOut(progress(start + 0.2, start + 0.5, time))),
			);
			setOpacity(
				node.header,
				easeOut(progress(start + 0.2, start + 0.45, time)),
			);
			if (!mobile) {
				setOpacity(
					node.query,
					easeOut(progress(start + 0.3, start + 0.55, time)),
				);
			}
			reveal(
				node.divider,
				easeInOut(progress(start + 0.25, start + 0.55, time)),
			);
			const highlight = at(HIGHLIGHTS, cardIndex);
			let competitorIndex = 0;
			for (const unit of node.units) {
				const at_time =
					answer.start +
					((answer.end - answer.start - 0.5) * unit.index) / node.units.length;
				setOpacity(unit.text, easeOut(progress(at_time, at_time + 0.14, time)));
				if (!unit.kind) {
					continue;
				}
				const highlightAt =
					unit.kind === "b"
						? highlight.brand
						: at(highlight.competitors, competitorIndex++);
				const amount = easeInOut(
					progress(highlightAt, highlightAt + 0.28, time),
				);
				if (unit.highlight) {
					unit.highlight.setAttribute(
						"width",
						String((unit.width + 6) * amount),
					);
					unit.highlight.style.opacity = amount > 0 ? "1" : "0";
				}
				if (unit.underline) {
					reveal(unit.underline, amount);
				}
				unit.text.setAttribute(
					"fill",
					amount > 0.5
						? unit.kind === "b"
							? C.accentStrong
							: C.competitorStrong
						: C.inkSoft,
				);
				unit.text.setAttribute(
					"font-weight",
					amount > 0.5 && unit.kind === "b" ? "600" : "400",
				);
			}
			setOpacity(
				node.sourcesLabel,
				easeOut(progress(answer.end - 0.15, answer.end + 0.1, time)),
			);
			node.chips.forEach((chip, chipIndex) => {
				const startAt = answer.end - 0.1 + chipIndex * 0.1;
				setOpacity(chip.group, easeOut(progress(startAt, startAt + 0.2, time)));
				chip.group.setAttribute(
					"transform",
					`translate(0,${(1 - easeOut(progress(startAt, startAt + 0.25, time))) * 5})`,
				);
				if (!chip.mine || Number.isNaN(highlight.source)) {
					return;
				}
				const amount = easeInOut(
					progress(highlight.source, highlight.source + 0.28, time),
				);
				chip.fill.setAttribute("opacity", String(amount));
				chip.box.setAttribute("stroke", amount > 0.4 ? C.accent : C.faint);
				chip.link.setAttribute("stroke", amount > 0.4 ? C.accent : C.hairline);
				chip.label.setAttribute("fill", amount > 0.4 ? C.accentStrong : C.text);
			});
		});

		// report
		reveal(reportFrame, easeInOut(progress(0.7, 1.35, time)));
		reportBackground.setAttribute(
			"opacity",
			String(easeOut(progress(0.9, 1.3, time))),
		);
		setOpacity(reportHeader, easeOut(progress(1, 1.3, time)));
		setOpacity(reportTag, easeOut(progress(1.1, 1.4, time)));
		if (reportQuery) {
			setOpacity(reportQuery, easeOut(progress(2.2, 2.6, time)));
		}
		reveal(gaugeTrack, easeInOut(progress(0.9, 1.6, time)));
		setOpacity(gaugeTicks, easeOut(progress(1.2, 1.6, time)));
		setOpacity(gaugeLabel, easeOut(progress(1.2, 1.5, time)));
		setOpacity(gaugeLabelSecond, easeOut(progress(1.2, 1.5, time)));
		const gaugeProgress = easeInOut(progress(GAUGE_START, GAUGE_END, time));
		const score = Math.round(SCORE * gaugeProgress);
		reveal(gaugeArc, (gaugeProgress * SCORE) / 100);
		if (gaugeProgress <= 0) {
			gaugeArc.style.opacity = "0";
		}
		gaugeNumber.textContent = String(score);
		setOpacity(gaugeNumber, easeOut(progress(1.2, 1.5, time)));
		gaugeNumber.setAttribute("fill", gaugeProgress > 0 ? C.ink : C.faint);
		const haloProgress = progress(GAUGE_END - 0.05, GAUGE_END + 0.8, time);
		gaugeHalo.setAttribute("r", String(gauge.radius + 6 + haloProgress * 14));
		gaugeHalo.setAttribute(
			"opacity",
			haloProgress > 0 && haloProgress < 1 ? String(1 - haloProgress) : "0",
		);

		const counts: Record<RowKey, number> = {
			mention: 0,
			citation: 0,
			competitor: 0,
		};
		const lastLanded: Record<RowKey, number> = {
			mention: -1,
			citation: -1,
			competitor: -1,
		};
		marks.forEach((mark, index) => {
			const start = at(MARKS, index).start;
			const amount = easeInOut(progress(start, start + MARK_FLY, time));
			const pathLength = mark.path.getTotalLength();
			reveal(mark.path, amount);
			mark.path.style.opacity =
				time < start
					? "0"
					: String(
							0.7 *
								(1 - progress(start + MARK_FLY, start + MARK_FLY + 0.4, time)),
						);
			const point = mark.path.getPointAtLength(pathLength * amount);
			const visible = time > start && time < start + MARK_FLY + 0.02;
			mark.dot.setAttribute("cx", String(point.x));
			mark.dot.setAttribute("cy", String(point.y));
			mark.halo.setAttribute("cx", String(point.x));
			mark.halo.setAttribute("cy", String(point.y));
			setOpacity(mark.dot, visible ? 1 : 0);
			setOpacity(mark.halo, visible ? 0.7 : 0);
			if (time >= start + MARK_FLY) {
				counts[mark.kind] += 1;
				lastLanded[mark.kind] = start + MARK_FLY;
			}
		});

		rows.forEach((row, index) => {
			const start = 1.1 + index * 0.1;
			setOpacity(row.group, easeOut(progress(start, start + 0.3, time)));
			reveal(row.separator, easeInOut(progress(start, start + 0.4, time)));
			const count = counts[row.key];
			row.value.textContent = row.required
				? `${count}/${row.required}`
				: String(count);
			row.value.setAttribute("fill", count ? C.ink : C.hairline);
			const landed = lastLanded[row.key];
			const ringProgress =
				landed < 0 ? -1 : progress(landed, landed + 0.6, time);
			row.ring.setAttribute("r", String(6 + 10 * easeOut(ringProgress)));
			row.ring.setAttribute(
				"opacity",
				ringProgress >= 0 && ringProgress < 1 ? String(1 - ringProgress) : "0",
			);
		});

		const competitorLandings = MARKS.filter(
			(mark) => mark.kind === "competitor",
		).map((mark) => mark.start + MARK_FLY);
		competitorChips.forEach((chip, index) => {
			const start = at(competitorLandings, index);
			const amount = easeOut(progress(start, start + 0.3, time));
			setOpacity(chip, amount);
			chip.setAttribute("transform", `translate(0,${(1 - amount) * 4})`);
		});
	};
}

export const heroFanOutScene: SceneDefinition<HeroLayout> = {
	id: "hero-fan-out",
	duration: DURATION,
	finalTime: 9.9,
	layout,
	build,
};
