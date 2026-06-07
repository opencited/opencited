import {
	fieldConfig as zodFieldConfig,
	ZodProvider,
} from "@autoform/zod/dist/v4";
import type { FieldTypes } from "../components/ui/autoform";
import type { z } from "zod/v4";

export type AutoFormFieldConfig = {
	label?: string;
	description?: string;
	inputProps?: Record<string, any>;
	fieldType?: FieldTypes;
	order?: number;
	fieldWrapper?: React.ComponentType<any>;
	customData?: Record<string, any>;
};

export function createAutoFormSchema<T extends z.ZodObject>(
	schema: T,
	fieldConfigs: { [K in keyof T["shape"]]?: AutoFormFieldConfig },
) {
	const shape = schema.shape;

	for (const [key, config] of Object.entries(fieldConfigs)) {
		if (config && key in shape) {
			const field = shape[key];
			const [registry, meta] = zodFieldConfig(config);
			registry.add(field, meta);
		}
	}

	return new ZodProvider(schema);
}
