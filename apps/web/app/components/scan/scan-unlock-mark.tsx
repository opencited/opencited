export function ScanUnlockMark() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			role="img"
			aria-label="Report verified"
			className="shrink-0 animate-scale-in text-emerald-600 dark:text-emerald-400"
		>
			<circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
			<path
				d="M6.5 10.5L9 13L13.5 8"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="animate-check-draw"
				style={{
					strokeDasharray: 24,
					strokeDashoffset: 24,
					animationDelay: "120ms",
				}}
			/>
		</svg>
	);
}
