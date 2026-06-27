import { createTRPCRouter, orgProtectedProcedure } from "../trpc";
import {
	getDashboardVisibilityMetricsHandler,
	getDashboardVisibilityMetricsInputSchema,
	getDashboardVisibilityMetricsOutputSchema,
	getContentHealthMetricsHandler,
	getContentHealthMetricsInputSchema,
	getContentHealthMetricsOutputSchema,
	getVisibilityAggregateHandler,
	getVisibilityAggregateInputSchema,
	getVisibilityAggregateOutputSchema,
} from "@opencited/actions";

export const dashboardRouter = createTRPCRouter({
	getVisibilityMetrics: orgProtectedProcedure
		.input(getDashboardVisibilityMetricsInputSchema)
		.output(getDashboardVisibilityMetricsOutputSchema)
		.query(async ({ ctx, input }) => {
			return getDashboardVisibilityMetricsHandler({ ctx, input });
		}),
	getContentHealth: orgProtectedProcedure
		.input(getContentHealthMetricsInputSchema)
		.output(getContentHealthMetricsOutputSchema)
		.query(async ({ ctx, input }) => {
			return getContentHealthMetricsHandler({ ctx, input });
		}),
	getVisibilityAggregate: orgProtectedProcedure
		.input(getVisibilityAggregateInputSchema)
		.output(getVisibilityAggregateOutputSchema)
		.query(async ({ ctx, input }) => {
			return getVisibilityAggregateHandler({ ctx, input });
		}),
});
