import type React from "react";
import { Button } from "../../../../button";

export const SubmitButton: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => <Button type="submit">{children}</Button>;
