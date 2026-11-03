import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import {
	SidebarInset,
	SidebarProvider,
	ThemeProvider,
	Toaster,
} from "@opencited/ui";
import { TRPCError } from "@trpc/server";
import { redirect } from "next/navigation";
import { TRPCReactProvider } from "../_trpc/client";
import { trpc } from "../_trpc/server";
import { ActiveCrawlIndicatorWrapper } from "../components/active-crawl-indicator-wrapper";
import { AppSidebar } from "../components/app-sidebar";
import { DomainProjectProvider } from "../components/domain-project-provider";

export default async function ProtectedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { userId, orgId } = await auth();

	if (!userId) {
		redirect("/sign-in");
	}

	if (!orgId) {
		redirect("/onboarding");
	}

	let domainProject: Awaited<ReturnType<typeof trpc.domainProject.get>> = null;
	try {
		domainProject = await trpc.domainProject.get();
	} catch (error) {
		if (!(error instanceof TRPCError) || error.code !== "NOT_FOUND") {
			throw error;
		}
	}

	if (!domainProject) {
		redirect("/onboarding");
	}

	const serializedDomainProject = {
		...domainProject,
		createdAt: domainProject.createdAt.toISOString(),
		updatedAt: domainProject.updatedAt.toISOString(),
	};

	return (
		<ClerkProvider>
			<TRPCReactProvider>
				<ThemeProvider>
					<SidebarProvider>
						<div className="flex w-full h-screen flex-row">
							<AppSidebar />
							<SidebarInset>
								<main className="h-full grow overflow-auto px-3 lg:px-5 lg:py-5">
									<DomainProjectProvider
										domainProject={serializedDomainProject}
									>
										{children}
									</DomainProjectProvider>
								</main>
							</SidebarInset>
						</div>
						<ActiveCrawlIndicatorWrapper domainProjectId={domainProject.id} />
					</SidebarProvider>
					<Toaster />
				</ThemeProvider>
			</TRPCReactProvider>
		</ClerkProvider>
	);
}
