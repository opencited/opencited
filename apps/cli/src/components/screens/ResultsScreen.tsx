import React from "react";
import { Box, Text, Newline, Spacer } from "ink";
import { Header } from "../parts/Header";
import { Footer } from "../parts/Footer";
import { ResultRow } from "../common/ResultRow";
import type { CrawledUrl } from "@opencited/crawler";

interface ResultsScreenProps {
	results: CrawledUrl[];
	discoveredUrl: string | null;
	scrollIndex: number;
	visibleCount: number;
	columns: number;
}

function arePropsEqual(
	prev: ResultsScreenProps,
	next: ResultsScreenProps,
): boolean {
	if (prev.scrollIndex !== next.scrollIndex) return false;
	if (prev.visibleCount !== next.visibleCount) return false;
	if (prev.discoveredUrl !== next.discoveredUrl) return false;
	if (prev.columns !== next.columns) return false;
	if (prev.results.length !== next.results.length) return false;
	for (let i = 0; i < prev.results.length; i++) {
		const p = prev.results[i];
		const n = next.results[i];
		if (
			p.url !== n.url ||
			p.lastmod !== n.lastmod ||
			p.changefreq !== n.changefreq ||
			p.priority !== n.priority
		) {
			return false;
		}
	}
	return true;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = React.memo(
	({ results, discoveredUrl, scrollIndex, visibleCount, columns }) => {
		const visibleResults = results.slice(
			scrollIndex,
			scrollIndex + visibleCount,
		);
		const totalShown = Math.min(scrollIndex + visibleCount, results.length);
		const urlColWidth = Math.floor(columns * 0.5);

		return (
			<Box flexDirection="column">
				<Header title="Crawl Results" columns={columns} />
				{discoveredUrl && <Text dimColor>Found: {discoveredUrl}</Text>}
				<Text dimColor>{results.length} URLs found</Text>
				<Newline />
				<Box flexDirection="column" gap={0}>
					<Box>
						<Text dimColor>│</Text>
						<Text dimColor>{" URL".padEnd(urlColWidth)}</Text>
						<Text dimColor>{" │ Lastmod".padEnd(12)}</Text>
						<Text dimColor>{" │ Freq".padEnd(8)}</Text>
						<Text dimColor>{" │ Priority"}</Text>
					</Box>
					<Box>
						<Text dimColor>├</Text>
						<Text dimColor>{"─".repeat(urlColWidth)}</Text>
						<Text dimColor>{"─┼".padEnd(14)}</Text>
						<Text dimColor>{"─".repeat(8)}</Text>
						<Text dimColor>{"─┼".padEnd(1)}</Text>
						<Text dimColor>{"─".repeat(8)}</Text>
					</Box>
					{visibleResults.map((u, idx) => {
						const isFirst = idx === 0;
						const isLast = idx === visibleResults.length - 1;
						return (
							<ResultRow
								key={`${scrollIndex}-${u.url}`}
								url={u}
								columns={columns}
								isFirst={isFirst}
								isLast={isLast}
							/>
						);
					})}
				</Box>
				<Newline />
				<Text dimColor>
					Showing {scrollIndex + 1}-{totalShown} of {results.length}
				</Text>
				<Spacer />
				<Footer
					actions={[
						{ key: "↑↓", label: "Scroll" },
						{ key: "ESC", label: "Back" },
					]}
				/>
			</Box>
		);
	},
	arePropsEqual,
);

ResultsScreen.displayName = "ResultsScreen";
