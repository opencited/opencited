import { TRPCError } from "@trpc/server";
import { cache } from "react";
import { notFound } from "next/navigation";
import { trpc } from "@/app/_trpc/server";

export const loadPublicScanResult = cache(async (scanId: string) => {
	try {
		return await trpc.scan.publicResult(scanId);
	} catch (error) {
		if (
			error instanceof TRPCError &&
			(error.code === "NOT_FOUND" || error.code === "BAD_REQUEST")
		) {
			notFound();
		}
		throw error;
	}
});
