import ReactMarkdownBase, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps {
	children: string;
	className?: string;
}

const components: Components = {
	p: ({ children }) => (
		<p className="text-xs leading-relaxed last:mb-0">{children}</p>
	),
	strong: ({ children }) => (
		<strong className="font-semibold">{children}</strong>
	),
	code: ({ children, className: codeClassName }) => {
		const isBlock = codeClassName?.includes("language-");
		if (isBlock) {
			return (
				<code className="block bg-muted rounded p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">
					{children}
				</code>
			);
		}
		return (
			<code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
				{children}
			</code>
		);
	},
	table: ({ children }) => (
		<div className="overflow-x-auto my-3">
			<table className="w-full text-xs border-collapse">{children}</table>
		</div>
	),
	thead: ({ children }) => (
		<thead className="border-b border-border">{children}</thead>
	),
	tbody: ({ children }) => <tbody>{children}</tbody>,
	tr: ({ children }) => (
		<tr className="border-b border-border/50">{children}</tr>
	),
	th: ({ children }) => (
		<th className="py-1.5 px-2 text-left font-medium text-muted-foreground">
			{children}
		</th>
	),
	td: ({ children }) => (
		<td className="py-1.5 px-2 tabular-nums">{children}</td>
	),
	ul: ({ children }) => (
		<ul className="list-disc pl-4 text-xs space-y-1">{children}</ul>
	),
	ol: ({ children }) => (
		<ol className="list-decimal pl-4 text-xs space-y-1">{children}</ol>
	),
	li: ({ children }) => <li className="leading-relaxed">{children}</li>,
	a: ({ children, href }) => (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="text-xs underline underline-offset-2 hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:rounded-sm"
		>
			{children}
		</a>
	),
};

export function Markdown({ children, className }: MarkdownProps) {
	return (
		<div className={className}>
			<ReactMarkdownBase remarkPlugins={[remarkGfm]} components={components}>
				{children}
			</ReactMarkdownBase>
		</div>
	);
}
