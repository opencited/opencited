import { createTRPCRouter, publicProcedure } from "../trpc";
import {
	listPromptTemplateHandler,
	listPromptTemplateOutputSchema,
} from "@opencited/actions";

export const promptTemplateRouter = createTRPCRouter({
	list: publicProcedure
		.output(listPromptTemplateOutputSchema)
		.query(async ({ ctx }) => {
			return listPromptTemplateHandler({ ctx });
		}),
});
