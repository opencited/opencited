"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { Button } from "@opencited/ui";
import { Input } from "@opencited/ui";
import { Label } from "@opencited/ui";
import { Checkbox } from "@opencited/ui";
import {
	CheckCircle2,
	Globe,
	AlertCircle,
	ExternalLink,
	ArrowRight,
	ArrowLeft,
	ChevronLeft,
	Loader2,
	Pencil,
	HelpCircle,
	ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "domain" | "selection" | "preview";

interface DiscoveredSitemap {
	url: string;
	type: "urlset" | "sitemapindex";
	urlCount: number;
	source: "robots.txt" | "standard" | "sitemap-index";
}

interface CrawledUrl {
	url: string;
	lastmod: string | null;
	changefreq: string | null;
	priority: string | null;
}

const STEPS = [
	{ id: "domain", label: "Domain" },
	{ id: "selection", label: "Select Sitemaps" },
	{ id: "preview", label: "Preview" },
];

const SOURCE_LABELS: Record<DiscoveredSitemap["source"], string> = {
	"robots.txt": "robots.txt",
	standard: "standard",
	"sitemap-index": "sitemap index",
};

export function OnboardingWizard() {
	const trpc = useTRPC();
	const router = useRouter();

	const [step, setStep] = useState<Step>("domain");
	const [domain, setDomain] = useState("");
	const [domainError, setDomainError] = useState("");
	const [sitemaps, setSitemaps] = useState<DiscoveredSitemap[]>([]);
	const [selectedSitemapUrls, setSelectedSitemapUrls] = useState<Set<string>>(
		new Set(),
	);
	const [crawledUrls, setCrawledUrls] = useState<CrawledUrl[]>([]);
	const [crawlError, setCrawlError] = useState("");
	const [isDiscovering, setIsDiscovering] = useState(false);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [discoveryStatus, setDiscoveryStatus] = useState("");
	const [showSitemapHelp, setShowSitemapHelp] = useState(false);

	const currentStepIndex = STEPS.findIndex((s) => s.id === step);

	const discoverMutation = useMutation(
		trpc.domainProject.discoverSitemaps.mutationOptions({
			onError: () => {
				setDomainError("Failed to discover sitemaps. Please try again.");
				setIsDiscovering(false);
			},
		}),
	);

	const createMutation = useMutation(
		trpc.domainProject.create.mutationOptions({
			onError: (error) => {
				setCrawlError(
					error.message || "Failed to create project. Please try again.",
				);
			},
		}),
	);

	const sitemapCreateMutation = useMutation(
		trpc.sitemap.create.mutationOptions({
			onError: (error) => {
				setCrawlError(
					error.message || "Failed to save sitemap. Please try again.",
				);
			},
		}),
	);

	const previewMutation = useMutation(
		trpc.sitemap.preview.mutationOptions({
			onError: () => {
				setCrawlError("Failed to fetch sitemap URLs. Please try again.");
				setIsLoadingPreview(false);
			},
		}),
	);

	const crawlMutation = useMutation(
		trpc.sitemap.crawl.mutationOptions({
			onError: (error) => {
				setCrawlError(
					error.message || "Failed to crawl sitemap. Please try again.",
				);
			},
		}),
	);

	const validateDomain = (value: string): boolean => {
		const cleaned = value.replace(/^https?:\/\//, "").replace(/\/$/, "");
		const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}$/;
		if (!cleaned || !domainRegex.test(cleaned)) {
			setDomainError("Please enter a valid domain (e.g., example.com)");
			return false;
		}
		setDomainError("");
		return true;
	};

	const handleDomainSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const cleanedDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

		if (!validateDomain(domain)) return;

		setIsDiscovering(true);
		setDomainError("");
		setDiscoveryStatus("Checking robots.txt and standard locations...");

		try {
			const result = await discoverMutation.mutateAsync({
				domain: cleanedDomain,
			});

			setSitemaps(result.sitemaps);

			if (result.sitemaps.length === 0) {
				setDomainError("No sitemaps found. Please try a different domain.");
				setIsDiscovering(false);
				setDiscoveryStatus("");
			} else {
				setSelectedSitemapUrls(new Set(result.sitemaps.map((s) => s.url)));
				setStep("selection");
				setIsDiscovering(false);
				setDiscoveryStatus("");
			}
		} catch {
			setDomainError("Failed to discover sitemaps. Please try again.");
			setIsDiscovering(false);
		}
	};

	const toggleSitemap = (url: string) => {
		const newSelected = new Set(selectedSitemapUrls);
		if (newSelected.has(url)) {
			newSelected.delete(url);
		} else {
			newSelected.add(url);
		}
		setSelectedSitemapUrls(newSelected);
	};

	const handleContinueToPreview = async () => {
		if (selectedSitemapUrls.size === 0) return;

		setIsLoadingPreview(true);
		setCrawlError("");
		setCrawledUrls([]);
		setDiscoveryStatus(
			`Fetching URLs from ${selectedSitemapUrls.size} sitemap${selectedSitemapUrls.size > 1 ? "s" : ""}...`,
		);

		try {
			const allUrls: CrawledUrl[] = [];
			const errors: string[] = [];

			for (const sitemapUrl of selectedSitemapUrls) {
				try {
					setDiscoveryStatus(`Fetching from ${sitemapUrl}...`);
					const result = await previewMutation.mutateAsync({
						sitemapUrl,
					});
					allUrls.push(...result.urls);
				} catch (err) {
					errors.push(
						`${sitemapUrl}: ${
							err instanceof Error ? err.message : "Failed to fetch"
						}`,
					);
				}
			}

			if (allUrls.length === 0 && errors.length > 0) {
				setCrawlError(`Failed to fetch sitemaps:\n${errors.join("\n")}`);
				setIsLoadingPreview(false);
				return;
			}

			setCrawledUrls(allUrls);
			setStep("preview");
		} catch (err) {
			setCrawlError(
				err instanceof Error
					? err.message
					: "Failed to fetch sitemaps. Please try again.",
			);
		} finally {
			setIsLoadingPreview(false);
		}
	};

	const handleConfirmAndSave = async () => {
		setIsSaving(true);

		try {
			const domainProject = await createMutation.mutateAsync({
				domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
			});

			for (const sitemapUrl of selectedSitemapUrls) {
				const sitemap = await sitemapCreateMutation.mutateAsync({
					domainProjectId: domainProject.id,
					url: sitemapUrl,
				});

				await crawlMutation.mutateAsync({
					sitemapId: sitemap.id,
					sitemapUrl,
				});
			}

			router.push("/app/dashboard");
		} catch (err) {
			setCrawlError(
				err instanceof Error
					? err.message
					: "Failed to save. Please try again.",
			);
			setIsSaving(false);
		}
	};

	const handleBack = () => {
		if (step === "selection") {
			setStep("domain");
		} else if (step === "preview") {
			setStep("selection");
			setCrawledUrls([]);
			setCrawlError("");
		}
	};

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && step !== "domain") {
				handleBack();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [step, handleBack]);

	const cleanedDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
	const faviconUrl = `https://www.google.com/s2/favicons?domain=${cleanedDomain}&sz=32`;

	return (
		<div className="w-full max-w-3xl mx-auto">
			<header className="flex items-center justify-between mb-12">
				<div className="flex items-center gap-4">
					{step !== "domain" && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleBack}
							className="gap-2"
						>
							<ChevronLeft className="h-4 w-4" />
							Back
						</Button>
					)}
				</div>

				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					{STEPS.map((s, i) => (
						<React.Fragment key={s.id}>
							<span
								className={cn(
									i === currentStepIndex && "text-foreground font-medium",
								)}
							>
								{s.label}
							</span>
							{i < STEPS.length - 1 && <span>/</span>}
						</React.Fragment>
					))}
				</div>

				<div className="flex items-center gap-2 min-w-[120px] justify-end">
					{step !== "domain" && cleanedDomain && (
						<div className="flex items-center gap-2">
							<img
								src={faviconUrl}
								alt=""
								className="h-5 w-5 rounded"
								onError={(e) => {
									(e.target as HTMLImageElement).style.display = "none";
								}}
							/>
							<span className="text-sm font-medium truncate max-w-[100px]">
								{cleanedDomain}
							</span>
							<button
								type="button"
								onClick={() => {
									setStep("domain");
									setSitemaps([]);
									setSelectedSitemapUrls(new Set());
									setCrawlError("");
								}}
								className="text-muted-foreground hover:text-foreground transition-colors p-1"
								aria-label="Edit domain"
							>
								<Pencil className="h-3.5 w-3.5" />
							</button>
						</div>
					)}
				</div>
			</header>

			<div
				className="flex gap-1.5 mb-8"
				role="progressbar"
				aria-valuenow={currentStepIndex + 1}
				aria-valuemin={0}
				aria-valuemax={STEPS.length}
			>
				{STEPS.map((s, i) => {
					const isComplete = i < currentStepIndex;
					const isCurrent = i === currentStepIndex;
					return (
						<div
							key={s.id}
							className={cn(
								"h-1.5 flex-1 rounded-full transition-all duration-500",
								isComplete && "bg-primary",
								isCurrent && "bg-primary",
								!isComplete && !isCurrent && "bg-muted",
							)}
							aria-current={isCurrent ? "step" : undefined}
						/>
					);
				})}
			</div>

			<div className="animate-in fade-in slide-in-from-bottom-4 duration-400">
				{step === "domain" && (
					<div className="space-y-8">
						<div className="space-y-4">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
									<Globe className="h-5 w-5 text-primary" />
								</div>
								<div>
									<h1 className="text-3xl font-semibold tracking-tight">
										Set Up Your Project
									</h1>
									<p className="text-sm text-muted-foreground mt-1">
										Enter your website domain to get started with sitemap
										analysis.
									</p>
								</div>
							</div>
						</div>

						<form onSubmit={handleDomainSubmit} className="space-y-6">
							<div className="space-y-2">
								<Label htmlFor="domain" className="text-sm font-medium">
									Website Domain
								</Label>
								<Input
									id="domain"
									type="text"
									placeholder="example.com"
									value={domain}
									onChange={(e) => setDomain(e.target.value)}
									autoFocus
									className="text-base"
								/>
								{domainError && (
									<p className="text-sm text-destructive flex items-center gap-2">
										<AlertCircle className="h-4 w-4" />
										{domainError}
									</p>
								)}
							</div>

							<Button
								type="submit"
								size="lg"
								disabled={isDiscovering || !domain.trim()}
							>
								{isDiscovering ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										{discoveryStatus || "Discovering..."}
									</>
								) : (
									<>Continue</>
								)}
							</Button>
						</form>
					</div>
				)}

				{step === "selection" && (
					<div className="space-y-8">
						<div className="flex items-center gap-3">
							<img
								src={faviconUrl}
								alt=""
								className="h-8 w-8 rounded"
								onError={(e) => {
									(e.target as HTMLImageElement).style.display = "none";
								}}
							/>
							<div>
								<h2 className="text-lg font-medium">{cleanedDomain}</h2>
								<p className="text-sm text-muted-foreground">
									Select sitemaps to crawl for your project
								</p>
							</div>
						</div>

						{crawlError && (
							<div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
								<p className="text-sm text-destructive whitespace-pre-wrap">
									{crawlError}
								</p>
							</div>
						)}

						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<p className="text-sm text-muted-foreground">
									Sitemaps tell AI how your site is structured. We found these
									automatically from your domain.
								</p>
								<div className="flex items-center gap-3">
									{sitemaps.length > 1 && (
										<button
											type="button"
											onClick={() => setSelectedSitemapUrls(new Set())}
											className="text-xs text-muted-foreground hover:text-foreground transition-colors"
										>
											Select none
										</button>
									)}
									<button
										type="button"
										onClick={() => setShowSitemapHelp(!showSitemapHelp)}
										className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
									>
										<HelpCircle className="h-3.5 w-3.5" />
										What are these?
										<ChevronDown
											className={cn(
												"h-3 w-3 transition-transform",
												showSitemapHelp && "rotate-180",
											)}
										/>
									</button>
								</div>
							</div>
							{showSitemapHelp && (
								<div className="p-3 rounded-lg bg-muted/50 border border-border text-sm space-y-2">
									<p>
										<strong>robots.txt</strong> — Sitemaps explicitly declared
										in your site's robots.txt file. Usually the most accurate
										source.
									</p>
									<p>
										<strong>standard</strong> — Common sitemap locations we
										checked directly (e.g., /sitemap.xml). Reliable fallback.
									</p>
									<p>
										<strong>sitemap index</strong> — A file that lists other
										sitemaps. Select it to include all child sitemaps.
									</p>
								</div>
							)}
							{sitemaps.map((sitemap, index) => (
								<div
									key={sitemap.url}
									onClick={() => toggleSitemap(sitemap.url)}
									className={cn(
										"w-full p-4 rounded-lg border text-left transition-all duration-150 cursor-pointer",
										"hover:bg-muted/50",
										selectedSitemapUrls.has(sitemap.url)
											? "border-primary bg-primary/5"
											: "border-border",
									)}
									style={{ animationDelay: `${index * 50}ms` }}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											toggleSitemap(sitemap.url);
										}
									}}
								>
									<div className="flex items-center gap-4">
										<Checkbox
											checked={selectedSitemapUrls.has(sitemap.url)}
											className="shrink-0"
										/>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<span className="text-sm font-mono truncate">
													{sitemap.url}
												</span>
												<span
													className={cn(
														"shrink-0 px-2 py-0.5 rounded text-xs font-medium",
														sitemap.source === "robots.txt"
															? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
															: sitemap.source === "standard"
																? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
																: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
													)}
												>
													{SOURCE_LABELS[sitemap.source]}
												</span>
											</div>
											<p className="text-xs text-muted-foreground">
												{sitemap.type === "sitemapindex"
													? `${sitemap.urlCount} sitemaps`
													: `${sitemap.urlCount} URLs`}
											</p>
										</div>
									</div>
								</div>
							))}
						</div>

						<div className="flex items-center gap-3 pt-2">
							<Button
								onClick={handleContinueToPreview}
								disabled={selectedSitemapUrls.size === 0 || isLoadingPreview}
								size="lg"
							>
								{isLoadingPreview ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										{discoveryStatus || "Loading..."}
									</>
								) : (
									<>
										Continue
										<ArrowRight className="h-4 w-4" />
									</>
								)}
							</Button>
						</div>
					</div>
				)}

				{step === "preview" && (
					<div className="space-y-8">
						<div className="flex items-center gap-3">
							{crawledUrls.length > 0 ? (
								<CheckCircle2 className="h-8 w-8 text-primary" />
							) : (
								<AlertCircle className="h-8 w-8 text-destructive" />
							)}
							<div>
								<h2 className="text-lg font-medium">
									{crawlError ? "Error" : "Preview"}
								</h2>
								<p className="text-sm text-muted-foreground">
									{crawlError
										? crawlError
										: `Found ${crawledUrls.length.toLocaleString()} URLs from ${selectedSitemapUrls.size} sitemap${selectedSitemapUrls.size > 1 ? "s" : ""}`}
								</p>
							</div>
						</div>

						{crawlError ? (
							<div className="flex items-center gap-3 pt-2">
								<Button
									variant="ghost"
									size="lg"
									onClick={() => setStep("selection")}
								>
									<ArrowLeft className="h-4 w-4" />
									Back to Selection
								</Button>
							</div>
						) : (
							<>
								<div className="rounded-lg border border-border overflow-hidden">
									<div className="bg-muted/30 px-4 py-3 border-b border-border">
										<p className="text-sm text-muted-foreground">
											Ready to crawl{" "}
											<span className="font-medium text-foreground">
												{crawledUrls.length.toLocaleString()} URLs
											</span>{" "}
											from{" "}
											<span className="font-medium text-foreground">
												{selectedSitemapUrls.size} sitemap
												{selectedSitemapUrls.size > 1 ? "s" : ""}
											</span>
											. This will create a project and begin tracking these
											URLs.
										</p>
									</div>
									<div className="max-h-64 overflow-y-auto">
										<table className="w-full">
											<thead className="bg-muted/50 sticky top-0">
												<tr>
													<th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">
														URL
													</th>
													<th className="text-right text-xs font-medium text-muted-foreground px-4 py-2 w-10" />
												</tr>
											</thead>
											<tbody className="divide-y divide-border">
												{crawledUrls.slice(0, 50).map((urlItem, index) => (
													<tr
														key={`${urlItem.url}-${index}`}
														className="hover:bg-muted/30 transition-colors"
													>
														<td className="px-4 py-2.5 text-sm font-mono truncate max-w-0">
															{urlItem.url}
														</td>
														<td className="px-4 py-2.5 text-right">
															<a
																href={urlItem.url}
																target="_blank"
																rel="noopener noreferrer"
																className="text-muted-foreground hover:text-primary transition-colors"
															>
																<ExternalLink className="h-4 w-4" />
															</a>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
									{crawledUrls.length > 50 && (
										<div className="px-4 py-3 bg-muted/50 text-center border-t border-border">
											<p className="text-sm text-muted-foreground">
												And {(crawledUrls.length - 50).toLocaleString()} more
												URLs...
											</p>
										</div>
									)}
								</div>

								<div className="flex items-center gap-3 pt-2">
									<Button
										onClick={handleConfirmAndSave}
										size="lg"
										disabled={isSaving}
									>
										{isSaving ? (
											<>
												<Loader2 className="h-4 w-4 animate-spin" />
												Saving...
											</>
										) : (
											<>
												Confirm & Create Project
												<ArrowRight className="h-4 w-4" />
											</>
										)}
									</Button>
								</div>
							</>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
