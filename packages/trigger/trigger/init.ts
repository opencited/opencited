import { tasks } from "@trigger.dev/sdk/v3";
import "./db";

tasks.onStartAttempt(({ ctx, payload, task }) => {
	console.log(`🚀 Run ${ctx.run.id} started on task ${task}`);
});

tasks.onSuccess(({ ctx, output }) => {
	console.log(`✅ Run ${ctx.run.id} succeeded`);
});

tasks.onFailure(({ ctx, error }) => {
	console.error(`❌ Run ${ctx.run.id} failed:`, error);
});
