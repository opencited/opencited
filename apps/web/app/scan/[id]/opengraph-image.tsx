import { ImageResponse } from "next/og";
import { loadPublicScanResult } from "@/app/lib/load-public-scan-result";
import { READINESS_LABELS } from "@/app/lib/scan-display";

export const alt = "OpenCited scan result";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type OgProps = {
	params: Promise<{ id: string }>;
};

export default async function ScanOpenGraphImage({ params }: OgProps) {
	const { id } = await params;
	const result = await loadPublicScanResult(id);
	const readinessLabel = READINESS_LABELS[result.readiness];

	return new ImageResponse(
		<div
			style={{
				height: "100%",
				width: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				background: "linear-gradient(180deg, #fafafa 0%, #ffffff 100%)",
				padding: "64px",
				fontFamily:
					'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
				<p
					style={{
						margin: 0,
						fontSize: 28,
						fontWeight: 600,
						color: "#71717a",
					}}
				>
					OpenCited scan
				</p>
				<p
					style={{
						margin: 0,
						fontSize: 56,
						fontWeight: 700,
						color: "#18181b",
						lineHeight: 1.1,
					}}
				>
					{result.domain}
				</p>
			</div>
			<div style={{ display: "flex", alignItems: "flex-end", gap: "32px" }}>
				<div
					style={{
						width: 140,
						height: 140,
						borderRadius: "999px",
						border: "8px solid #e4e4e7",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: 48,
						fontWeight: 700,
						color: "#18181b",
					}}
				>
					{result.score}
				</div>
				<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
					<p
						style={{
							margin: 0,
							fontSize: 36,
							fontWeight: 700,
							color: "#18181b",
						}}
					>
						{result.score}/100
					</p>
					<p
						style={{
							margin: 0,
							fontSize: 24,
							fontWeight: 600,
							color: "#52525b",
						}}
					>
						{readinessLabel}
					</p>
				</div>
			</div>
		</div>,
		{ ...size },
	);
}
