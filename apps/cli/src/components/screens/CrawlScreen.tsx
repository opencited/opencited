import React from "react";
import { Box, Text, Newline, Spacer } from "ink";
import { Header } from "../parts/Header";
import { Footer } from "../parts/Footer";
import { LoadingDots } from "../common/LoadingDots";
import type { InputModeOption } from "../../types";

interface CrawlScreenProps {
	input: string;
	inputModes: InputModeOption[];
	inputModeIndex: number;
	loading: boolean;
	loadingText: string;
	error: string | null;
	columns: number;
}

function arePropsEqual(
	prev: CrawlScreenProps,
	next: CrawlScreenProps,
): boolean {
	return (
		prev.input === next.input &&
		prev.inputModeIndex === next.inputModeIndex &&
		prev.loading === next.loading &&
		prev.loadingText === next.loadingText &&
		prev.error === next.error &&
		prev.columns === next.columns
	);
}

export const CrawlScreen: React.FC<CrawlScreenProps> = React.memo(
	({
		input,
		inputModes,
		inputModeIndex,
		loading,
		loadingText,
		error,
		columns,
	}) => {
		const currentInputMode = inputModes[inputModeIndex];

		if (loading) {
			return (
				<Box flexDirection="column">
					<Header title="Crawl Sitemap" columns={columns} />
					<Newline />
					<Text>
						<Text color="cyan">{loadingText}</Text>
						<LoadingDots />
					</Text>
					<Newline />
					<Text dimColor>{input}</Text>
				</Box>
			);
		}

		return (
			<Box flexDirection="column">
				<Header title="Crawl Sitemap" columns={columns} />
				<Newline />
				<Text dimColor>Input Mode:</Text>
				{inputModes.map((m, i) => (
					<Text
						key={m.label}
						color={i === inputModeIndex ? "green" : "dimColor"}
					>
						{i === inputModeIndex ? "● " : "  "}
						{m.label} - {m.description}
					</Text>
				))}
				<Newline />
				<Text dimColor>Enter {currentInputMode.label}:</Text>
				<Box>
					<Text color="green">{"> "}</Text>
					<Text>{input}</Text>
					<Text inverse> </Text>
				</Box>
				{error && (
					<>
						<Newline />
						<Text color="red">{error}</Text>
					</>
				)}
				<Spacer />
				<Footer
					actions={[
						{ key: "↑↓", label: "Switch Mode" },
						{ key: "Enter", label: "Crawl" },
						{ key: "ESC", label: "Back" },
					]}
				/>
			</Box>
		);
	},
	arePropsEqual,
);

CrawlScreen.displayName = "CrawlScreen";
