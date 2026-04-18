import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CreateOrganization } from "@clerk/nextjs";
import { OnboardingWizard } from "./_components/onboarding-wizard";
import { trpc } from "@/app/_trpc/server";

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

	const domainProject = await trpc.domainProject.get();

	if (domainProject) {
		redirect("/app/dashboard");
	}

	return (
		<main className="min-h-screen flex items-start justify-center p-8">
			<OnboardingWizard />
		</main>
	);
}
