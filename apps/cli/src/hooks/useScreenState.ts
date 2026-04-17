import { useState, useCallback } from "react";
import type { ScreenType } from "../types";

export interface ScreenStateResult {
	currentScreen: ScreenType;
	screenStack: ScreenType[];
	navigateTo: (screen: ScreenType) => void;
	goBack: () => boolean;
	reset: (screen?: ScreenType) => void;
	canGoBack: boolean;
}

export function useScreenState(initialScreen: ScreenType): ScreenStateResult {
	const [screenStack, setScreenStack] = useState<ScreenType[]>([initialScreen]);

	const currentScreen = screenStack[screenStack.length - 1];
	const canGoBack = screenStack.length > 1;

	const navigateTo = useCallback((screen: ScreenType) => {
		setScreenStack((prev) => [...prev, screen]);
	}, []);

	const goBack = useCallback((): boolean => {
		if (screenStack.length <= 1) return false;
		setScreenStack((prev) => prev.slice(0, -1));
		return true;
	}, [screenStack.length]);

	const reset = useCallback(
		(screen?: ScreenType) => {
			setScreenStack([screen ?? initialScreen]);
		},
		[initialScreen],
	);

	return {
		currentScreen,
		screenStack,
		navigateTo,
		goBack,
		reset,
		canGoBack,
	};
}
