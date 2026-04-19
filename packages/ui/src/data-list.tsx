import * as React from "react";
import { cn } from "./lib/utils";

interface DataListProps<T> extends React.HTMLAttributes<HTMLUListElement> {
	items: T[];
	keyExtractor: (item: T) => string;
	renderItem: (item: T, index: number) => React.ReactNode;
	emptyState?: {
		title: string;
		description?: string;
		action?: React.ReactNode;
	};
	enableKeyboardNav?: boolean;
}

function DataList<T>(
	props: DataListProps<T> & { ref?: React.Ref<HTMLUListElement> },
): React.ReactElement | null {
	const {
		items,
		keyExtractor,
		renderItem,
		emptyState,
		enableKeyboardNav = true,
		className,
		ref,
	} = props;

	const [focusedIndex, setFocusedIndex] = React.useState(-1);

	React.useEffect(() => {
		setFocusedIndex(-1);
	}, [items.length]);

	React.useEffect(() => {
		if (focusedIndex < 0) return;
		const el = document.querySelector(
			`[data-list-index="${focusedIndex}"]`,
		) as HTMLElement | null;
		el?.scrollIntoView({ block: "nearest" });
	}, [focusedIndex]);

	React.useEffect(() => {
		if (!enableKeyboardNav || items.length === 0) return;

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "j" || e.key === "ArrowDown") {
				e.preventDefault();
				setFocusedIndex((prev) => Math.min(prev + 1, items.length - 1));
			} else if (e.key === "k" || e.key === "ArrowUp") {
				e.preventDefault();
				setFocusedIndex((prev) => Math.max(prev - 1, 0));
			}
		}

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [enableKeyboardNav, items.length]);

	if (items.length === 0) {
		if (emptyState) {
			return (
				<div className="border border-border/40 rounded-lg p-8 text-center">
					<p className="text-sm font-medium">{emptyState.title}</p>
					{emptyState.description && (
						<p className="text-sm text-muted-foreground mt-1">
							{emptyState.description}
						</p>
					)}
					{emptyState.action && <div className="mt-4">{emptyState.action}</div>}
				</div>
			);
		}
		return null;
	}

	return (
		<ul
			ref={ref}
			className={cn(
				"border border-border/40 rounded-lg divide-y divide-border/40",
				className,
			)}
		>
			{items.map((item, index) => (
				<li
					key={keyExtractor(item)}
					data-list-index={index}
					onClick={() => setFocusedIndex(index)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							setFocusedIndex(index);
						}
					}}
					className={cn(
						"p-4 flex items-center justify-between gap-4 cursor-default",
						"hover:bg-muted/30 active:bg-muted/50",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						focusedIndex === index && "bg-muted/40",
					)}
				>
					{renderItem(item, index)}
				</li>
			))}
		</ul>
	);
}

interface DataListLinkProps
	extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
	showExternalIcon?: boolean;
}

function DataListLink(
	props: DataListLinkProps & { ref?: React.Ref<HTMLAnchorElement> },
) {
	const { children, showExternalIcon = true, className, ref, ...rest } = props;
	return (
		<a
			ref={ref}
			className={cn("text-sm font-mono truncate hover:text-primary", className)}
			{...rest}
		>
			{children}
		</a>
	);
}

interface DataListActionProps
	extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
	icon: React.ReactNode;
}

function DataListAction({
	icon,
	className,
	children,
	...props
}: DataListActionProps) {
	return (
		<a
			className={cn(
				"shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm text-muted-foreground",
				"hover:bg-muted hover:text-foreground",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				"transition-colors",
				className,
			)}
			{...props}
		>
			{icon}
			{children}
		</a>
	);
}

export { DataList, DataListLink, DataListAction };
