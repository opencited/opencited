"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/app/_trpc/client";
import { Button } from "@opencited/ui";
import { Input } from "@opencited/ui";
import { Label } from "@opencited/ui";
import { Progress } from "@opencited/ui";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@opencited/ui";
import {
	CheckCircle2,
	Circle,
	Globe,
	Loader2,
	AlertCircle,
	ExternalLink,
} from "lucide-react";

type Step =
	| "domain"
	| "discovering"
	| "selection"
	| "crawling"
	| "preview"
	| "saving";

interface DiscoveredSitemap {
	url: string;
	accessible: boolean;
}

interface CrawledUrl {
	url: string;
	lastmod: string | null;
	changefreq: string | null;
	priority: string | null;
}

export function OnboardingWizard() {
	const trpc = useTRPC();
	const router = useRouter();
	const [step, setStep] = useState<Step>("domain");
	const [domain, setDomain] = useState("");
	const [domainError, setDomainError] = useState("");
	const [sitemaps, setSitemaps] = useState<DiscoveredSitemap[]>([]);
	const [selectedSitemapUrl, setSelectedSitemapUrl] = useState<string>("");
	const [crawledUrls, setCrawledUrls] = useState<CrawledUrl[]>([]);
	const [crawlError, setCrawlError] = useState("");

	const discoverMutation = useMutation(
		trpc.domainProject.discoverSitemaps.mutationOptions({
			onError: () => {
				setDomainError("Failed to discover sitemaps. Please try again.");
				setStep("domain");
			},
		}),
	);

	const createMutation = useMutation(
		trpc.domainProject.create.mutationOptions({
			onError: () => {
				setStep("preview");
			},
		}),
	);

	const sitemapCreateMutation = useMutation(
		trpc.sitemap.create.mutationOptions({
			onError: () => {
				setStep("preview");
			},
		}),
	);

	const previewMutation = useMutation(
		trpc.sitemap.preview.mutationOptions({
			onError: () => {
				setCrawlError("Failed to fetch sitemap URLs. Please try again.");
				setStep("selection");
			},
		}),
	);

	const crawlMutation = useMutation(
		trpc.sitemap.crawl.mutationOptions({
			onError: () => {
				setCrawlError("Failed to save sitemap URLs. Please try again.");
				setStep("preview");
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

		setStep("discovering");

		try {
			const result = await discoverMutation.mutateAsync({
				domain: cleanedDomain,
			});

			setSitemaps(result.sitemaps);

			if (result.sitemaps.length === 0) {
				setStep("domain");
				setDomainError(
					"No sitemaps found. Please enter a sitemap URL manually or try a different domain.",
				);
			} else if (result.sitemaps.length === 1) {
				const firstSitemap = result.sitemaps[0];
				if (firstSitemap) {
					setSelectedSitemapUrl(firstSitemap.url);
					await fetchSitemapPreview(firstSitemap.url);
				}
			} else {
				setStep("selection");
			}
		} catch {
			setDomainError("Failed to discover sitemaps. Please try again.");
			setStep("domain");
		}
	};

	const fetchSitemapPreview = async (sitemapUrl: string) => {
		setStep("crawling");
		setCrawlError("");
		setCrawledUrls([]);

		try {
			const result = await previewMutation.mutateAsync({
				sitemapUrl,
			});

			if (result.urls.length === 0) {
				setCrawlError("No URLs found in this sitemap");
				setStep("selection");
			} else {
				setCrawledUrls(result.urls);
				setStep("preview");
			}
		} catch (err) {
			setCrawlError(
				err instanceof Error
					? err.message
					: "Failed to fetch sitemap. Please try again.",
			);
			setStep("selection");
		}
	};

	const handleSitemapSelection = () => {
		if (selectedSitemapUrl) {
			fetchSitemapPreview(selectedSitemapUrl);
		}
	};

	const handleManualSitemapSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const manualUrl = domain.startsWith("http") ? domain : `https://${domain}`;
		setSelectedSitemapUrl(manualUrl);
		fetchSitemapPreview(manualUrl);
	};

	const handleConfirmAndSave = async () => {
		setStep("saving");

		try {
			const domainProject = await createMutation.mutateAsync({
				domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
			});

			const sitemap = await sitemapCreateMutation.mutateAsync({
				domainProjectId: domainProject.id,
				url: selectedSitemapUrl,
			});

			await crawlMutation.mutateAsync({
				sitemapId: sitemap.id,
				sitemapUrl: selectedSitemapUrl,
			});

			router.push("/app/dashboard");
		} catch (err) {
			setCrawlError(
				err instanceof Error
					? err.message
					: "Failed to save sitemap. Please try again.",
			);
			setStep("preview");
		}
	};

	const steps = [
		{ id: "domain", label: "Domain" },
		{ id: "discovering", label: "Discover" },
		{ id: "selection", label: "Select" },
		{ id: "crawling", label: "Crawl" },
		{ id: "preview", label: "Preview" },
		{ id: "saving", label: "Save" },
	];

	const currentStepIndex = steps.findIndex((s) => s.id === step);
	const progress = ((currentStepIndex + 1) / steps.length) * 100;

	const previewLimit = 50;
	const displayedUrls = crawledUrls.slice(0, previewLimit);
	const remainingCount = crawledUrls.length - previewLimit;

	return (
		<div className="w-full max-w-2xl mx-auto">
			<div className="mb-8">
				<Progress value={progress} className="h-2" />
				<div className="flex justify-between mt-2">
					{steps.map((s, i) => (
						<span
							key={s.id}
							className={`text-xs ${
								i <= currentStepIndex
									? "text-primary font-medium"
									: "text-muted-foreground"
							}`}
						>
							{s.label}
						</span>
					))}
				</div>
			</div>

			{step === "domain" && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Globe className="h-5 w-5" />
							Enter Your Domain
						</CardTitle>
						<CardDescription>
							Start by entering the website domain you want to analyze.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleDomainSubmit} className="space-y-4">
							<div>
								<Label htmlFor="domain">Website Domain</Label>
								<Input
									id="domain"
									type="text"
									placeholder="example.com"
									value={domain}
									onChange={(e) => setDomain(e.target.value)}
									className="mt-1"
								/>
								{domainError && (
									<p className="text-sm text-red-500 mt-1 flex items-center gap-1">
										<AlertCircle className="h-4 w-4" />
										{domainError}
									</p>
								)}
							</div>
							<div className="flex gap-2">
								<Button type="submit">Discover Sitemaps</Button>
								<Button
									type="button"
									variant="outline"
									onClick={handleManualSitemapSubmit}
								>
									Enter Sitemap Manually
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			)}

			{step === "discovering" && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Loader2 className="h-5 w-5 animate-spin" />
							Discovering Sitemaps
						</CardTitle>
						<CardDescription>
							Looking for sitemaps at common locations on your domain...
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
			)}

			{step === "selection" && (
				<Card>
					<CardHeader>
						<CardTitle>Select a Sitemap</CardTitle>
						<CardDescription>
							Multiple sitemaps were found. Select the one you want to use.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{crawlError && (
							<div className="p-3 bg-red-50 border border-red-200 rounded-md">
								<p className="text-sm text-red-600 flex items-center gap-2">
									<AlertCircle className="h-4 w-4" />
									{crawlError}
								</p>
							</div>
						)}
						<div className="space-y-2">
							{sitemaps.map((sitemap) => (
								<label
									key={sitemap.url}
									className={`flex items-center space-x-3 p-3 border rounded-md cursor-pointer transition-colors ${
										selectedSitemapUrl === sitemap.url
											? "bg-primary/10 border-primary"
											: "hover:bg-muted/50"
									}`}
								>
									<input
										type="radio"
										name="sitemap-selection"
										value={sitemap.url}
										checked={selectedSitemapUrl === sitemap.url}
										onChange={() => setSelectedSitemapUrl(sitemap.url)}
										className="sr-only"
									/>
									{selectedSitemapUrl === sitemap.url ? (
										<CheckCircle2 className="h-5 w-5 text-primary" />
									) : (
										<Circle className="h-5 w-5 text-muted-foreground" />
									)}
									<span className="text-sm font-mono">{sitemap.url}</span>
								</label>
							))}
						</div>
						<div className="flex gap-2 pt-4">
							<Button
								onClick={handleSitemapSelection}
								disabled={!selectedSitemapUrl}
							>
								Continue
							</Button>
							<Button variant="outline" onClick={() => setStep("domain")}>
								Back
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{step === "crawling" && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Loader2 className="h-5 w-5 animate-spin" />
							Crawling Sitemap
						</CardTitle>
						<CardDescription>
							Fetching URLs from {selectedSitemapUrl}...
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
			)}

			{step === "preview" && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							{crawlError ? (
								<AlertCircle className="h-5 w-5 text-red-500" />
							) : (
								<CheckCircle2 className="h-5 w-5 text-green-500" />
							)}
							{crawlError ? "Error" : "Preview Sitemap URLs"}
						</CardTitle>
						<CardDescription>
							{crawlError
								? crawlError
								: `Found ${crawledUrls.length} URLs in ${selectedSitemapUrl}`}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{crawlError ? (
							<div className="flex gap-2 pt-4">
								<Button variant="outline" onClick={() => setStep("selection")}>
									Back to Selection
								</Button>
								<Button variant="outline" onClick={() => setStep("domain")}>
									Try Another Domain
								</Button>
							</div>
						) : (
							<>
								<div className="max-h-80 overflow-y-auto border rounded-md">
									<div className="divide-y">
										{displayedUrls.map((urlItem, index) => (
											<div
												key={`${urlItem.url}-${index}`}
												className="p-2 flex items-center justify-between text-sm"
											>
												<span className="font-mono truncate flex-1 mr-2">
													{urlItem.url}
												</span>
												<a
													href={urlItem.url}
													target="_blank"
													rel="noopener noreferrer"
													className="text-muted-foreground hover:text-primary shrink-0"
													onClick={(e) => e.stopPropagation()}
												>
													<ExternalLink className="h-4 w-4" />
												</a>
											</div>
										))}
									</div>
									{remainingCount > 0 && (
										<div className="p-2 bg-muted/50 text-center">
											<p className="text-sm text-muted-foreground">
												And {remainingCount.toLocaleString()} more URLs...
											</p>
										</div>
									)}
								</div>
								<div className="flex gap-2 pt-4">
									<Button onClick={handleConfirmAndSave}>
										Confirm & Create Project
									</Button>
									<Button
										variant="outline"
										onClick={() => setStep("selection")}
									>
										Back
									</Button>
								</div>
							</>
						)}
					</CardContent>
				</Card>
			)}

			{step === "saving" && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Loader2 className="h-5 w-5 animate-spin" />
							Creating Project
						</CardTitle>
						<CardDescription>
							Saving your domain project and sitemap URLs...
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
