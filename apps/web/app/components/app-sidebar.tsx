"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import {
	Kbd,
	KbdGroup,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarSeparator,
	Skeleton,
	ThemeToggle,
	useSidebar,
	Button,
} from "@opencited/ui";
import {
	Database,
	Keyboard,
	LayoutDashboard,
	MessageSquare,
	PanelLeft,
	ScrollText,
	Settings,
	Shield,
	Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { BrandNameLink } from "./brand-name";
import { DomainDisplay } from "./domain-display";

interface NavigationLink {
	name: string;
	link: string;
	isActive: boolean;
	icon: React.ReactNode;
	shortcut?: string;
}

interface Shortcut {
	keys: string[];
	description: string;
}

const shortcuts: Shortcut[] = [
	{ keys: ["?"], description: "Show keyboard shortcuts" },
	{ keys: ["B"], description: "Toggle sidebar" },
	{ keys: ["G"], description: "Go to Dashboard" },
	{ keys: ["S"], description: "Go to Sitemaps" },
	{ keys: ["P"], description: "Go to Prompts" },
	{ keys: ["V"], description: "Go to AI Visibility" },
];

export function AppSidebar() {
	const pathname = usePathname();
	const router = useRouter();
	const { state, toggleSidebar } = useSidebar();
	const isCollapsed = state === "collapsed";
	const [showShortcuts, setShowShortcuts] = useState(false);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "?") {
				event.preventDefault();
				setShowShortcuts(true);
			}
			if (event.key === "b" && (event.metaKey || event.ctrlKey)) {
				return;
			}
			if (event.key === "b") {
				const target = event.target as HTMLElement;
				if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
					return;
				}
				const customEvent = new KeyboardEvent("keydown", {
					key: "b",
					metaKey: true,
					ctrlKey: true,
					bubbles: true,
				});
				document.dispatchEvent(customEvent);
			}
			if (event.key === "g" && !event.metaKey && !event.ctrlKey) {
				const target = event.target as HTMLElement;
				if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
					return;
				}
				router.push("/app/dashboard");
			}
			if (event.key === "s" && !event.metaKey && !event.ctrlKey) {
				const target = event.target as HTMLElement;
				if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
					return;
				}
				router.push("/app/sitemaps");
			}
			if (event.key === "p" && !event.metaKey && !event.ctrlKey) {
				const target = event.target as HTMLElement;
				if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
					return;
				}
				router.push("/app/prompts");
			}
			if (event.key === "v" && !event.metaKey && !event.ctrlKey) {
				const target = event.target as HTMLElement;
				if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
					return;
				}
				router.push("/app/ai-visibility");
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [router]);

	const navigationLinks = useMemo<NavigationLink[]>(
		() => [
			{
				name: "Dashboard",
				link: "/app/dashboard",
				isActive: pathname.includes("dashboard"),
				icon: <LayoutDashboard className="size-4" />,
				shortcut: "G",
			},
			{
				name: "AI Visibility",
				link: "/app/ai-visibility",
				isActive: pathname.includes("ai-visibility"),
				icon: <Target className="size-4" />,
				shortcut: "V",
			},
			{
				name: "Competitors",
				link: "/app/competitors",
				isActive: pathname.includes("/competitors"),
				icon: <Shield className="size-4" />,
			},
			{
				name: "Prompts",
				link: "/app/prompts",
				isActive: pathname.includes("prompts"),
				icon: <MessageSquare className="size-4" />,
				shortcut: "P",
			},

			{
				name: "Sitemaps",
				link: "/app/sitemaps",
				isActive: pathname.includes("sitemaps"),
				icon: <Database className="size-4" />,
				shortcut: "S",
			},
			{
				name: "Crawl History",
				link: "/app/run-logs",
				isActive: pathname.includes("run-logs"),
				icon: <ScrollText className="size-4" />,
			},
		],
		[pathname],
	);

	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem
						className={cn("py-4", isCollapsed && "flex justify-center")}
					>
						{isCollapsed ? (
							<SidebarMenuButton
								type="button"
								onClick={toggleSidebar}
								className="flex items-center justify-center cursor-pointer"
							>
								<PanelLeft className="size-5" />
							</SidebarMenuButton>
						) : (
							<div className="flex items-center justify-between">
								<SidebarMenuButton asChild>
									<BrandNameLink className="text-xl lg:text-2xl" />
								</SidebarMenuButton>
								<ThemeToggle />
							</div>
						)}
					</SidebarMenuItem>
					{!isCollapsed && (
						<SidebarMenuItem
							className={cn(
								" w-full flex  items-center justify-between gap-4 ",
								isCollapsed ? "flex-col items-start pe-0" : "pe-2",
							)}
						>
							<SidebarMenuButton>
								<OrganizationSwitcher
									afterSelectOrganizationUrl="/app/dashboard"
									hidePersonal
									afterLeaveOrganizationUrl="/app"
									afterCreateOrganizationUrl="/onboarding"
									skipInvitationScreen
									fallback={<Skeleton className="h-6 w-40 animate-pulse" />}
								/>
							</SidebarMenuButton>
							<SidebarMenuAction asChild>
								<UserButton
									fallback={
										<Skeleton className="h-6 w-6 animate-pulse rounded-full" />
									}
								/>
							</SidebarMenuAction>
						</SidebarMenuItem>
					)}
					{isCollapsed && (
						<SidebarMenuItem className="flex justify-center">
							<SidebarMenuAction asChild>
								<UserButton
									fallback={
										<Skeleton className="h-6 w-6 animate-pulse rounded-full" />
									}
								/>
							</SidebarMenuAction>
						</SidebarMenuItem>
					)}
				</SidebarMenu>
			</SidebarHeader>
			<SidebarSeparator />
			<SidebarContent>
				<SidebarGroup>
					{!isCollapsed && (
						<SidebarMenuItem>
							<DomainDisplay className="text-lg" iconClassName="size-5" />
						</SidebarMenuItem>
					)}
					<SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
						Analytics
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navigationLinks
								.filter((navItem) =>
									["dashboard", "ai-visibility", "competitors"].some((slug) =>
										navItem.link.includes(slug),
									),
								)
								.map((navItem) => (
									<SidebarMenuItem key={navItem.link}>
										<SidebarMenuButton
											tooltip={
												isCollapsed
													? `${navItem.name} (${navItem.shortcut})`
													: navItem.name
											}
											isActive={navItem.isActive}
											asChild
										>
											<Link href={navItem.link}>
												{navItem.icon}
												<span>{navItem.name}</span>
												{!isCollapsed && navItem.shortcut && (
													<Kbd className="ml-auto text-[9px]">
														{navItem.shortcut}
													</Kbd>
												)}
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
						Content
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navigationLinks
								.filter((navItem) =>
									["prompts", "sitemaps"].some((slug) =>
										navItem.link.includes(slug),
									),
								)
								.map((navItem) => (
									<SidebarMenuItem key={navItem.link}>
										<SidebarMenuButton
											tooltip={
												isCollapsed
													? `${navItem.name} (${navItem.shortcut})`
													: navItem.name
											}
											isActive={navItem.isActive}
											asChild
										>
											<Link href={navItem.link}>
												{navItem.icon}
												<span>{navItem.name}</span>
												{!isCollapsed && navItem.shortcut && (
													<Kbd className="ml-auto text-[9px]">
														{navItem.shortcut}
													</Kbd>
												)}
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
						Monitoring
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navigationLinks
								.filter((navItem) =>
									["run-logs"].some((slug) => navItem.link.includes(slug)),
								)
								.map((navItem) => (
									<SidebarMenuItem key={navItem.link}>
										<SidebarMenuButton
											tooltip={
												isCollapsed
													? `${navItem.name} (${navItem.shortcut})`
													: navItem.name
											}
											isActive={navItem.isActive}
											asChild
										>
											<Link href={navItem.link}>
												{navItem.icon}
												<span>{navItem.name}</span>
												{!isCollapsed && navItem.shortcut && (
													<Kbd className="ml-auto text-[9px]">
														{navItem.shortcut}
													</Kbd>
												)}
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
						Settings
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip={isCollapsed ? "Proxy Settings" : "Proxy Settings"}
									isActive={pathname.includes("settings/proxy")}
									asChild
								>
									<Link href="/app/settings/proxy">
										<Settings className="size-4" />
										<span>Proxy</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			{!isCollapsed && (
				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							<Button
								type="button"
								onClick={() => setShowShortcuts(true)}
								variant="ghost"
								size="sm"
								className="w-full justify-start gap-2"
							>
								<Keyboard className="size-3.5" />
								<span>Shortcuts</span>
								<Kbd className="ml-auto">?</Kbd>
							</Button>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
			)}
			<SidebarRail />
			<Sheet open={showShortcuts} onOpenChange={setShowShortcuts}>
				<SheetContent className="w-full max-w-sm">
					<SheetHeader>
						<SheetTitle className="flex items-center gap-2">
							<Keyboard className="size-4" />
							Keyboard Shortcuts
						</SheetTitle>
						<SheetDescription>Press keys to navigate quickly</SheetDescription>
					</SheetHeader>
					<div className="mt-6 space-y-4">
						{shortcuts.map((shortcut, index) => (
							<div key={index} className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">
									{shortcut.description}
								</span>
								<KbdGroup>
									{shortcut.keys.map((key, keyIndex) => (
										<Kbd key={keyIndex}>{key}</Kbd>
									))}
								</KbdGroup>
							</div>
						))}
					</div>
				</SheetContent>
			</Sheet>
		</Sidebar>
	);
}
