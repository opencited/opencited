import type React from "react";
import { Switch } from "../../../../switch";
import type { AutoFormFieldProps } from "@autoform/react";
import { Label } from "../../../../label";

export const SwitchField: React.FC<AutoFormFieldProps> = ({
	field,
	label,
	id,
	inputProps,
	value,
}) => (
	<div className="flex items-center space-x-2">
		<Switch
			id={id}
			onCheckedChange={(checked) => {
				const event = {
					target: {
						name: field.key,
						value: checked,
					},
				};
				inputProps.onChange(event);
			}}
			checked={inputProps.value ?? field.default ?? value}
		/>
		<Label htmlFor={id}>
			{label}
			{field.required && <span className="text-destructive"> *</span>}
		</Label>
	</div>
);
