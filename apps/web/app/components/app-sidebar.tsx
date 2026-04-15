"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import {
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
	useSidebar,
} from "@opencited/ui";
import { Skeleton } from "@opencited/ui";
import { LayoutDashboard, PanelLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { BrandNameLink } from "./brand-name";

export function AppSidebar() {
	const pathname = usePathname();
	const { state, toggleSidebar } = useSidebar();
	const isCollapsed = state === "collapsed";

	const navigationLinks = useMemo(
		() => [
			{
				name: "Dashboard",
				link: "/dashboard",
				isActive: pathname.includes("dashboard"),
				icon: <LayoutDashboard className="size-4" />,
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
							<SidebarMenuButton asChild>
								<BrandNameLink className="text-xl lg:text-2xl" />
							</SidebarMenuButton>
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
									afterSelectOrganizationUrl="/dashboard"
									hidePersonal
									afterLeaveOrganizationUrl="/organizations"
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
					<SidebarGroupLabel className={cn(isCollapsed && "sr-only")}>
						Navigation
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navigationLinks.map((navItem) => (
								<SidebarMenuItem key={navItem.link}>
									<SidebarMenuButton
										tooltip={navItem.name}
										isActive={navItem.isActive}
										asChild
									>
										<Link href={navItem.link}>
											{navItem.icon}
											<span>{navItem.name}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			{!isCollapsed && (
				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							<div className="px-2 py-1 text-xs text-muted-foreground">
								Opencited v1.0
							</div>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
			)}
			<SidebarRail />
		</Sidebar>
	);
}
