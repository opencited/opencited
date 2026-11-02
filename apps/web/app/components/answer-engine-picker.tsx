"use client";

import {
	Badge,
	Button,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@opencited/ui";
import { useId } from "react";
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

	return (
		<TooltipProvider>
			<div
				role="radiogroup"
				aria-label="Answer engine"
				className="flex flex-wrap items-center gap-2"
			>
				{engines.map((engine) => {
					const reasonId = `${baseId}-${engine.key}-reason`;
					const selected = value === engine.key;

					if (!engine.enabled) {
						return (
							<Tooltip key={engine.key}>
								<TooltipTrigger asChild>
									<Button
										type="button"
										variant="outline"
										size="sm"
										aria-disabled="true"
										aria-describedby={reasonId}
										className="opacity-50"
										onClick={(event) => {
											event.preventDefault();
											event.stopPropagation();
										}}
										onKeyDown={(event) => event.stopPropagation()}
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
							type="button"
							role="radio"
							aria-checked={selected}
							variant={selected ? "default" : "outline"}
							size="sm"
							onClick={(event) => {
								event.stopPropagation();
								onChange(engine.key);
							}}
							onKeyDown={(event) => event.stopPropagation()}
						>
							{engine.displayName}
						</Button>
					);
				})}
			</div>
		</TooltipProvider>
	);
}
