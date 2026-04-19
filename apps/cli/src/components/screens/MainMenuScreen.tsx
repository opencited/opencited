import React from "react";
import { Box, Text, Newline } from "ink";
import { Header } from "../parts/Header";
import { Footer } from "../parts/Footer";
import type { MenuItem } from "../../types";

interface MainMenuScreenProps {
	items: MenuItem[];
	selectedIndex: number;
	columns: number;
}

function arePropsEqual(
	prev: MainMenuScreenProps,
	next: MainMenuScreenProps,
): boolean {
	if (prev.selectedIndex !== next.selectedIndex) return false;
	if (prev.columns !== next.columns) return false;
	if (prev.items.length !== next.items.length) return false;
	for (let i = 0; i < prev.items.length; i++) {
		if (prev.items[i].id !== next.items[i].id) return false;
		if (prev.items[i].label !== next.items[i].label) return false;
	}
	return true;
}

export const MainMenuScreen: React.FC<MainMenuScreenProps> = React.memo(
	({ items, selectedIndex, columns }) => {
		return (
			<Box flexDirection="column">
				<Header title="OpenCited CLI" columns={columns} />
				<Newline />
				{items.map((item, i) => (
					<Text key={item.id} color={i === selectedIndex ? "green" : "white"}>
						{i === selectedIndex ? "● " : "  "}
						{item.label}
					</Text>
				))}
				<Newline />
				<Footer
					actions={[
						{ key: "↑↓", label: "Navigate" },
						{ key: "Enter", label: "Select" },
						{ key: "ESC", label: "Quit" },
					]}
				/>
			</Box>
		);
	},
	arePropsEqual,
);

MainMenuScreen.displayName = "MainMenuScreen";
