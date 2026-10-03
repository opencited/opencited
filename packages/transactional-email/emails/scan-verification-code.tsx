import { Heading, Link, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_components/email-layout";
import { sampleVerification } from "../src/sample-data";

export interface ScanVerificationCodeEmailProps {
	domain: string;
	code: string;
	resultUrl?: string;
}

const intro = {
	margin: "0 0 16px",
	fontSize: "15px",
	lineHeight: "1.6",
	color: "#3f3f46",
};

const codeBox = {
	margin: "0 0 16px",
	padding: "20px 16px",
	backgroundColor: "#fafafa",
	border: "1px dashed #d4d4d8",
	borderRadius: "10px",
	textAlign: "center" as const,
};

const codeLabel = {
	margin: "0 0 6px",
	fontSize: "12px",
	fontWeight: "500",
	letterSpacing: "0.06em",
	textTransform: "uppercase" as const,
	color: "#71717a",
};

const codeValue = {
	margin: "0",
	fontSize: "32px",
	fontWeight: "700",
	letterSpacing: "0.35em",
	fontFamily:
		'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace',
	color: "#18181b",
};

const hint = {
	margin: "0",
	fontSize: "13px",
	lineHeight: "1.5",
	color: "#71717a",
};

export function ScanVerificationCodeEmail({
	domain,
	code,
	resultUrl,
}: ScanVerificationCodeEmailProps) {
	return (
		<EmailLayout preview={`Your code is ${code}`} title="Verify your email">
			<Text style={intro}>
				Enter this code on the scan results page to unlock your full technical
				report for <strong style={{ color: "#18181b" }}>{domain}</strong>.
			</Text>
			<Section style={codeBox}>
				<Text style={codeLabel}>Verification code</Text>
				<Heading as="h2" style={codeValue}>
					{code}
				</Heading>
			</Section>
			{resultUrl ? (
				<Text style={intro}>
					Share your free result (top issues only):{" "}
					<Link href={resultUrl} style={{ color: "#18181b" }}>
						{resultUrl}
					</Link>
				</Text>
			) : null}
			<Text style={hint}>Expires in 10 minutes. Do not share this code.</Text>
		</EmailLayout>
	);
}

ScanVerificationCodeEmail.PreviewProps =
	sampleVerification satisfies ScanVerificationCodeEmailProps;

export default ScanVerificationCodeEmail;
