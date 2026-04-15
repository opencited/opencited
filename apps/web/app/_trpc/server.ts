import { appRouter, createTRPCContext } from "@opencited/trpc";
import { t } from "@opencited/trpc";

const createCaller = t.createCallerFactory(appRouter);

export const trpc = createCaller(createTRPCContext);
