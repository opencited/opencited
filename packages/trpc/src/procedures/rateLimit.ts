import { TRPCError } from "@trpc/server";
import { t } from "../trpc";

const buckets = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = (options: { max: number; windowMs: number }) =>
	t.middleware(({ ctx, next }) => {
		const key = ctx.ip;
		if (key) {
			const now = Date.now();
			if (buckets.size > 1000) {
				for (const [bucketKey, bucket] of buckets) {
					if (bucket.resetAt <= now) {
						buckets.delete(bucketKey);
					}
				}
			}
			const bucket = buckets.get(key);
			if (!bucket || bucket.resetAt <= now) {
				buckets.set(key, { count: 1, resetAt: now + options.windowMs });
			} else {
				bucket.count += 1;
				if (bucket.count > options.max) {
					throw new TRPCError({
						code: "TOO_MANY_REQUESTS",
						message:
							"Too many scans from this connection. Please wait a minute and try again.",
					});
				}
			}
		}
		return next();
	});
