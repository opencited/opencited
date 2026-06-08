import { StringField } from "./components/StringField";
import { NumberField } from "./components/NumberField";
import { BooleanField } from "./components/BooleanField";
import { DateField } from "./components/DateField";
import { SelectField } from "./components/SelectField";
import { TextareaField } from "./components/TextareaField";
import { SwitchField } from "./components/SwitchField";

export const ShadcnAutoFormFieldComponents = {
	string: StringField,
	number: NumberField,
	boolean: BooleanField,
	date: DateField,
	select: SelectField,
	textarea: TextareaField,
	switch: SwitchField,
} as const;

export type FieldTypes = keyof typeof ShadcnAutoFormFieldComponents;
