import { auth } from "@clerk/nextjs/server";
import { ClerkProvider } from "@clerk/nextjs";
import { SidebarInset, SidebarProvider } from "@opencited/ui";
import { redirect } from "next/navigation";
import { TRPCReactProvider } from "../_trpc/client";
import { AppSidebar } from "../components/app-sidebar";

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
		redirect("/dashboard/create-organization");
	}

	return (
		<ClerkProvider>
			<TRPCReactProvider>
				<SidebarProvider>
					<div className="flex w-full h-screen flex-row">
						<AppSidebar />
						<SidebarInset>
							<main className="h-full grow overflow-auto px-3 lg:px-5 lg:py-5">
								{children}
							</main>
						</SidebarInset>
					</div>
				</SidebarProvider>
			</TRPCReactProvider>
		</ClerkProvider>
	);
}
