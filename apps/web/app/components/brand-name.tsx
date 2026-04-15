import Link from "next/link";

export function BrandNameLink({ className }: { className?: string }) {
	return (
		<Link href="/" className={className}>
			<span>
				<span className="text-muted-foreground">Open</span>
				<span className="text-primary">Cited</span>
			</span>
		</Link>
	);
}
