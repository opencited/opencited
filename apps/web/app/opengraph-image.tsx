import { ImageResponse } from "next/og";
import { LANDING_DESCRIPTION } from "./lib/landing-seo";

export const alt =
	"OpenCited — see what AI tells your buyers about you. Sample report with mentions, citations and an AI Visibility Score.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Site-wide share card. Generated at build time, no image asset to maintain.
 * Uses the marketing surface tokens from DESIGN.md §6.
 */
export default function OpenGraphImage() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				background: "#fbfcfc",
				padding: "72px",
				fontFamily:
					'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
				<div
					style={{
						width: 40,
						height: 32,
						border: "2px solid #0f172a",
						borderRadius: 8,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: 18,
						fontWeight: 700,
						color: "#059669",
					}}
				>
					●
				</div>
				<div style={{ display: "flex", fontSize: 30, fontWeight: 650 }}>
					<span style={{ color: "#0f172a" }}>Open</span>
					<span style={{ color: "#047857" }}>Cited</span>
				</div>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						fontSize: 78,
						fontWeight: 700,
						lineHeight: 1.05,
						letterSpacing: "-3px",
						color: "#0f172a",
						maxWidth: 920,
					}}
				>
					<div style={{ display: "flex" }}>
						<span>See what AI tells your</span>
					</div>
					<div style={{ display: "flex" }}>
						<span>buyers&nbsp;</span>
						<span style={{ color: "#059669" }}>about you.</span>
					</div>
				</div>
				<div
					style={{
						display: "flex",
						fontSize: 30,
						lineHeight: 1.45,
						color: "#475569",
						maxWidth: 820,
					}}
				>
					{LANDING_DESCRIPTION}
				</div>
			</div>

			<div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
				{["ChatGPT", "Perplexity", "AI Visibility Score"].map((label) => (
					<div
						key={label}
						style={{
							display: "flex",
							alignItems: "center",
							border: "1.25px solid #e2e8f0",
							borderRadius: 999,
							padding: "10px 20px",
							fontSize: 22,
							color: "#334155",
						}}
					>
						{label}
					</div>
				))}
				<div
					style={{
						marginLeft: "auto",
						fontSize: 20,
						color: "#64748b",
						fontFamily: "ui-monospace, monospace",
					}}
				>
					Free during beta
				</div>
			</div>
		</div>,
		{ ...size },
	);
}
