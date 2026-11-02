export const GITHUB_REPOSITORY_URL = "https://github.com/opencited/opencited";
export const SCORE_SPEC_URL = `${GITHUB_REPOSITORY_URL}/blob/main/docs/agents/visibility-score.md`;

export const LANDING_NAV_LINKS = [
	{ href: "#how", label: "How it works" },
	{ href: "#preview", label: "Sample report" },
	{ href: "#open-source", label: "Open source" },
	{ href: "#faq", label: "FAQ" },
] as const;

export const SIGN_IN_URL = "/sign-in";
export const SIGN_UP_URL = "/sign-up";
export const DASHBOARD_URL = "/app/dashboard";

export function getStartedUrl(signedIn: boolean): string {
	return signedIn ? DASHBOARD_URL : SIGN_UP_URL;
}
