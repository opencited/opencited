import type React from "react";
import { useState, useEffect } from "react";
import { Text } from "ink";

interface LoadingDotsProps {
	color?: string;
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({
	color = "dimColor",
}) => {
	const [dots, setDots] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			setDots((d) => (d + 1) % 4);
		}, 300);
		return () => clearInterval(interval);
	}, []);

	return <Text color={color}>{".".repeat(dots)}</Text>;
};
