import { Heading, Link, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_components/email-layout";
import { readinessStyle } from "../src/readiness";
import { sampleScanReport } from "../src/sample-data";

export interface ScanIssue {
	check: string;
	issue: string;
	howToFix: string;
}

export interface ScanFullReportEmailProps {
	domain: string;
	score: number;
	readiness: string;
	issues: ScanIssue[];
}

function siteUrl(domain: string) {
	return `https://${domain.replace(/^https?:\/\//, "")}`;
}

const intro = {
	margin: "0 0 20px",
	fontSize: "15px",
	lineHeight: "1.6",
	color: "#3f3f46",
};

const scoreCard = {
	padding: "20px",
	background: "linear-gradient(180deg,#fafafa 0%,#ffffff 100%)",
	border: "1px solid #e4e4e7",
	borderRadius: "12px",
	marginBottom: "24px",
};

const scoreCircle = {
	width: "72px",
	height: "72px",
	borderRadius: "999px",
	border: "6px solid #e4e4e7",
	textAlign: "center" as const,
	lineHeight: "60px",
	fontSize: "22px",
	fontWeight: "700",
	color: "#18181b",
};

const scoreLabel = {
	margin: "0 0 6px",
	fontSize: "13px",
	color: "#71717a",
};

const scoreValue = {
	margin: "0 0 8px",
	fontSize: "28px",
	lineHeight: "1.1",
	fontWeight: "700",
	color: "#18181b",
};

const scoreSuffix = {
	fontSize: "16px",
	fontWeight: "500",
	color: "#71717a",
};

const sectionTitle = {
	margin: "0 0 12px",
	fontSize: "14px",
	fontWeight: "600",
	letterSpacing: "0.02em",
	textTransform: "uppercase" as const,
	color: "#71717a",
};

const issueCard = {
	padding: "16px",
	backgroundColor: "#fafafa",
	border: "1px solid #e4e4e7",
	borderRadius: "10px",
	marginBottom: "12px",
};

const checkTag = {
	display: "inline-block",
	padding: "2px 8px",
	fontSize: "11px",
	fontWeight: "600",
	fontFamily:
		'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace',
	color: "#3f3f46",
	backgroundColor: "#ffffff",
	border: "1px solid #e4e4e7",
	borderRadius: "6px",
};

const issueTitle = {
	margin: "8px 0",
	fontSize: "15px",
	lineHeight: "1.5",
	fontWeight: "600",
	color: "#18181b",
};

const issueFix = {
	margin: "0",
	fontSize: "14px",
	lineHeight: "1.55",
	color: "#52525b",
};

const outro = {
	margin: "24px 0 0",
	fontSize: "13px",
	lineHeight: "1.5",
	color: "#71717a",
};

export function ScanFullReportEmail({
	domain,
	score,
	readiness,
	issues,
}: ScanFullReportEmailProps) {
	const readinessMeta = readinessStyle(readiness);
	const url = siteUrl(domain);

	return (
		<EmailLayout
			preview={`${domain} scored ${score}/100 — ${readinessMeta.label}`}
			title="Your full scan report"
			footerNote="You unlocked this report on OpenCited. We'll email you when we launch if you joined the waitlist."
		>
			<Text style={intro}>
				Here is your full AI readiness scan for{" "}
				<Link href={url} style={{ color: "#18181b", fontWeight: "600" }}>
					{domain}
				</Link>
				.
			</Text>

			<Section style={scoreCard}>
				<table
					role="presentation"
					width="100%"
					cellPadding={0}
					cellSpacing={0}
					style={{ borderCollapse: "collapse" }}
				>
					<tbody>
						<tr>
							<td width={88} valign="middle" style={{ paddingRight: "16px" }}>
								<div style={scoreCircle}>{score}</div>
							</td>
							<td valign="middle">
								<Text style={scoreLabel}>Technical readiness score</Text>
								<Text style={scoreValue}>
									{score}
									<span style={scoreSuffix}>/100</span>
								</Text>
								<span
									style={{
										display: "inline-block",
										padding: "4px 10px",
										fontSize: "12px",
										fontWeight: "600",
										color: readinessMeta.color,
										backgroundColor: readinessMeta.background,
										borderRadius: "999px",
									}}
								>
									{readinessMeta.label}
								</span>
							</td>
						</tr>
					</tbody>
				</table>
			</Section>

			<Heading as="h2" style={sectionTitle}>
				{issues.length === 0 ? "Summary" : `Issues (${issues.length})`}
			</Heading>

			{issues.length === 0 ? (
				<Text style={intro}>
					No issues found — robots.txt, sitemap, HTTPS, structured data, and AI
					crawler access all check out.
				</Text>
			) : (
				issues.map((issue) => (
					<Section key={`${issue.check}-${issue.issue}`} style={issueCard}>
						<span style={checkTag}>{issue.check}</span>
						<Text style={issueTitle}>{issue.issue}</Text>
						<Text style={issueFix}>
							<strong style={{ color: "#3f3f46" }}>How to fix:</strong>{" "}
							{issue.howToFix}
						</Text>
					</Section>
				))
			)}

			<Text style={outro}>
				Run another scan anytime on the homepage to track changes over time.
			</Text>
		</EmailLayout>
	);
}

ScanFullReportEmail.PreviewProps =
	sampleScanReport satisfies ScanFullReportEmailProps;

export default ScanFullReportEmail;
