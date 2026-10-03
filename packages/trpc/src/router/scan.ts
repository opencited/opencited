import { TRPCError } from "@trpc/server";
import {
	runPublicScanHandler,
	runPublicScanOutputSchema,
	requestReportHandler,
	requestReportInputSchema,
	requestReportOutputSchema,
	verifyReportHandler,
	verifyReportInputSchema,
	verifyReportOutputSchema,
	getMentionProbeHandler,
	getMentionProbeInputSchema,
	getMentionProbeOutputSchema,
	getPublicScanResultHandler,
	getPublicScanResultInputSchema,
	getPublicScanResultOutputSchema,
	recordReportViewedHandler,
	recordReportViewedInputSchema,
	recordReportViewedOutputSchema,
	ScanReportError,
	runScanInputSchema,
} from "@opencited/actions";
import { ScanTargetError } from "@opencited/scanner";
import { rateLimit } from "../procedures/rateLimit";
import { createTRPCRouter, publicProcedure } from "../trpc";

const scanProcedure = publicProcedure.use(
	rateLimit({ max: 10, windowMs: 60_000 }),
);

function mapScanError(error: unknown): never {
	if (error instanceof ScanReportError) {
		const isRateLimit = error.message.includes("Too many");
		const isNotFound = error.message === "Scan not found.";
		throw new TRPCError({
			code: isRateLimit
				? "TOO_MANY_REQUESTS"
				: isNotFound
					? "NOT_FOUND"
					: "BAD_REQUEST",
			message: error.message,
		});
	}
	if (error instanceof ScanTargetError) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: error.message,
		});
	}
	if (error instanceof TRPCError) {
		throw error;
	}
	throw new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "Something went wrong while scanning. Please try again.",
	});
}

export const scanRouter = createTRPCRouter({
	run: scanProcedure
		.input(runScanInputSchema)
		.output(runPublicScanOutputSchema)
		.query(async ({ ctx, input }) => {
			try {
				return await runPublicScanHandler({
					input,
					ctx: { ...ctx, clientIp: ctx.ip },
				});
			} catch (error) {
				mapScanError(error);
			}
		}),
	requestReport: scanProcedure
		.input(requestReportInputSchema)
		.output(requestReportOutputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await requestReportHandler({ input, ctx });
			} catch (error) {
				mapScanError(error);
			}
		}),
	verifyReport: scanProcedure
		.input(verifyReportInputSchema)
		.output(verifyReportOutputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await verifyReportHandler({ input, ctx });
			} catch (error) {
				mapScanError(error);
			}
		}),
	mentionProbe: scanProcedure
		.input(getMentionProbeInputSchema)
		.output(getMentionProbeOutputSchema)
		.query(async ({ ctx, input }) => {
			try {
				return await getMentionProbeHandler({ input, ctx });
			} catch (error) {
				mapScanError(error);
			}
		}),
	publicResult: publicProcedure
		.input(getPublicScanResultInputSchema)
		.output(getPublicScanResultOutputSchema)
		.query(async ({ ctx, input }) => {
			try {
				return await getPublicScanResultHandler({ input, ctx });
			} catch (error) {
				mapScanError(error);
			}
		}),
	recordReportViewed: scanProcedure
		.input(recordReportViewedInputSchema)
		.output(recordReportViewedOutputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				return await recordReportViewedHandler({ input, ctx });
			} catch (error) {
				mapScanError(error);
			}
		}),
});
