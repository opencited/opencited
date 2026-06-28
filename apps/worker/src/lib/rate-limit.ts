interface Bucket {
	tokens: number;
	lastRefillMs: number;
	rps: number;
}

const buckets = new Map<string, Bucket>();

export function parseRateLimits(): Record<string, { rps: number }> {
	const raw = process.env.CRAWL_RATE_LIMITS;
	if (!raw) return {};
	const parsed = JSON.parse(raw) as Record<string, unknown>;
	for (const [key, value] of Object.entries(parsed)) {
		if (
			typeof value !== "object" ||
			value === null ||
			typeof (value as { rps?: unknown }).rps !== "number"
		) {
			throw new Error(
				`Invalid CRAWL_RATE_LIMITS: "${key}" must have a numeric "rps" field`,
			);
		}
	}
	return parsed as Record<string, { rps: number }>;
}

function getBucket(provider: string): Bucket | undefined {
	if (buckets.has(provider)) return buckets.get(provider);

	const config = parseRateLimits();
	const entry = config[provider];
	if (!entry) return undefined;

	const bucket: Bucket = {
		tokens: 1,
		lastRefillMs: Date.now(),
		rps: entry.rps,
	};
	buckets.set(provider, bucket);
	return bucket;
}

function refill(bucket: Bucket): void {
	const now = Date.now();
	const elapsed = (now - bucket.lastRefillMs) / 1000;
	bucket.tokens = Math.min(1, bucket.tokens + elapsed * bucket.rps);
	bucket.lastRefillMs = now;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function _resetBucketsForTesting(): void {
	buckets.clear();
}

export async function rateLimit(provider: string): Promise<void> {
	const bucket = getBucket(provider);
	if (!bucket) return;

	refill(bucket);

	if (bucket.tokens < 1) {
		const waitMs = ((1 - bucket.tokens) / bucket.rps) * 1000;
		await sleep(waitMs);
		bucket.tokens = 0;
		bucket.lastRefillMs = Date.now();
	} else {
		bucket.tokens -= 1;
	}
}
