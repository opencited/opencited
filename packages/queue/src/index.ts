import { Queue } from "bullmq";
import IORedis from "ioredis";
import { jobs, type JobName, type JobPayload } from "./jobs";
import { env } from "./env";

export { jobs, type JobName, type JobPayload } from "./jobs";
export {
	dispatchCrawlJob,
	getJobNameForProvider,
} from "./dispatch-crawl-job";

const queues = new Map<string, Queue>();

function getRedisConnection(): IORedis {
	return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

function getQueue(name: string): Queue {
	if (!queues.has(name)) {
		queues.set(
			name,
			new Queue(name, {
				connection: getRedisConnection(),
			}),
		);
	}
	return queues.get(name)!;
}

export async function dispatch<K extends JobName>(
	jobName: K,
	payload: JobPayload<K>,
): Promise<{ jobId: string }> {
	const definition = jobs[jobName];
	const parsed = definition.payload.parse(payload);

	const queue = getQueue(jobName);
	const job = await queue.add(jobName, parsed, definition.options);

	if (!job.id) {
		throw new Error(`Failed to enqueue job "${jobName}"`);
	}

	return { jobId: job.id };
}

export async function closeQueues(): Promise<void> {
	await Promise.all(Array.from(queues.values()).map((q) => q.close()));
	queues.clear();
}
