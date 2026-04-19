import type * as React from "react";
import { cn } from "./lib/utils";

interface MetadataItemProps extends React.HTMLAttributes<HTMLSpanElement> {
	icon: React.ReactNode;
	label: string;
}

function MetadataItem({ icon, label, className, ...props }: MetadataItemProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 text-xs text-muted-foreground",
				className,
			)}
			{...props}
		>
			{icon}
			<span>{label}</span>
		</span>
	);
}

interface MetadataGroupProps extends React.HTMLAttributes<HTMLDivElement> {
	items: Array<{ icon: React.ReactNode; label: string }>;
}

function MetadataGroup({ items, className, ...props }: MetadataGroupProps) {
	return (
		<div className={cn("flex flex-wrap gap-2", className)} {...props}>
			{items.map((item, i) => (
				<MetadataItem key={i} icon={item.icon} label={item.label} />
			))}
		</div>
	);
}

export { MetadataItem, MetadataGroup };
