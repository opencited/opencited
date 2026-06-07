import { Textarea } from "../../../../textarea";
import type { AutoFormFieldProps } from "@autoform/react";
import type React from "react";

export const TextareaField: React.FC<AutoFormFieldProps> = ({
	inputProps,
	error,
	id,
}) => {
	const { key, ...props } = inputProps;

	return (
		<Textarea
			id={id}
			className={error ? "border-destructive" : ""}
			{...props}
		/>
	);
};
