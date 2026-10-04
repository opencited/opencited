import { dispatch, type JobPayload } from "./index";

export async function dispatchScanMentionProbe(
	payload: JobPayload<"scan-mention-probe">,
): Promise<{ jobId: string }> {
	return dispatch("scan-mention-probe", payload);
}
