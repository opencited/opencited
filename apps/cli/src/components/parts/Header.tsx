import type React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
	title: string;
	columns?: number;
}

export const Header: React.FC<HeaderProps> = ({ title, columns = 50 }) => {
	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text bold>{title}</Text>
			<Text dimColor>{"─".repeat(columns)}</Text>
		</Box>
	);
};
