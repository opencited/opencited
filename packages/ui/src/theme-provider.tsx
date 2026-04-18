"use client";

import * as React from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "opencited-theme";

function getSystemTheme(): Theme {
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function getStoredTheme(): Theme | null {
	if (typeof window === "undefined") return null;
	return localStorage.getItem(STORAGE_KEY) as Theme | null;
}

function storeTheme(theme: Theme) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = React.useState<Theme>(() => {
		return getStoredTheme() ?? getSystemTheme();
	});

	const setTheme = React.useCallback((newTheme: Theme) => {
		setThemeState(newTheme);
		storeTheme(newTheme);
		document.documentElement.setAttribute("data-theme", newTheme);
	}, []);

	const toggleTheme = React.useCallback(() => {
		setTheme(theme === "light" ? "dark" : "light");
	}, [theme, setTheme]);

	React.useEffect(() => {
		const stored = getStoredTheme();
		const initial = stored ?? getSystemTheme();
		document.documentElement.setAttribute("data-theme", initial);
	}, []);

	const value = React.useMemo(
		() => ({ theme, setTheme, toggleTheme }),
		[theme, setTheme, toggleTheme],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = React.useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
