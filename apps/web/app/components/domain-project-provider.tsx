"use client";

import { createContext, useContext } from "react";

type DomainProject = {
	id: string;
	clerkOrganizationId: string | null;
	domain: string;
	name: string | null;
	aliases: unknown;
	logoUrl: string | null;
	active: boolean;
	createdAt: string;
	updatedAt: string;
};

const DomainProjectContext = createContext<DomainProject | null>(null);

export function DomainProjectProvider({
	children,
	domainProject,
}: {
	children: React.ReactNode;
	domainProject: DomainProject;
}) {
	return (
		<DomainProjectContext.Provider value={domainProject}>
			{children}
		</DomainProjectContext.Provider>
	);
}

export function useDomainProject() {
	const ctx = useContext(DomainProjectContext);
	if (!ctx) {
		throw new Error(
			"useDomainProject must be used within a DomainProjectProvider",
		);
	}
	return ctx;
}
