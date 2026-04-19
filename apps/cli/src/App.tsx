import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { Box, useInput, useApp } from "ink";
import { MainMenuScreen } from "./components/screens/MainMenuScreen";
import { CrawlScreen } from "./components/screens/CrawlScreen";
import { ResultsScreen } from "./components/screens/ResultsScreen";
import { useScreenState } from "./hooks/useScreenState";
import { useCrawl } from "./hooks/useCrawl";
import { useTerminalSize } from "./hooks/useTerminalSize";
import type { MenuItem, InputModeOption } from "./types";

const MENU_ITEMS: MenuItem[] = [
	{ id: "crawl", label: "Crawl Sitemap" },
	{ id: "quit", label: "Quit" },
];

const INPUT_MODES: InputModeOption[] = [
	{ label: "Domain", description: "Auto-discover sitemap" },
	{ label: "URL", description: "Direct sitemap URL" },
];

const VISIBLE_RESULT_COUNT = 12;

export const App: React.FC = () => {
	const { rows, columns } = useTerminalSize();
	const { currentScreen, navigateTo, goBack } = useScreenState("main");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [ready, setReady] = useState(false);
	const crawlState = useCrawl();
	const { exit } = useApp();

	useEffect(() => {
		const timer = setTimeout(() => setReady(true), 50);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		const handler = () => {
			exit();
		};
		process.on("SIGINT", handler);
		return () => {
			process.off("SIGINT", handler);
		};
	}, [exit]);

	const navigateToCrawl = useCallback(() => {
		crawlState.reset();
		setSelectedIndex(0);
		navigateTo("crawl");
	}, [crawlState, navigateTo]);

	const handleQuit = useCallback(() => {
		exit();
	}, [exit]);

	useInput(
		(input, key) => {
			if (!ready) return;

			if (currentScreen === "main") {
				if (key.upArrow) {
					setSelectedIndex(
						(i) => (i - 1 + MENU_ITEMS.length) % MENU_ITEMS.length,
					);
					return;
				}
				if (key.downArrow) {
					setSelectedIndex((i) => (i + 1) % MENU_ITEMS.length);
					return;
				}
				if (key.return) {
					const item = MENU_ITEMS[selectedIndex];
					if (item.id === "crawl") {
						navigateToCrawl();
					} else if (item.id === "quit") {
						handleQuit();
					}
					return;
				}
				return;
			}

			if (currentScreen === "crawl") {
				if (key.escape) {
					goBack();
					setSelectedIndex(0);
					crawlState.reset();
					return;
				}
				if (key.upArrow) {
					crawlState.setInputModeIndex(
						(i) => (i - 1 + INPUT_MODES.length) % INPUT_MODES.length,
					);
					crawlState.setInput("");
					return;
				}
				if (key.downArrow) {
					crawlState.setInputModeIndex((i) => (i + 1) % INPUT_MODES.length);
					crawlState.setInput("");
					return;
				}
				if (key.return) {
					if (!crawlState.loading && crawlState.input.trim()) {
						crawlState.crawl(crawlState.inputModeIndex).then((success) => {
							if (success) {
								navigateTo("results");
							}
						});
					}
					return;
				}
				if (key.backspace) {
					crawlState.setInput((prev) => prev.slice(0, -1));
					return;
				}
				if (
					input.length > 0 &&
					!key.tab &&
					!key.return &&
					!key.escape &&
					!key.backspace &&
					!key.upArrow &&
					!key.downArrow
				) {
					crawlState.setInput((prev) => prev + input);
					return;
				}
				return;
			}

			if (currentScreen === "results") {
				if (key.escape) {
					goBack();
					return;
				}
				if (key.upArrow) {
					crawlState.setScrollIndex((i: number) => Math.max(0, i - 1));
					return;
				}
				if (key.downArrow) {
					crawlState.setScrollIndex((i: number) =>
						Math.min((crawlState.results?.length ?? 1) - 1, i + 1),
					);
					return;
				}
				return;
			}
		},
		{ isActive: ready },
	);

	return (
		<Box flexDirection="column" height={rows} padding={1}>
			{currentScreen === "main" && (
				<MainMenuScreen
					items={MENU_ITEMS}
					selectedIndex={selectedIndex}
					columns={columns}
				/>
			)}

			{currentScreen === "crawl" && (
				<CrawlScreen
					input={crawlState.input}
					inputModes={INPUT_MODES}
					inputModeIndex={crawlState.inputModeIndex}
					loading={crawlState.loading}
					loadingText={crawlState.loadingText}
					error={crawlState.error}
					columns={columns}
				/>
			)}

			{currentScreen === "results" && crawlState.results && (
				<ResultsScreen
					results={crawlState.results}
					discoveredUrl={crawlState.discoveredUrl}
					scrollIndex={crawlState.scrollIndex}
					visibleCount={VISIBLE_RESULT_COUNT}
					columns={columns}
				/>
			)}
		</Box>
	);
};
