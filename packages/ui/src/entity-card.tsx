import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/utils";
import { Skeleton } from "./skeleton";

const entityCardCva = cva("rounded-2xl border border-border bg-muted", {
	variants: {
		size: {
			sm: "p-0.5",
			md: "p-1",
			lg: "p-2",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

interface EntityCardProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof entityCardCva> {
	onClick?: () => void;
}

const EntityCard = React.forwardRef<HTMLDivElement, EntityCardProps>(
	({ size, onClick, className, children, ...props }, ref) => {
		const isClickable = Boolean(onClick);

		return (
			<div
				ref={ref}
				className={cn(
					entityCardCva({ size }),
					isClickable && [
						"cursor-pointer",
						"hover:bg-muted/40 hover:border-border/80",
						"transition-colors duration-150",
					],
					className,
				)}
				onClick={onClick}
				onKeyDown={
					isClickable
						? (e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									onClick?.();
								}
							}
						: undefined
				}
				role={isClickable ? "button" : undefined}
				tabIndex={isClickable ? 0 : undefined}
				{...props}
			>
				{children}
			</div>
		);
	},
);
EntityCard.displayName = "EntityCard";

const entityCardContentCva = cva("rounded-xl border border-border bg-card", {
	variants: {
		size: {
			sm: "p-3",
			md: "p-4",
			lg: "p-5",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

interface EntityCardContentProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof entityCardContentCva> {}

const EntityCardContent = React.forwardRef<
	HTMLDivElement,
	EntityCardContentProps
>(({ size, className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(entityCardContentCva({ size }), className)}
		{...props}
	/>
));
EntityCardContent.displayName = "EntityCardContent";

const entityCardHeaderCva = cva("flex items-center justify-between gap-2");

interface EntityCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
	icon?: React.ReactNode;
	iconPosition?: "left" | "right";
}

const EntityCardHeader = React.forwardRef<
	HTMLDivElement,
	EntityCardHeaderProps
>(({ icon, iconPosition = "right", className, children, ...props }, ref) => (
	<div ref={ref} className={cn(entityCardHeaderCva(), className)} {...props}>
		{iconPosition === "left" && icon && (
			<div className="text-muted-foreground shrink-0">{icon}</div>
		)}
		{children}
		{iconPosition === "right" && icon && (
			<div className="text-muted-foreground shrink-0">{icon}</div>
		)}
	</div>
));
EntityCardHeader.displayName = "EntityCardHeader";

const entityCardTitleCva = cva("text-sm font-medium leading-none truncate");

const EntityCardTitle = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn(entityCardTitleCva(), className)} {...props} />
));
EntityCardTitle.displayName = "EntityCardTitle";

const entityCardValueCva = cva("font-semibold text-foreground", {
	variants: {
		size: {
			sm: "text-lg",
			md: "text-2xl",
			lg: "text-3xl",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

interface EntityCardValueProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof entityCardValueCva> {}

const EntityCardValue = React.forwardRef<HTMLDivElement, EntityCardValueProps>(
	({ size, className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(entityCardValueCva({ size }), className)}
			{...props}
		/>
	),
);
EntityCardValue.displayName = "EntityCardValue";

const entityCardFooterCva = cva("text-xs text-muted-foreground", {
	variants: {
		size: {
			sm: "px-2 py-1.5",
			md: "px-3 py-1.5",
			lg: "px-4 py-2",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

interface EntityCardFooterProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof entityCardFooterCva> {}

const EntityCardFooter = React.forwardRef<
	HTMLDivElement,
	EntityCardFooterProps
>(({ size, className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(entityCardFooterCva({ size }), className)}
		{...props}
	/>
));
EntityCardFooter.displayName = "EntityCardFooter";

const entityCardSkeletonCva = cva("rounded-2xl border border-border bg-muted", {
	variants: {
		size: {
			sm: "p-0.5",
			md: "p-1",
			lg: "p-2",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

interface EntityCardSkeletonProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof entityCardSkeletonCva> {
	hasFooter?: boolean;
}

const EntityCardSkeleton = React.forwardRef<
	HTMLDivElement,
	EntityCardSkeletonProps
>(({ size, hasFooter = false, className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(entityCardSkeletonCva({ size }), className)}
		{...props}
	>
		<EntityCardContent size={size}>
			<div className="flex items-center justify-between gap-2">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-4 shrink-0" />
			</div>
			<Skeleton className="h-8 w-20 mt-3" />
		</EntityCardContent>
		{hasFooter && (
			<EntityCardFooter size={size}>
				<Skeleton className="h-3 w-32" />
			</EntityCardFooter>
		)}
	</div>
));
EntityCardSkeleton.displayName = "EntityCardSkeleton";

export {
	EntityCard,
	EntityCardHeader,
	EntityCardTitle,
	EntityCardValue,
	EntityCardContent,
	EntityCardFooter,
	EntityCardSkeleton,
};
