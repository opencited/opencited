"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
	Button,
	Input,
	Label,
	Checkbox,
	ScrollArea,
	PriorityBadge,
	Table,
	TableHeader,
	TableBody,
	TableHead,
	TableRow,
	TableCell,
	Badge,
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@opencited/ui";
import { TimeAgo } from "@/app/components/time-ago";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
	AlertCircle,
	Loader2,
	Search,
	Plus,
	Link2,
	ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DiscoveredSitemap = {
	url: string;
	type: "urlset" | "sitemapindex";
	urlCount: number;
	source: "robots.txt" | "standard" | "sitemap-index";
};

type SitemapSource = "robots.txt" | "standard" | "manual" | "sitemap-index";

type SitemapIndexItem = {
	url: string;
	childSitemaps: string[];
};

type CrawledUrl = {
	url: string;
	lastmod: string | null;
	changefreq: string | null;
	priority: string | null;
};

type DialogMode = "discover" | "manual";
type DialogStep =
	| "idle"
	| "discovering"
	| "discovered"
	| "previewing"
	| "previewed"
	| "saving";

interface AddSitemapDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	domainProjectId: string;
	domain: string;
	existingSitemapUrls: Set<string>;
	onSuccess: () => void;
}

const SOURCE_LABELS: Record<DiscoveredSitemap["source"], string> = {
	"robots.txt": "robots.txt",
	standard: "standard",
	"sitemap-index": "sitemap index",
};

export function AddSitemapDialog({
	open,
	onOpenChange,
	domainProjectId,
	domain,
	existingSitemapUrls,
	onSuccess,
}: AddSitemapDialogProps) {
	const trpc = useTRPC();
	const shouldReduceMotion = useReducedMotion();

	const [mode, setMode] = useState<DialogMode>("discover");
	const [step, setStep] = useState<DialogStep>("idle");

	const [discoverDomain, setDiscoverDomain] = useState(domain);
	const [discoverError, setDiscoverError] = useState("");
	const [discoveryStatus, setDiscoveryStatus] = useState("");

	const [manualUrl, setManualUrl] = useState("");
	const [manualError, setManualError] = useState("");

	const [sitemaps, setSitemaps] = useState<DiscoveredSitemap[]>([]);
	const [sitemapIndexes, setSitemapIndexes] = useState<SitemapIndexItem[]>([]);
	const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
	const [crawledUrls, setCrawledUrls] = useState<CrawledUrl[]>([]);
	const [previewError, setPreviewError] = useState("");

	const [isDiscovering, setIsDiscovering] = useState(false);
	const [isPreviewing, setIsPreviewing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const discoverMutation = useMutation(
		trpc.domainProject.discoverSitemaps.mutationOptions({
			onError: () => {
				setDiscoverError("Couldn't find sitemaps. Try again.");
				setIsDiscovering(false);
			},
		}),
	);

	const previewMutation = useMutation(
		trpc.sitemap.preview.mutationOptions({
			onError: () => {
				setPreviewError("Couldn't fetch URLs. Try again.");
				setIsPreviewing(false);
			},
		}),
	);

	const sitemapCreateMutation = useMutation(
		trpc.sitemap.create.mutationOptions({
			onError: (error) => {
				setPreviewError(error.message || "Couldn't save sitemap. Try again.");
				setIsSaving(false);
			},
		}),
	);

	const crawlMutation = useMutation(
		trpc.sitemap.crawl.mutationOptions({
			onError: (error) => {
				setPreviewError(error.message || "Couldn't crawl sitemap. Try again.");
				setIsSaving(false);
			},
		}),
	);

	const resetState = () => {
		setStep("idle");
		setSitemaps([]);
		setSitemapIndexes([]);
		setSelectedUrls(new Set());
		setCrawledUrls([]);
		setDiscoverError("");
		setManualError("");
		setPreviewError("");
		setDiscoverDomain(domain);
		setManualUrl("");
	};

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			resetState();
		}
		onOpenChange(newOpen);
	};

	const handleDiscover = async () => {
		const cleanedDomain = discoverDomain
			.replace(/^https?:\/\//, "")
			.replace(/\/$/, "");

		if (!cleanedDomain) {
			setDiscoverError("Enter a domain");
			return;
		}

		setIsDiscovering(true);
		setDiscoverError("");
		setDiscoveryStatus("Searching...");
		setSitemaps([]);
		setSitemapIndexes([]);
		setSelectedUrls(new Set());

		try {
			const result = await discoverMutation.mutateAsync({
				domain: cleanedDomain,
			});

			const newSitemaps = result.sitemaps.filter(
				(s) => !existingSitemapUrls.has(s.url),
			);

			const filteredIndexes = result.sitemapIndexes
				?.map((index) => ({
					url: index.url,
					childSitemaps: index.childSitemaps.filter(
						(childUrl) => !existingSitemapUrls.has(childUrl),
					),
				}))
				.filter((index) => index.childSitemaps.length > 0);

			if (
				newSitemaps.length === 0 &&
				(!filteredIndexes || filteredIndexes.length === 0)
			) {
				setDiscoverError("No new sitemaps found. Try entering a URL manually.");
				setIsDiscovering(false);
				return;
			}

			setSitemaps(newSitemaps);
			setSitemapIndexes(filteredIndexes ?? []);
			setSelectedUrls(new Set(newSitemaps.map((s) => s.url)));
			setStep("discovered");
		} catch {
			setDiscoverError("Couldn't find sitemaps. Try again.");
		} finally {
			setIsDiscovering(false);
		}
	};

	const handleManualUrl = async () => {
		const cleanedUrl = manualUrl.trim();

		if (!cleanedUrl) {
			setManualError("Enter a sitemap URL");
			return;
		}

		try {
			new URL(cleanedUrl);
		} catch {
			setManualError("Enter a valid URL");
			return;
		}

		if (existingSitemapUrls.has(cleanedUrl)) {
			setManualError("This sitemap URL already exists in your project.");
			return;
		}

		setManualError("");
		setIsPreviewing(true);
		setDiscoveryStatus("Checking sitemap...");

		try {
			const result = await previewMutation.mutateAsync({
				sitemapUrl: cleanedUrl,
			});

			if (result.type === "sitemapindex") {
				setManualError(
					"This is a sitemap index. Please add individual sitemaps instead.",
				);
				setIsPreviewing(false);
				return;
			}

			setSelectedUrls(new Set([cleanedUrl]));
			setStep("previewing");
			loadPreview([cleanedUrl]);
		} catch (err) {
			setManualError(
				err instanceof Error
					? err.message
					: "Couldn't verify sitemap. Try again.",
			);
			setIsPreviewing(false);
		}
	};

	const toggleSitemap = (url: string) => {
		const newSelected = new Set(selectedUrls);
		if (newSelected.has(url)) {
			newSelected.delete(url);
		} else {
			newSelected.add(url);
		}
		setSelectedUrls(newSelected);
	};

	const toggleSelectAll = () => {
		const allChildUrls = sitemapIndexes.flatMap((index) => index.childSitemaps);
		const allUrls = [...sitemaps.map((s) => s.url), ...allChildUrls];

		if (selectedUrls.size === allUrls.length) {
			setSelectedUrls(new Set());
		} else {
			setSelectedUrls(new Set(allUrls));
		}
	};

	const loadPreview = async (urls: string[]) => {
		setIsPreviewing(true);
		setPreviewError("");
		setCrawledUrls([]);
		setDiscoveryStatus("Fetching URLs...");

		try {
			const allUrls: CrawledUrl[] = [];

			for (const sitemapUrl of urls) {
				try {
					setDiscoveryStatus(`Fetching from ${sitemapUrl}...`);
					const result = await previewMutation.mutateAsync({
						sitemapUrl,
					});

					if (result.type === "sitemapindex") {
						continue;
					}

					allUrls.push(...result.urls);
				} catch {
					// Skip failed sitemaps
				}
			}

			if (allUrls.length === 0) {
				setPreviewError("No URLs found in selected sitemaps.");
				setIsPreviewing(false);
				return;
			}

			setCrawledUrls(allUrls);
			setStep("previewed");
		} catch {
			setPreviewError("Couldn't fetch URLs. Try again.");
		} finally {
			setIsPreviewing(false);
		}
	};

	const handlePreview = () => {
		if (selectedUrls.size === 0) return;
		setStep("previewing");
		loadPreview(Array.from(selectedUrls));
	};

	const getSourceForUrl = (url: string): SitemapSource => {
		const sitemap = sitemaps.find((s) => s.url === url);
		return sitemap?.source ?? "manual";
	};

	const handleConfirmAndSave = async () => {
		setIsSaving(true);
		setPreviewError("");

		try {
			for (const sitemapUrl of selectedUrls) {
				const source = getSourceForUrl(sitemapUrl);

				const sitemap = await sitemapCreateMutation.mutateAsync({
					domainProjectId,
					url: sitemapUrl,
					source,
				});

				const crawlResult = await crawlMutation.mutateAsync({
					sitemapId: sitemap.id,
					sitemapUrl,
				});

				if (crawlResult.skipped) {
				}
			}

			onSuccess();
			handleOpenChange(false);
		} catch (err) {
			setPreviewError(
				err instanceof Error ? err.message : "Couldn't save. Try again.",
			);
			setIsSaving(false);
		}
	};

	const handleBack = () => {
		if (step === "discovered") {
			setStep("idle");
			setSitemaps([]);
			setSitemapIndexes([]);
			setSelectedUrls(new Set());
		} else if (step === "previewing" || step === "previewed") {
			setStep("discovered");
			setCrawledUrls([]);
			setPreviewError("");
		}
	};

	useEffect(() => {
		if (open) {
			setDiscoverDomain(domain);
		}
	}, [open, domain]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && step !== "idle") {
				e.preventDefault();
				handleBack();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [step]);

	const selectedCount = selectedUrls.size;
	const uniqueDomains = new Set(
		Array.from(selectedUrls)
			.map((u) => {
				try {
					return new URL(u).hostname;
				} catch {
					return u;
				}
			})
			.filter(Boolean),
	);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Plus className="h-5 w-5" />
						Add Sitemap
					</DialogTitle>
					<DialogDescription>
						Discover sitemaps for your domain or add a sitemap URL manually.
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
					<button
						type="button"
						onClick={() => {
							setMode("discover");
							resetState();
						}}
						className={cn(
							"flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
							mode === "discover"
								? "bg-background shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<Search className="h-3.5 w-3.5" />
						Discover
					</button>
					<button
						type="button"
						onClick={() => {
							setMode("manual");
							resetState();
						}}
						className={cn(
							"flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
							mode === "manual"
								? "bg-background shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<Link2 className="h-3.5 w-3.5" />
						Manual
					</button>
				</div>

				<div className="flex-1 overflow-y-auto">
					<AnimatePresence mode="wait">
						{mode === "discover" && step === "idle" && (
							<motion.div
								key="discover-idle"
								className="space-y-4"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
							>
								<div className="flex items-center gap-2">
									<span className="text-sm text-muted-foreground">
										Discovering sitemaps for
									</span>
									<span className="text-sm font-medium font-mono">
										{discoverDomain}
									</span>
								</div>

								{discoverError && (
									<p className="text-sm text-destructive flex items-center gap-2">
										<AlertCircle className="h-4 w-4" />
										{discoverError}
									</p>
								)}

								<Accordion type="single" collapsible className="w-full">
									<AccordionItem
										value="what-are-sitemaps"
										className="border-none"
									>
										<AccordionTrigger className="py-2 px-3 hover:no-underline hover:bg-muted/50 rounded-lg text-xs text-muted-foreground">
											What are sitemaps?
										</AccordionTrigger>
										<AccordionContent className="px-3">
											<div className="p-3 rounded-lg bg-muted/50 border border-border text-sm space-y-2">
												<p>
													<strong>robots.txt</strong> — Sitemaps explicitly
													declared in your site&apos;s robots.txt file. Usually
													the most accurate source.
												</p>
												<p>
													<strong>standard</strong> — Common sitemap locations
													we checked directly (e.g., /sitemap.xml). Reliable
													fallback.
												</p>
												<p>
													<strong>sitemap index</strong> — A file that lists
													other sitemaps. Expand to select individual child
													sitemaps.
												</p>
											</div>
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							</motion.div>
						)}

						{mode === "discover" && step === "discovered" && (
							<motion.div
								key="discover-discovered"
								className="space-y-4"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
							>
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<p className="text-sm text-muted-foreground">
											Found{" "}
											{sitemaps.length +
												sitemapIndexes.reduce(
													(acc, idx) => acc + idx.childSitemaps.length,
													0,
												)}{" "}
											sitemap
											{sitemaps.length +
												sitemapIndexes.reduce(
													(acc, idx) => acc + idx.childSitemaps.length,
													0,
												) !==
											1
												? "s"
												: ""}
											{sitemapIndexes.length > 0 &&
												` and ${sitemapIndexes.length} sitemap index${
													sitemapIndexes.length !== 1 ? "es" : ""
												}`}
											{" for "}
											<span className="font-medium text-foreground">
												{discoverDomain.replace(/^https?:\/\//, "")}
											</span>
										</p>
										{(() => {
											const allChildUrls = sitemapIndexes.flatMap(
												(index) => index.childSitemaps,
											);
											const allUrls = [
												...sitemaps.map((s) => s.url),
												...allChildUrls,
											];
											return (
												<button
													type="button"
													onClick={toggleSelectAll}
													className="text-xs text-muted-foreground hover:text-foreground transition-colors"
												>
													{selectedUrls.size === allUrls.length &&
													allUrls.length > 0
														? "Select none"
														: "Select all"}
												</button>
											);
										})()}
									</div>

									<div className="space-y-1.5">
										{sitemaps.map((sitemap) => (
											<motion.button
												key={sitemap.url}
												type="button"
												onClick={() => toggleSitemap(sitemap.url)}
												className={cn(
													"w-full p-3 rounded-lg border text-left cursor-pointer transition-colors",
													selectedUrls.has(sitemap.url)
														? "border-primary bg-primary/5"
														: "border-border hover:bg-muted/50",
												)}
											>
												<div className="flex items-center gap-3">
													<Checkbox
														checked={selectedUrls.has(sitemap.url)}
														className="shrink-0"
													/>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2 mb-0.5">
															<span className="text-sm font-mono truncate">
																{sitemap.url}
															</span>
															<Badge
																variant={
																	sitemap.source === "robots.txt"
																		? "default"
																		: sitemap.source === "standard"
																			? "secondary"
																			: "outline"
																}
																className="shrink-0"
															>
																{SOURCE_LABELS[sitemap.source]}
															</Badge>
														</div>
														<p className="text-xs text-muted-foreground">
															{sitemap.urlCount} URLs
														</p>
													</div>
												</div>
											</motion.button>
										))}
									</div>

									{sitemapIndexes.length > 0 && (
										<Accordion type="multiple" className="w-full">
											{sitemapIndexes.map((index) => (
												<AccordionItem
													key={index.url}
													value={index.url}
													className="border border-border rounded-lg px-3 py-2"
												>
													<AccordionTrigger className="hover:no-underline">
														<div className="flex items-center gap-2">
															<ChevronRight className="h-4 w-4 text-muted-foreground" />
															<span className="text-sm font-mono text-muted-foreground truncate max-w-[300px]">
																{(() => {
																	try {
																		return new URL(index.url).pathname;
																	} catch {
																		return index.url;
																	}
																})()}
															</span>
															<Badge
																variant="outline"
																className="shrink-0 text-xs"
															>
																{index.childSitemaps.length} sitemaps
															</Badge>
														</div>
													</AccordionTrigger>
													<AccordionContent>
														<div className="space-y-1.5 pt-2 pl-6">
															{index.childSitemaps.map((childUrl) => (
																<motion.button
																	key={childUrl}
																	type="button"
																	onClick={() => toggleSitemap(childUrl)}
																	className={cn(
																		"w-full p-3 rounded-lg border text-left cursor-pointer transition-colors",
																		selectedUrls.has(childUrl)
																			? "border-primary bg-primary/5"
																			: "border-border hover:bg-muted/50",
																	)}
																>
																	<div className="flex items-center gap-3">
																		<Checkbox
																			checked={selectedUrls.has(childUrl)}
																			className="shrink-0"
																		/>
																		<div className="flex-1 min-w-0">
																			<span className="text-sm font-mono truncate block">
																				{childUrl}
																			</span>
																		</div>
																	</div>
																</motion.button>
															))}
														</div>
													</AccordionContent>
												</AccordionItem>
											))}
										</Accordion>
									)}
								</div>

								{previewError && (
									<p className="text-sm text-destructive flex items-center gap-2">
										<AlertCircle className="h-4 w-4" />
										{previewError}
									</p>
								)}
							</motion.div>
						)}

						{mode === "manual" && step === "idle" && (
							<motion.div
								key="manual-idle"
								className="space-y-4"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
							>
								<div className="space-y-2">
									<Label htmlFor="manual-url" className="text-sm font-medium">
										Sitemap URL
									</Label>
									<div className="flex gap-2">
										<Input
											id="manual-url"
											type="text"
											placeholder="https://yoursite.com/sitemap.xml"
											value={manualUrl}
											onChange={(e) => setManualUrl(e.target.value)}
											className="flex-1 font-mono text-sm"
										/>
										<Button
											onClick={handleManualUrl}
											disabled={isPreviewing || !manualUrl.trim()}
											className="shrink-0"
										>
											{isPreviewing ? (
												<>
													<Loader2 className="h-4 w-4 animate-spin" />
													Checking...
												</>
											) : (
												<>
													<Search className="h-4 w-4" />
													Fetch
												</>
											)}
										</Button>
									</div>
									{manualError && (
										<p className="text-sm text-destructive flex items-center gap-2">
											<AlertCircle className="h-4 w-4" />
											{manualError}
										</p>
									)}
									<p className="text-xs text-muted-foreground">
										Enter the full URL of your sitemap file
									</p>
								</div>
							</motion.div>
						)}

						{(step === "previewing" || step === "previewed") && (
							<motion.div
								key="preview"
								className="space-y-4"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
							>
								{isPreviewing ? (
									<div className="flex items-center justify-center py-12">
										<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
										<span className="ml-3 text-muted-foreground">
											{discoveryStatus || "Loading..."}
										</span>
									</div>
								) : (
									<>
										<div className="rounded-lg border border-border overflow-hidden">
											<div className="bg-muted/30 px-4 py-3 border-b border-border">
												<p className="text-sm text-muted-foreground">
													Ready to import{" "}
													<span className="font-medium text-foreground">
														{crawledUrls.length.toLocaleString()} URLs
													</span>{" "}
													from{" "}
													<span className="font-medium text-foreground">
														{selectedCount} sitemap
														{selectedCount !== 1 ? "s" : ""}
													</span>
													{uniqueDomains.size > 1 && (
														<>
															{" "}
															across{" "}
															<span className="font-medium text-foreground">
																{uniqueDomains.size} domain
																{uniqueDomains.size !== 1 ? "s" : ""}
															</span>
														</>
													)}
												</p>
											</div>
											<ScrollArea className="h-64">
												<Table className="table-fixed">
													<TableHeader>
														<TableRow>
															<TableHead className="w-[350px] max-w-[350px]">
																URL
															</TableHead>
															<TableHead className="w-[100px]">
																Last Mod
															</TableHead>
															<TableHead className="w-[100px]">
																Frequency
															</TableHead>
															<TableHead className="w-[100px]">
																Priority
															</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{crawledUrls.slice(0, 50).map((urlItem, index) => (
															<motion.tr
																key={`${urlItem.url}-${index}`}
																initial={{
																	opacity: 0,
																}}
																animate={{
																	opacity: 1,
																}}
																transition={{
																	delay: shouldReduceMotion ? 0 : index * 0.02,
																	duration: 0.2,
																}}
															>
																<TableCell className="font-mono text-sm whitespace-nowrap overflow-x-auto">
																	{urlItem.url}
																</TableCell>
																<TableCell className="text-muted-foreground">
																	<TimeAgo date={urlItem.lastmod} />
																</TableCell>
																<TableCell className="text-muted-foreground">
																	{urlItem.changefreq ?? "Unknown"}
																</TableCell>
																<TableCell>
																	<PriorityBadge priority={urlItem.priority} />
																</TableCell>
															</motion.tr>
														))}
													</TableBody>
												</Table>
											</ScrollArea>
											{crawledUrls.length > 50 && (
												<div className="px-4 py-3 bg-muted/50 text-center border-t border-border">
													<p className="text-sm text-muted-foreground">
														And {(crawledUrls.length - 50).toLocaleString()}{" "}
														more URLs...
													</p>
												</div>
											)}
										</div>

										{previewError && (
											<p className="text-sm text-destructive flex items-center gap-2">
												<AlertCircle className="h-4 w-4" />
												{previewError}
											</p>
										)}
									</>
								)}
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				<DialogFooter className="flex-row justify-between gap-2">
					<div>
						{step !== "idle" && (
							<Button
								variant="ghost"
								onClick={handleBack}
								disabled={isSaving || isPreviewing}
							>
								Back
							</Button>
						)}
					</div>
					<div className="flex gap-2">
						<Button
							variant="ghost"
							onClick={() => handleOpenChange(false)}
							disabled={isSaving || isPreviewing}
						>
							Cancel
						</Button>

						{step === "idle" && mode === "discover" && (
							<Button
								onClick={handleDiscover}
								disabled={isDiscovering || !discoverDomain.trim()}
							>
								<Search className="h-4 w-4" />
								Discover
							</Button>
						)}

						{step === "discovered" && (
							<Button
								onClick={handlePreview}
								disabled={selectedUrls.size === 0 || isPreviewing || isSaving}
							>
								Preview
							</Button>
						)}

						{step === "previewed" && (
							<Button onClick={handleConfirmAndSave} disabled={isSaving}>
								{isSaving ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Adding...
									</>
								) : (
									<>
										<Plus className="h-4 w-4" />
										Add {crawledUrls.length.toLocaleString()} URL
										{crawledUrls.length !== 1 ? "s" : ""}
									</>
								)}
							</Button>
						)}
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
