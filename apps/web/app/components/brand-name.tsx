import Link from "next/link";

export function BrandNameLink({ className }: { className?: string }) {
	return (
		<Link href="/dashboard" className={className}>
			<span>Open</span>
			<span className="text-primary">cited</span>
		</Link>
	);
}
