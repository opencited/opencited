import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "../_trpc/client";

export default function OnboardingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ClerkProvider>
			<TRPCReactProvider>{children}</TRPCReactProvider>
		</ClerkProvider>
	);
}
