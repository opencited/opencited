import {
	AutoForm as BaseAutoForm,
	type AutoFormUIComponents,
} from "@autoform/react";
import type { AutoFormProps } from "./types";
import { Form } from "./components/Form";
import { FieldWrapper } from "./components/FieldWrapper";
import { ErrorMessage } from "./components/ErrorMessage";
import { SubmitButton } from "./components/SubmitButton";
import { ObjectWrapper } from "./components/ObjectWrapper";
import { ArrayWrapper } from "./components/ArrayWrapper";
import { ArrayElementWrapper } from "./components/ArrayElementWrapper";
import { DynamicField } from "./components/DynamicField";
import {
	ShadcnAutoFormFieldComponents,
	type FieldTypes,
} from "./field-components";

const ShadcnUIComponents: AutoFormUIComponents = {
	Form,
	FieldWrapper,
	ErrorMessage,
	SubmitButton,
	ObjectWrapper,
	ArrayWrapper,
	ArrayElementWrapper,
};

export { ShadcnAutoFormFieldComponents, type FieldTypes };

export function AutoForm<T extends Record<string, any>>({
	uiComponents,
	formComponents,
	...props
}: AutoFormProps<T>) {
	return (
		<BaseAutoForm
			{...props}
			uiComponents={{ ...ShadcnUIComponents, ...uiComponents }}
			formComponents={{
				...ShadcnAutoFormFieldComponents,
				dynamic: DynamicField,
				...formComponents,
			}}
		/>
	);
}
