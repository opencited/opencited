import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type { ReactNode } from "react";

interface EmailLayoutProps {
	preview: string;
	title: string;
	footerNote?: string;
	children: ReactNode;
}

const main = {
	backgroundColor: "#fafafa",
	fontFamily:
		'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
	color: "#18181b",
};

const card = {
	maxWidth: "560px",
	backgroundColor: "#ffffff",
	border: "1px solid #e4e4e7",
	borderRadius: "12px",
	overflow: "hidden",
};

const header = {
	padding: "28px 28px 20px",
	borderBottom: "1px solid #f4f4f5",
};

const brand = {
	margin: "0",
	fontSize: "13px",
	fontWeight: "600",
	letterSpacing: "0.04em",
	textTransform: "uppercase" as const,
	color: "#71717a",
};

const titleStyle = {
	margin: "8px 0 0",
	fontSize: "22px",
	lineHeight: "1.3",
	fontWeight: "600",
	color: "#18181b",
};

const body = {
	padding: "24px 28px 28px",
};

const footer = {
	padding: "20px 28px",
	backgroundColor: "#fafafa",
	borderTop: "1px solid #f4f4f5",
};

const footerText = {
	margin: "0 0 8px",
	fontSize: "12px",
	lineHeight: "1.5",
	color: "#71717a",
};

const footerLink = {
	fontSize: "12px",
	lineHeight: "1.5",
	color: "#18181b",
	textDecoration: "underline",
};

export function EmailLayout({
	preview,
	title,
	footerNote = "You received this because you requested a scan on OpenCited.",
	children,
}: EmailLayoutProps) {
	return (
		<Html lang="en">
			<Head />
			<Preview>{preview}</Preview>
			<Body style={main}>
				<Container style={{ padding: "32px 16px" }}>
					<Section style={card}>
						<Section style={header}>
							<Text style={brand}>OpenCited</Text>
							<Heading as="h1" style={titleStyle}>
								{title}
							</Heading>
						</Section>
						<Section style={body}>{children}</Section>
						<Section style={footer}>
							<Text style={footerText}>{footerNote}</Text>
							<Link href="https://opencited.com" style={footerLink}>
								opencited.com
							</Link>
						</Section>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}
