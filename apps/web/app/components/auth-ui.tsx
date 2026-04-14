import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export function AuthUI() {
	return (
		<header>
			<Show when="signed-out">
				<SignInButton />
				<SignUpButton />
			</Show>
			<Show when="signed-in">
				<UserButton />
			</Show>
		</header>
	);
}
