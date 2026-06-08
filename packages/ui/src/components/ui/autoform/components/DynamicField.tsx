import { useFormContext } from "react-hook-form";
import type { AutoFormFieldProps } from "@autoform/react";
import type React from "react";
import {
	ShadcnAutoFormFieldComponents,
	type FieldTypes,
} from "../field-components";

export const DynamicField: React.FC<AutoFormFieldProps> = ({
	inputProps,
	error,
	id,
	field,
	label,
	path,
}) => {
	const form = useFormContext();
	const values = form.watch();

	const dynamicFieldType = field.fieldConfig?.customData?.dynamicFieldType as
		| ((values: Record<string, unknown>) => FieldTypes)
		| undefined;

	const resolvedType = dynamicFieldType?.(values) ?? "string";
	const Component =
		ShadcnAutoFormFieldComponents[resolvedType] ??
		ShadcnAutoFormFieldComponents.string;

	const { key, className, ...props } = inputProps;

	return (
		<Component
			id={id}
			field={field}
			label={label}
			value={inputProps.value}
			error={error}
			path={path}
			inputProps={{
				...props,
				className:
					`${className ?? ""} ${error ? "border-destructive" : ""}`.trim(),
			}}
		/>
	);
};
