import { runTechnicalScan, ScanTargetError } from "../src";

const target = process.argv[2] ?? "example.com";

console.log(`\nScanning: ${target}\n`);

try {
	const started = performance.now();
	const result = await runTechnicalScan(target);
	const wallMs = Math.round(performance.now() - started);
	console.log(
		`Score: ${result.score}/100  (${result.durationMs}ms engine, ${wallMs}ms wall)`,
	);
	console.log(`Final URL: ${result.finalUrl}`);
	if (result.issues.length === 0) {
		console.log("No issues found.");
	} else {
		for (const issue of result.issues) {
			console.log(`\n[${issue.weight}] ${issue.check}: ${issue.issue}`);
			console.log(`  goal:     ${issue.goal}`);
			console.log(`  howToFix: ${issue.howToFix}`);
		}
	}
} catch (err) {
	if (err instanceof ScanTargetError) {
		console.error(`\nCannot scan: ${err.message}`);
		process.exit(1);
	}
	console.error(`\nScan failed:`, err instanceof Error ? err.message : err);
	process.exit(1);
}
