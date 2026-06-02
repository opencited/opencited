import { Axiom } from "@axiomhq/js";
import type { LogLevel, Transport } from "../types";
import { env } from "../env";

export class AxiomTransport implements Transport {
	private axiom: Axiom;
	private dataset: string;
	private level: LogLevel;

	constructor(options?: { level?: LogLevel }) {
		if (!env.AXIOM_TOKEN) {
			throw new Error(
				"AXIOM_TRANSPORT_ENABLED=true but AXIOM_TOKEN is not set",
			);
		}
		if (!env.AXIOM_DATASET) {
			throw new Error(
				"AXIOM_TRANSPORT_ENABLED=true but AXIOM_DATASET is not set",
			);
		}

		this.axiom = new Axiom({
			token: env.AXIOM_TOKEN,
			onError: (err) => {
				console.error("[AxiomTransport]", err);
			},
		});
		this.dataset = env.AXIOM_DATASET;
		this.level = options?.level ?? env.LOGGER_LEVEL;
	}

	log(level: LogLevel, message: string, ctx: Record<string, unknown>): void {
		if (level === "off") return;
		if (!this.shouldLog(level)) return;

		const event = {
			_time: new Date().toISOString(),
			level,
			message,
			...ctx,
		};

		this.axiom.ingest(this.dataset, [event]);
	}

	async flush(): Promise<void> {
		await this.axiom.flush();
	}

	private shouldLog(level: LogLevel): boolean {
		const hierarchy: Record<LogLevel, number> = {
			off: 0,
			error: 1,
			warn: 2,
			info: 3,
			debug: 4,
		};
		return (hierarchy[level] ?? 0) >= (hierarchy[this.level] ?? 0);
	}
}
