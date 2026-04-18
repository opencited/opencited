import type { Metadata } from "next";
import localFont from "next/font/local";
import "@opencited/ui/styles.css";
import "./globals.css";

const geistSans = localFont({
	src: "./fonts/GeistVF.woff",
	variable: "--font-geist-sans",
});
const geistMono = localFont({
	src: "./fonts/GeistMonoVF.woff",
	variable: "--font-geist-mono",
});

export const metadata: Metadata = {
	title: "OpenCited — AEO Analysis & Optimization",
	description:
		"Open source tool to analyze and optimize your website's Answer Engine Optimization",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${geistSans.variable} ${geistMono.variable}`}>
				<script
					dangerouslySetInnerHTML={{
						__html: `
							(function() {
								try {
									var theme = localStorage.getItem('opencited-theme');
									if (!theme) {
										theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
									}
									document.documentElement.setAttribute('data-theme', theme);
								} catch (e) {}
							})();
						`,
					}}
				/>
				{children}
			</body>
		</html>
	);
}
