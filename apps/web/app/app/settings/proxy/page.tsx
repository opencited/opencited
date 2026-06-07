"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { PageShell } from "@/app/components/page-shell";
import { useTRPC } from "@/app/_trpc/client";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Button,
	Textarea,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Checkbox,
	Skeleton,
	Spinner,
} from "@opencited/ui";
import { QueryCell } from "@/app/components/query-cell";
import { Settings, Save, Trash2 } from "lucide-react";
import { useConfirmation } from "@/app/hooks/use-confirmation";
import { toast } from "sonner";

export default function ProxySettingsPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { confirm, dialog } = useConfirmation();

	const [sourceType, setSourceType] = useState<"batch" | "api">("batch");
	const [sourceValue, setSourceValue] = useState("");
	const [enabled, setEnabled] = useState(false);
	const [stickyProxyEnabled, setStickyProxyEnabled] = useState(true);
	const [isInitialized, setIsInitialized] = useState(false);

	const proxyQuery = useQuery(trpc.proxyConfig.get.queryOptions({}));
	const domainProjectQuery = useQuery(trpc.domainProject.get.queryOptions());

	const createMutation = useMutation(
		trpc.proxyConfig.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.proxyConfig.get.queryFilter());
				toast.success("Proxy config saved");
			},
			onError: (error) => {
				toast.error("Failed to save", { description: error.message });
			},
		}),
	);

	const updateMutation = useMutation(
		trpc.proxyConfig.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.proxyConfig.get.queryFilter());
				toast.success("Proxy config updated");
			},
			onError: (error) => {
				toast.error("Failed to update", { description: error.message });
			},
		}),
	);

	const deleteMutation = useMutation(
		trpc.proxyConfig.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.proxyConfig.get.queryFilter());
				setSourceValue("");
				setEnabled(false);
				setStickyProxyEnabled(true);
				setSourceType("batch");
				toast.success("Proxy config deleted");
			},
			onError: (error) => {
				toast.error("Failed to delete", { description: error.message });
			},
		}),
	);

	useEffect(() => {
		if (proxyQuery.data && !isInitialized) {
			setSourceType(proxyQuery.data.sourceType as "batch" | "api");
			setSourceValue(proxyQuery.data.sourceValue);
			setEnabled(proxyQuery.data.enabled === true);
			setStickyProxyEnabled(proxyQuery.data.stickyProxyEnabled === true);
			setIsInitialized(true);
		}
	}, [proxyQuery.data, isInitialized]);

	const _isLoading = proxyQuery.isLoading;
	const existingConfig = proxyQuery.data;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!sourceValue.trim()) {
			toast.error("Validation error", {
				description: "Please provide a proxy list or API URL.",
			});
			return;
		}

		const domainProject = domainProjectQuery.data;
		if (!domainProject) {
			toast.error("Validation error", {
				description: "No domain project found.",
			});
			return;
		}

		const input = {
			domainProjectId: domainProject.id,
			sourceType,
			sourceValue: sourceValue.trim(),
			enabled,
			stickyProxyEnabled,
		};

		if (existingConfig) {
			updateMutation.mutate({ ...input, id: existingConfig.id });
		} else {
			createMutation.mutate(input);
		}
	};

	const handleDelete = async () => {
		const confirmed = await confirm({
			title: "Delete proxy config",
			description:
				"This will remove your proxy settings. Crawls will fall back to the default proxy configuration.",
			confirmLabel: "Delete",
			variant: "destructive",
		});
		if (confirmed) {
			deleteMutation.mutate({});
		}
	};

	const isSaving = createMutation.isPending || updateMutation.isPending;

	return (
		<PageShell
			title="Proxy Settings"
			action={<Settings className="h-5 w-5 text-muted-foreground" />}
		>
			{dialog}
			<QueryCell
				query={proxyQuery}
				loading={
					<Card>
						<CardHeader>
							<Skeleton className="h-5 w-32" />
							<Skeleton className="h-4 w-64" />
						</CardHeader>
						<CardContent className="space-y-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-32 w-full" />
						</CardContent>
					</Card>
				}
				error={(error) => (
					<Card>
						<CardContent className="py-8 text-center">
							<p className="text-destructive">
								Couldn&apos;t load proxy settings. {error.message}
							</p>
						</CardContent>
					</Card>
				)}
				success={() => (
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Proxy Configuration</CardTitle>
								<CardDescription>
									Configure custom proxy settings for browser crawling. When
									enabled, crawls will use your proxy instead of the default
									configuration.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<form onSubmit={handleSubmit} className="space-y-6">
									<div className="flex items-center justify-between">
										<div>
											<Label>Enable custom proxy</Label>
											<p className="text-sm text-muted-foreground">
												Use your proxy settings for all browser crawling
												requests
											</p>
										</div>
										<Checkbox
											checked={enabled}
											onCheckedChange={(checked) =>
												setEnabled(checked === true)
											}
										/>
									</div>

									{enabled && (
										<div className="flex items-center justify-between">
											<div>
												<Label>Sticky proxy</Label>
												<p className="text-sm text-muted-foreground">
													Reuse the last successful proxy for faster crawls.
													Falls back to the full list on failure.
												</p>
											</div>
											<Checkbox
												checked={stickyProxyEnabled}
												onCheckedChange={(checked) =>
													setStickyProxyEnabled(checked === true)
												}
											/>
										</div>
									)}

									<div className="space-y-3">
										<Label>Proxy source</Label>
										<Select
											value={sourceType}
											onValueChange={(v: "batch" | "api") => setSourceType(v)}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="batch">Proxy batch list</SelectItem>
												<SelectItem value="api">Proxy API fetch URL</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{sourceType === "batch" ? (
										<div className="space-y-2">
											<Label htmlFor="proxy-list">
												Proxy list (one per line)
											</Label>
											<p className="text-sm text-muted-foreground">
												Format:{" "}
												<code className="rounded bg-muted px-1">host:port</code>{" "}
												or{" "}
												<code className="rounded bg-muted px-1">
													host:port:username:password
												</code>
											</p>
											<Textarea
												id="proxy-list"
												value={sourceValue}
												onChange={(e) => setSourceValue(e.target.value)}
												placeholder={
													"proxy1.example.com:8080\nproxy2.example.com:8080:user:pass"
												}
												rows={6}
												className="font-mono text-sm"
											/>
										</div>
									) : (
										<div className="space-y-2">
											<Label htmlFor="proxy-api-url">Proxy API URL</Label>
											<p className="text-sm text-muted-foreground">
												URL that returns a plain-text list of proxies (one{" "}
												<code className="rounded bg-muted px-1">host:port</code>{" "}
												per line)
											</p>
											<Input
												id="proxy-api-url"
												value={sourceValue}
												onChange={(e) => setSourceValue(e.target.value)}
												placeholder="https://api.proxyprovider.com/v1/proxies?key=xxx"
												type="url"
											/>
										</div>
									)}

									<div className="flex items-center gap-3">
										<Button type="submit" disabled={isSaving} className="gap-2">
											{isSaving ? (
												<Spinner className="h-4 w-4" />
											) : (
												<Save className="h-4 w-4" />
											)}
											Save settings
										</Button>
										{existingConfig && (
											<Button
												type="button"
												variant="outline"
												onClick={handleDelete}
												disabled={deleteMutation.isPending}
												className="gap-2 text-destructive hover:text-destructive"
											>
												<Trash2 className="h-4 w-4" />
												Delete
											</Button>
										)}
									</div>
								</form>
							</CardContent>
						</Card>
					</div>
				)}
			/>
		</PageShell>
	);
}
