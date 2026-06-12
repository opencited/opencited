"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
	Button,
	Badge,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@opencited/ui";
import { Plus, Search, Filter } from "lucide-react";
import { Skeleton } from "@opencited/ui";
import { QueryCell } from "@/app/components/query-cell";
import { industries, categories, allTags } from "@opencited/db/client";

interface TemplateData {
	id: string;
	title: string;
	description: string;
	text: string;
	industry: string;
	category: string;
	tags: string[];
	createdAt: string;
	updatedAt: string;
}
import { AddTemplateDialog } from "./add-template-dialog";

interface LibraryTabProps {
	domainProjectId: string;
	domainProjectName: string;
	existingPromptTexts: string[];
}

export function LibraryTab({
	domainProjectId,
	domainProjectName,
	existingPromptTexts,
}: LibraryTabProps) {
	const trpc = useTRPC();

	const [selectedIndustry, setSelectedIndustry] = useState<string>("all");
	const [selectedCategory, setSelectedCategory] = useState<string>("all");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [templateToView, setTemplateToView] = useState<TemplateData | null>(
		null,
	);

	const templatesQuery = useQuery(trpc.promptTemplate.list.queryOptions());

	const filteredTemplates = useMemo(() => {
		const templates = templatesQuery.data ?? [];

		return templates.filter((template) => {
			if (
				selectedIndustry !== "all" &&
				template.industry !== selectedIndustry
			) {
				return false;
			}
			if (
				selectedCategory !== "all" &&
				template.category !== selectedCategory
			) {
				return false;
			}
			if (selectedTags.length > 0) {
				const templateTags = template.tags as string[];
				if (!selectedTags.some((tag) => templateTags.includes(tag))) {
					return false;
				}
			}
			if (searchQuery.trim()) {
				const query = searchQuery.toLowerCase();
				return (
					template.title.toLowerCase().includes(query) ||
					template.description.toLowerCase().includes(query) ||
					(template.tags as string[]).some((tag) =>
						tag.toLowerCase().includes(query),
					)
				);
			}
			return true;
		});
	}, [
		templatesQuery.data,
		selectedIndustry,
		selectedCategory,
		selectedTags,
		searchQuery,
	]);

	const activeFilterCount = [
		selectedIndustry !== "all",
		selectedCategory !== "all",
		selectedTags.length > 0,
	].filter(Boolean).length;

	const clearFilters = () => {
		setSelectedIndustry("all");
		setSelectedCategory("all");
		setSelectedTags([]);
		setSearchQuery("");
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search templates..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>
				<div className="flex items-center gap-2">
					<Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Industry" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Industries</SelectItem>
							{industries.map((industry) => (
								<SelectItem key={industry} value={industry}>
									{industry}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select value={selectedCategory} onValueChange={setSelectedCategory}>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Category" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Categories</SelectItem>
							{categories.map((category) => (
								<SelectItem key={category} value={category}>
									{category
										.replace(/-/g, " ")
										.replace(/\b\w/g, (c) => c.toUpperCase())}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{activeFilterCount > 0 && (
						<Button variant="ghost" size="sm" onClick={clearFilters}>
							Clear
						</Button>
					)}
				</div>
			</div>

			{selectedTags.length > 0 && (
				<div className="flex items-center gap-2 flex-wrap">
					<Filter className="h-4 w-4 text-muted-foreground" />
					{selectedTags.map((tag) => (
						<Badge key={tag} variant="secondary" className="gap-1">
							{tag}
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-4 w-4 ml-1 hover:text-foreground"
								onClick={() =>
									setSelectedTags((prev) => prev.filter((t) => t !== tag))
								}
							>
								<span className="text-xs">×</span>
							</Button>
						</Badge>
					))}
				</div>
			)}

			<div className="flex flex-wrap gap-1.5">
				{allTags.map((tag) => (
					<Badge
						key={tag}
						variant={selectedTags.includes(tag) ? "default" : "outline"}
						className="cursor-pointer text-xs"
						onClick={() => {
							setSelectedTags((prev) =>
								prev.includes(tag)
									? prev.filter((t) => t !== tag)
									: [...prev, tag],
							);
						}}
					>
						{tag}
					</Badge>
				))}
			</div>

			<QueryCell
				query={templatesQuery}
				loading={
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
						{[1, 2, 3].map((i) => (
							<Card key={i}>
								<CardHeader>
									<Skeleton className="h-4 w-3/4 mb-2" />
									<Skeleton className="h-3 w-full" />
								</CardHeader>
								<CardContent>
									<Skeleton className="h-8 w-full" />
								</CardContent>
							</Card>
						))}
					</div>
				}
				error={() => (
					<Card variant="dashed">
						<CardContent className="py-8 text-center">
							<p className="text-destructive">
								Couldn&apos;t load the prompt library. Try again.
							</p>
						</CardContent>
					</Card>
				)}
				success={() => {
					if (filteredTemplates.length === 0) {
						return (
							<Card variant="dashed">
								<CardContent className="py-16 text-center">
									<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
										<Search className="h-6 w-6 text-muted-foreground" />
									</div>
									<h3 className="text-lg font-semibold mb-2">
										No templates found
									</h3>
									<p className="text-muted-foreground max-w-md mx-auto">
										Try adjusting your filters or search terms.
									</p>
								</CardContent>
							</Card>
						);
					}

					return (
						<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
							{filteredTemplates.map((template) => {
								const isDuplicate = existingPromptTexts.includes(template.text);

								return (
									<Card
										key={template.id}
										className="group cursor-pointer transition-shadow hover:shadow-sm flex flex-col"
										onClick={() => !isDuplicate && setTemplateToView(template)}
									>
										<CardHeader className="pb-2">
											<div className="flex items-start justify-between gap-2">
												<CardTitle className="text-sm font-medium leading-tight">
													{template.title}
												</CardTitle>
												{isDuplicate && (
													<Badge
														variant="secondary"
														className="text-xs shrink-0"
													>
														Added
													</Badge>
												)}
											</div>
											<CardDescription className="line-clamp-2 text-xs">
												{template.description}
											</CardDescription>
										</CardHeader>
										<CardContent className="pt-0 mt-auto">
											<div className="flex items-center justify-between gap-2">
												<div className="flex flex-wrap gap-1">
													<Badge variant="outline" className="text-xs">
														{template.industry}
													</Badge>
													<Badge variant="outline" className="text-xs">
														{template.category.replace(/-/g, " ")}
													</Badge>
												</div>
												{!isDuplicate && (
													<Button
														size="sm"
														variant="ghost"
														className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
														onClick={(e) => {
															e.stopPropagation();
															setTemplateToView(template);
														}}
													>
														<Plus className="h-3.5 w-3.5 mr-1" />
														Add
													</Button>
												)}
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					);
				}}
			/>

			<AddTemplateDialog
				open={!!templateToView}
				onOpenChange={(open) => {
					if (!open) setTemplateToView(null);
				}}
				template={templateToView}
				domainProjectName={domainProjectName}
				domainProjectId={domainProjectId}
				existingPromptTexts={existingPromptTexts}
			/>
		</div>
	);
}
