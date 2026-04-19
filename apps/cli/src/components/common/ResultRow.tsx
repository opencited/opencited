import React from "react";
import { Box, Text } from "ink";
import type { CrawledUrl } from "@opencited/crawler";

interface ResultRowProps {
	url: CrawledUrl;
	columns: number;
	isFirst: boolean;
	isLast: boolean;
}

export const ResultRow: React.FC<ResultRowProps> = React.memo(
	({ url, columns, isFirst, isLast }) => {
		const urlColWidth = Math.floor(columns * 0.5);
		const lastmodWidth = 12;
		const freqWidth = 8;
		const _priorityWidth = 8;

		const displayUrl =
			url.url.length > urlColWidth - 2
				? `${url.url.slice(0, urlColWidth - 5)}...`
				: url.url;
		const lastmod = url.lastmod ? url.lastmod.slice(0, 10) : "-";
		const changefreq = url.changefreq ?? "-";
		const priority = url.priority != null ? String(url.priority) : "-";

		const borderChar = isFirst ? "├" : isLast ? "└" : "│";
		const rowColor = isFirst ? "green" : "cyan";

		return (
			<Box>
				<Text dimColor>{borderChar}</Text>
				<Text color={rowColor}>{displayUrl.padEnd(urlColWidth)}</Text>
				<Text dimColor>│</Text>
				<Text color={isFirst ? "green" : "white"}>
					{lastmod.padEnd(lastmodWidth)}
				</Text>
				<Text dimColor>│</Text>
				<Text color={isFirst ? "green" : "white"}>
					{changefreq.padEnd(freqWidth)}
				</Text>
				<Text dimColor>│</Text>
				<Text color={isFirst ? "green" : "white"}>{priority}</Text>
			</Box>
		);
	},
	(prev, next) =>
		prev.url.url === next.url.url &&
		prev.url.lastmod === next.url.lastmod &&
		prev.url.changefreq === next.url.changefreq &&
		prev.url.priority === next.url.priority &&
		prev.columns === next.columns &&
		prev.isFirst === next.isFirst &&
		prev.isLast === next.isLast,
);

ResultRow.displayName = "ResultRow";
