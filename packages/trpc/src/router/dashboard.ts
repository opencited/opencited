import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
	getDashboardVisibilityMetricsHandler,
	getDashboardVisibilityMetricsInputSchema,
	getDashboardVisibilityMetricsOutputSchema,
	getContentHealthMetricsHandler,
	getContentHealthMetricsInputSchema,
	getContentHealthMetricsOutputSchema,
} from "@opencited/actions";

export const dashboardRouter = createTRPCRouter({
	getVisibilityMetrics: publicProcedure
		.input(getDashboardVisibilityMetricsInputSchema)
		.output(getDashboardVisibilityMetricsOutputSchema)
		.query(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return getDashboardVisibilityMetricsHandler({ ctx, input });
		}),
	getContentHealth: publicProcedure
		.input(getContentHealthMetricsInputSchema)
		.output(getContentHealthMetricsOutputSchema)
		.query(async ({ ctx, input }) => {
			const { orgId } = await auth();
			if (!orgId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "No organization found",
				});
			}
			return getContentHealthMetricsHandler({ ctx, input });
		}),
});
