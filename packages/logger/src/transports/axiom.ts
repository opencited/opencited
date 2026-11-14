import { Axiom } from "@axiomhq/js";
import { env } from "../env";
import { isLevelEnabled } from "../levels";
import type { LogLevel, Transport } from "../types";

/** Minimal Axiom client surface used by the transport (injectable for tests). */
export interface AxiomClient {
	ingest(dataset: string, events: Array<object> | object): unknown;
	flush(): Promise<void>;
}

export interface AxiomTransportOptions {
	level?: LogLevel;
	/** Inject an Axiom client instead of constructing one from env. */
	client?: AxiomClient;
	/** Dataset used with an injected client. Falls back to `AXIOM_DATASET`. */
	dataset?: string;
}

export class AxiomTransport implements Transport {
	private axiom: AxiomClient;
	private dataset: string;
	private level: LogLevel;

	constructor(options?: AxiomTransportOptions) {
		this.level = options?.level ?? env.LOGGER_LEVEL;

		if (options?.client) {
			this.axiom = options.client;
			this.dataset = options.dataset ?? env.AXIOM_DATASET ?? "";
			return;
		}

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
	}

	log(level: LogLevel, message: string, ctx: Record<string, unknown>): void {
		if (!isLevelEnabled(level, this.level)) return;

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
}
