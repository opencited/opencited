"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard } from "lucide-react";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@opencited/ui";
import { Kbd, KbdGroup } from "@opencited/ui";

interface Shortcut {
	keys: string[];
	description: string;
}

const shortcuts: Shortcut[] = [
	{
		keys: ["?"],
		description: "Show keyboard shortcuts",
	},
	{
		keys: ["B"],
		description: "Toggle sidebar",
	},
	{
		keys: ["G"],
		description: "Go to Dashboard",
	},
	{
		keys: ["S"],
		description: "Go to Sitemaps",
	},
	{
		keys: ["N"],
		description: "Add new sitemap",
	},
];

interface HelpOverlayProps {
	showIndicator?: boolean;
}

function HelpOverlay({ showIndicator = false }: HelpOverlayProps) {
	const [open, setOpen] = useState(false);
	const router = useRouter();

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "?") {
				event.preventDefault();
				setOpen(true);
			}
			if (event.key === "b" && (event.metaKey || event.ctrlKey)) {
				return;
			}
			if (event.key === "b") {
				const target = event.target as HTMLElement;
				if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
					return;
				}
				const customEvent = new KeyboardEvent("keydown", {
					key: "b",
					metaKey: true,
					ctrlKey: true,
					bubbles: true,
				});
				document.dispatchEvent(customEvent);
			}
			if (event.key === "g" && !event.metaKey && !event.ctrlKey) {
				const target = event.target as HTMLElement;
				if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
					return;
				}
				router.push("/app/dashboard");
			}
			if (event.key === "s" && !event.metaKey && !event.ctrlKey) {
				const target = event.target as HTMLElement;
				if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
					return;
				}
				router.push("/app/sitemaps");
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [router]);

	const SheetContentComponent = (
		<SheetContent className="w-full max-w-sm">
			<SheetHeader>
				<SheetTitle className="flex items-center gap-2">
					<Keyboard className="h-4 w-4" />
					Keyboard Shortcuts
				</SheetTitle>
				<SheetDescription>Press keys to navigate quickly</SheetDescription>
			</SheetHeader>
			<div className="mt-6 space-y-4">
				{shortcuts.map((shortcut, index) => (
					<div key={index} className="flex items-center justify-between">
						<span className="text-sm text-muted-foreground">
							{shortcut.description}
						</span>
						<KbdGroup>
							{shortcut.keys.map((key, keyIndex) => (
								<Kbd key={keyIndex}>{key}</Kbd>
							))}
						</KbdGroup>
					</div>
				))}
			</div>
		</SheetContent>
	);

	if (!showIndicator) {
		return (
			<Sheet open={open} onOpenChange={setOpen}>
				{SheetContentComponent}
			</Sheet>
		);
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
			>
				<Keyboard className="h-3 w-3" />
				<span>Shortcuts</span>
				<Kbd>?</Kbd>
			</button>
			<Sheet open={open} onOpenChange={setOpen}>
				{SheetContentComponent}
			</Sheet>
		</>
	);
}

export { HelpOverlay };
