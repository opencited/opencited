import { createTRPCRouter, orgProtectedProcedure } from "../trpc";
import {
	listRunLogsHandler,
	listRunLogsInputSchema,
	listRunLogsOutputSchema,
	listCrawlSourcesHandler,
	listCrawlSourcesInputSchema,
	listCrawlSourcesOutputSchema,
	listBrandMentionsHandler,
	listBrandMentionsInputSchema,
	listBrandMentionsOutputSchema,
	getVisibilityOverviewHandler,
	getVisibilityOverviewInputSchema,
	getVisibilityOverviewOutputSchema,
	getCompetitorIntelligenceHandler,
	getCompetitorIntelligenceInputSchema,
	getCompetitorIntelligenceOutputSchema,
	getCompetitorDetailHandler,
	getCompetitorDetailInputSchema,
	getCompetitorDetailOutputSchema,
	getCrawlScoreHandler,
	getCrawlScoreInputSchema,
	getCrawlScoreOutputSchema,
	retrySentimentHandler,
	retrySentimentInputSchema,
	retrySentimentOutputSchema,
} from "@opencited/actions";

export const aiVisibilityRouter = createTRPCRouter({
	listRunLogs: orgProtectedProcedure
		.input(listRunLogsInputSchema)
		.output(listRunLogsOutputSchema)
		.query(async ({ ctx, input }) => {
			return listRunLogsHandler({ ctx, input });
		}),

	listCrawlSources: orgProtectedProcedure
		.input(listCrawlSourcesInputSchema)
		.output(listCrawlSourcesOutputSchema)
		.query(async ({ ctx, input }) => {
			return listCrawlSourcesHandler({ ctx, input });
		}),

	listBrandMentions: orgProtectedProcedure
		.input(listBrandMentionsInputSchema)
		.output(listBrandMentionsOutputSchema)
		.query(async ({ ctx, input }) => {
			return listBrandMentionsHandler({ ctx, input });
		}),

	getVisibilityOverview: orgProtectedProcedure
		.input(getVisibilityOverviewInputSchema)
		.output(getVisibilityOverviewOutputSchema)
		.query(async ({ ctx, input }) => {
			return getVisibilityOverviewHandler({ ctx, input });
		}),

	getCompetitorIntelligence: orgProtectedProcedure
		.input(getCompetitorIntelligenceInputSchema)
		.output(getCompetitorIntelligenceOutputSchema)
		.query(async ({ ctx, input }) => {
			return getCompetitorIntelligenceHandler({ ctx, input });
		}),

	getCompetitorDetail: orgProtectedProcedure
		.input(getCompetitorDetailInputSchema)
		.output(getCompetitorDetailOutputSchema)
		.query(async ({ ctx, input }) => {
			return getCompetitorDetailHandler({ ctx, input });
		}),

	getCrawlScore: orgProtectedProcedure
		.input(getCrawlScoreInputSchema)
		.output(getCrawlScoreOutputSchema)
		.query(async ({ ctx, input }) => {
			return getCrawlScoreHandler({ ctx, input });
		}),

	retrySentiment: orgProtectedProcedure
		.input(retrySentimentInputSchema)
		.output(retrySentimentOutputSchema)
		.mutation(async ({ ctx, input }) => {
			return retrySentimentHandler({ ctx, input });
		}),
});
