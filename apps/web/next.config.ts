import { resolve } from "node:path";
import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@opencited/ui"],
	outputFileTracingRoot: resolve(process.cwd(), "../.."),
};

export default withWorkflow(nextConfig);
