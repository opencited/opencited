import { TRPCError } from "@trpc/server";
import {
	runScanHandler,
	runScanInputSchema,
	runScanOutputSchema,
} from "@opencited/actions";
import { ScanTargetError } from "@opencited/scanner";
import { rateLimit } from "../procedures/rateLimit";
import { createTRPCRouter, publicProcedure } from "../trpc";

const scanProcedure = publicProcedure.use(
	rateLimit({ max: 10, windowMs: 60_000 }),
);

export const scanRouter = createTRPCRouter({
	run: scanProcedure
		.input(runScanInputSchema)
		.output(runScanOutputSchema)
		.query(async ({ input }) => {
			try {
				return await runScanHandler({ input });
			} catch (error) {
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
		}),
});
