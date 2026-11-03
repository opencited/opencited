import { CreateOrganization } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { TooltipProvider } from "@opencited/ui";
import { TRPCError } from "@trpc/server";
import { redirect } from "next/navigation";
import { trpc } from "@/app/_trpc/server";
import { OnboardingWizard } from "./_components/onboarding-wizard";

export default async function OnboardingPage() {
	const { userId, orgId } = await auth();

	if (!userId) {
		redirect("/sign-in");
	}

	if (!orgId) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen">
				<h1 className="text-2xl font-bold mb-4">Create Your Organization</h1>
				<p className="text-muted-foreground mb-8">
					You need to create an organization to continue.
				</p>
				<CreateOrganization />
			</div>
		);
	}

	let domainProject: Awaited<ReturnType<typeof trpc.domainProject.get>> = null;
	try {
		domainProject = await trpc.domainProject.get();
	} catch (error) {
		if (!(error instanceof TRPCError) || error.code !== "NOT_FOUND") {
			throw error;
		}
	}

	if (domainProject) {
		redirect("/app/dashboard");
	}

	return (
		<main className="min-h-screen flex items-start justify-center p-8">
			<TooltipProvider>
				<OnboardingWizard />
			</TooltipProvider>
		</main>
	);
}
