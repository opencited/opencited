"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";
import { cn } from "./lib/utils";
import { Button } from "./button";

interface ThemeToggleProps {
	className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
	const { theme, toggleTheme } = useTheme();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={toggleTheme}
			aria-label={
				theme === "light" ? "Switch to dark mode" : "Switch to light mode"
			}
			className={cn("h-8 w-8", className)}
		>
			<span
				className={cn(
					"absolute transition-all duration-200 ease-out",
					theme === "light"
						? "rotate-0 scale-100 opacity-100"
						: "rotate-90 scale-0 opacity-0",
				)}
			>
				<Sun className="h-4 w-4" />
			</span>
			<span
				className={cn(
					"absolute transition-all duration-200 ease-out",
					theme === "dark"
						? "rotate-0 scale-100 opacity-100"
						: "-rotate-90 scale-0 opacity-0",
				)}
			>
				<Moon className="h-4 w-4" />
			</span>
		</Button>
	);
}
