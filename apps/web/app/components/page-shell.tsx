import type { ReactNode } from "react";

interface PageShellProps {
	children: ReactNode;
	title?: string;
}

export function PageShell({ children, title }: PageShellProps) {
	return (
		<div className="flex h-full flex-col">
			{title && (
				<div className="mb-6 border-b border-muted-foreground/30 px-2 py-4">
					<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
				</div>
			)}
			<div className="flex-1 px-2">{children}</div>
		</div>
	);
}
