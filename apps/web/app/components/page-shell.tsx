import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageShellProps {
	children: ReactNode;
	title?: string;
	backHref?: string;
	backLabel?: string;
}

export function PageShell({
	children,
	title,
	backHref,
	backLabel,
}: PageShellProps) {
	return (
		<div className="flex h-full flex-col">
			{title && (
				<div className="mb-6 border-b border-muted-foreground/30 px-2 py-4">
					{backHref && (
						<div className="mb-2">
							<Link
								href={backHref}
								className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
							>
								<ArrowLeft className="h-4 w-4" />
								{backLabel || "Back"}
							</Link>
						</div>
					)}
					<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
				</div>
			)}
			<div className="flex-1 px-2">{children}</div>
		</div>
	);
}
