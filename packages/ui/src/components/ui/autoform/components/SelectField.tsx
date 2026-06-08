import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../../../select";
import type { AutoFormFieldProps } from "@autoform/react";
import type React from "react";

export const SelectField: React.FC<AutoFormFieldProps> = ({
	field,
	inputProps,
	error,
	id,
	value,
}) => {
	const { key, ...props } = inputProps;

	return (
		<Select
			{...props}
			onValueChange={(value) => {
				const syntheticEvent = {
					target: {
						value,
						name: field.key,
					},
				} as React.ChangeEvent<HTMLInputElement>;
				props.onChange(syntheticEvent);
			}}
			defaultValue={field.default ?? value}
		>
			<SelectTrigger id={id} className={error ? "border-destructive" : ""}>
				<SelectValue placeholder="Select an option" />
			</SelectTrigger>
			<SelectContent>
				{(field.options || []).map(([key, label]) => (
					<SelectItem key={key} value={key}>
						{label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
};
