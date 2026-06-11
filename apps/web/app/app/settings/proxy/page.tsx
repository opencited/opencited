"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/app/components/page-shell";
import { useTRPC } from "@/app/_trpc/client";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Button,
	Skeleton,
	Spinner,
	AutoForm,
	createAutoFormSchema,
} from "@opencited/ui";
import { QueryCell } from "@/app/components/query-cell";
import { useConfirmation } from "@/app/hooks/use-confirmation";
import { toast } from "sonner";
import { Settings, Save, Trash2 } from "lucide-react";
import { proxyConfigInsertSchema } from "@opencited/db";
import type React from "react";

const formSchema = proxyConfigInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
	domainProjectId: true,
});

const schemaProvider = createAutoFormSchema(formSchema, {
	enabled: {
		label: "Enable custom proxy",
		description: "Use your proxy settings for all browser crawling requests",
		fieldType: "switch",
		order: -3,
	},
	stickyProxyEnabled: {
		label: "Sticky proxy",
		description:
			"Reuse the last successful proxy for faster crawls. Falls back to the full list on failure.",
		fieldType: "switch",
		order: -2,
		showWhen: (values) => values.enabled === true,
	},
	sourceType: {
		label: "Proxy source",
		fieldType: "select",
		order: -1,
	},
	sourceValue: {
		label: "Proxy list",
		description: "Format: host:port or host:port:username:password",
		fieldType: (values) =>
			values.sourceType === "api" ? "string" : "textarea",
		inputProps: {
			type: "url",
			placeholder: "https://api.proxyprovider.com/v1/proxies?key=xxx",
			className: "font-mono text-sm",
			rows: 6,
		},
		order: 0,
	},
});

export default function ProxySettingsPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { confirm, dialog } = useConfirmation();

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
				toast.success("Proxy config deleted");
			},
			onError: (error) => {
				toast.error("Failed to delete", { description: error.message });
			},
		}),
	);

	const existingConfig = proxyQuery.data;

	const handleSubmit = async (data: Record<string, unknown>) => {
		const domainProject = domainProjectQuery.data;
		if (!domainProject) {
			toast.error("Validation error", {
				description: "No domain project found.",
			});
			return;
		}

		const input = {
			domainProjectId: domainProject.id,
			sourceType: data.sourceType as "batch" | "api",
			sourceValue: (data.sourceValue as string).trim(),
			enabled: data.enabled as boolean,
			stickyProxyEnabled: data.stickyProxyEnabled as boolean,
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

	const SubmitButton: React.FC<{ children: React.ReactNode }> = ({
		children,
	}) => (
		<div className="flex items-center gap-3">
			<Button type="submit" disabled={isSaving} className="gap-2">
				{isSaving ? (
					<Spinner className="h-4 w-4" />
				) : (
					<Save className="h-4 w-4" />
				)}
				{children}
			</Button>
			{existingConfig && (
				<Button
					type="button"
					variant="destructive"
					onClick={handleDelete}
					disabled={deleteMutation.isPending}
					className="gap-2"
				>
					<Trash2 className="h-4 w-4" />
					Delete
				</Button>
			)}
		</div>
	);

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
								<AutoForm
									schema={schemaProvider}
									defaultValues={
										existingConfig
											? {
													enabled: existingConfig.enabled,
													stickyProxyEnabled: existingConfig.stickyProxyEnabled,
													sourceType: existingConfig.sourceType as
														| "batch"
														| "api",
													sourceValue: existingConfig.sourceValue,
												}
											: undefined
									}
									onSubmit={handleSubmit}
									withSubmit
									uiComponents={{
										SubmitButton,
									}}
								/>
							</CardContent>
						</Card>
					</div>
				)}
			/>
		</PageShell>
	);
}
