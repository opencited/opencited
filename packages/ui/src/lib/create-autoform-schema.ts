import {
	fieldConfig as zodFieldConfig,
	ZodProvider,
} from "@autoform/zod/dist/v4";
import type { FieldTypes } from "../components/ui/autoform";
import type { z } from "zod/v4";

type ZodShape<T extends z.ZodObject> = z.infer<T>;
type DynamicFieldTypeFn<T> = (formValues: Partial<T>) => FieldTypes;

export type AutoFormFieldConfig<T = Record<string, unknown>> = {
	label?: string;
	description?: string;
	inputProps?: Record<string, unknown>;
	fieldType?: FieldTypes | DynamicFieldTypeFn<T>;
	order?: number;
	fieldWrapper?: React.ComponentType<unknown>;
	showWhen?: (formValues: Partial<T>) => boolean;
	customData?: Record<string, unknown>;
};

export function createAutoFormSchema<T extends z.ZodObject>(
	schema: T,
	fieldConfigs: {
		[K in keyof T["shape"]]?: AutoFormFieldConfig<ZodShape<T>>;
	},
) {
	const shape = schema.shape;

	for (const [key, config] of Object.entries(fieldConfigs)) {
		if (config && key in shape) {
			const field = shape[key];
			const { showWhen, fieldType: rawFieldType, ...restConfig } = config;

			const isDynamicFn = typeof rawFieldType === "function";
			const resolvedFieldType = isDynamicFn ? "dynamic" : rawFieldType;

			const enhancedConfig = {
				...restConfig,
				fieldType: resolvedFieldType,
				customData: {
					...config.customData,
					showWhen,
					...(isDynamicFn ? { dynamicFieldType: rawFieldType } : {}),
				},
			};
			const [registry, meta] = zodFieldConfig(enhancedConfig);
			registry.add(field, meta);
		}
	}

	return new ZodProvider(schema);
}
