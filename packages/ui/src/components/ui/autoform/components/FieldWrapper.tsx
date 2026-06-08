import type React from "react";
import { Label } from "../../../../label";
import type { FieldWrapperProps } from "@autoform/react";
import { useFormContext } from "react-hook-form";

const DISABLED_LABELS = ["boolean", "object", "array"];

export const FieldWrapper: React.FC<FieldWrapperProps> = ({
	label,
	children,
	id,
	field,
	error,
}) => {
	const isDisabled = DISABLED_LABELS.includes(field.type);

	const form = useFormContext();
	const values = form.watch();

	const showWhen = field.fieldConfig?.customData?.showWhen as
		| ((values: Record<string, unknown>) => boolean)
		| undefined;

	if (showWhen && !showWhen(values)) {
		return null;
	}

	return (
		<div className="space-y-2">
			{!isDisabled && (
				<Label htmlFor={id}>
					{label}
					{field.required && <span className="text-destructive"> *</span>}
				</Label>
			)}
			{children}
			{field.fieldConfig?.description && (
				<p className="text-sm text-muted-foreground">
					{field.fieldConfig.description}
				</p>
			)}
			{error && <p className="text-sm text-destructive">{error}</p>}
		</div>
	);
};
