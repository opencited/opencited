import type React from "react";
import { Text } from "ink";

export interface FooterAction {
	key: string;
	label: string;
}

interface FooterProps {
	actions: FooterAction[];
}

export const Footer: React.FC<FooterProps> = ({ actions }) => {
	return (
		<Text dimColor>
			{actions.map((action, i) => (
				<Text key={action.key}>
					{action.key} {action.label}
					{i < actions.length - 1 ? "  |  " : ""}
				</Text>
			))}
		</Text>
	);
};
