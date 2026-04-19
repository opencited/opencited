import { useState, useEffect } from "react";

export interface TerminalSize {
	rows: number;
	columns: number;
}

export function useTerminalSize(
	defaults = { rows: 24, columns: 80 },
): TerminalSize {
	const [size, setSize] = useState<TerminalSize>(() => ({
		rows: process.stdout.rows || defaults.rows,
		columns: process.stdout.columns || defaults.columns,
	}));

	useEffect(() => {
		const handleResize = () => {
			setSize({
				rows: process.stdout.rows || defaults.rows,
				columns: process.stdout.columns || defaults.columns,
			});
		};

		process.stdout.on("resize", handleResize);
		return () => {
			process.stdout.removeListener("resize", handleResize);
		};
	}, [defaults.rows, defaults.columns]);

	return size;
}
