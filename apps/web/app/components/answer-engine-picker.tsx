"use client";

import {
	Badge,
	Button,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@opencited/ui";
import { useId, useRef } from "react";
import type { AnswerEngine } from "@/app/hooks/use-answer-engines";

export function AnswerEnginePicker({
	engines,
	value,
	onChange,
}: {
	engines: AnswerEngine[];
	value: string | null;
	onChange: (key: AnswerEngine["key"]) => void;
}) {
	const baseId = useId();
	const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
	const enabledEngines = engines.filter((engine) => engine.enabled);
	const tabStopKey = enabledEngines.some((engine) => engine.key === value)
		? value
		: enabledEngines[0]?.key;

	function focusEngine(key: string) {
		buttonRefs.current.get(key)?.focus();
	}

	function moveEnabled(delta: number) {
		if (enabledEngines.length === 0) return;
		const currentIndex = enabledEngines.findIndex(
			(engine) => engine.key === value,
		);
		const nextIndex =
			currentIndex === -1
				? delta > 0
					? 0
					: enabledEngines.length - 1
				: (currentIndex + delta + enabledEngines.length) %
					enabledEngines.length;
		const next = enabledEngines[nextIndex];
		if (!next) return;
		onChange(next.key);
		focusEngine(next.key);
	}

	function onGroupKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		if (event.key === "ArrowRight" || event.key === "ArrowDown") {
			event.preventDefault();
			moveEnabled(1);
			return;
		}
		if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
			event.preventDefault();
			moveEnabled(-1);
		}
	}

	return (
		<TooltipProvider>
			<div
				role="radiogroup"
				aria-label="Answer engine"
				className="flex flex-wrap items-center gap-2"
				onKeyDown={onGroupKeyDown}
			>
				{engines.map((engine) => {
					const reasonId = `${baseId}-${engine.key}-reason`;
					const selected = value === engine.key;

					if (!engine.enabled) {
						return (
							<Tooltip key={engine.key}>
								<TooltipTrigger asChild>
									<Button
										ref={(node) => {
											if (node) buttonRefs.current.set(engine.key, node);
											else buttonRefs.current.delete(engine.key);
										}}
										type="button"
										role="radio"
										variant="unavailable"
										size="sm"
										tabIndex={0}
										aria-disabled="true"
										aria-checked="false"
										aria-describedby={reasonId}
										onClick={(event) => {
											event.preventDefault();
											event.stopPropagation();
										}}
									>
										{engine.displayName}
										<Badge variant="secondary">Unavailable</Badge>
										<span id={reasonId} className="sr-only">
											{engine.disabledReason}
										</span>
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p className="max-w-xs text-xs">{engine.disabledReason}</p>
								</TooltipContent>
							</Tooltip>
						);
					}

					return (
						<Button
							key={engine.key}
							ref={(node) => {
								if (node) buttonRefs.current.set(engine.key, node);
								else buttonRefs.current.delete(engine.key);
							}}
							type="button"
							role="radio"
							aria-checked={selected}
							tabIndex={engine.key === tabStopKey ? 0 : -1}
							variant={selected ? "default" : "outline"}
							size="sm"
							onClick={(event) => {
								event.stopPropagation();
								onChange(engine.key);
							}}
						>
							{engine.displayName}
						</Button>
					);
				})}
			</div>
		</TooltipProvider>
	);
}
