import type { UseQueryResult } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface QueryCellProps<TData, TError = unknown> {
	query: Pick<
		UseQueryResult<TData, TError>,
		"data" | "isLoading" | "isError" | "error"
	>;
	success: (data: TData) => React.ReactNode;
	error?: (error: TError) => React.ReactNode;
	loading?: React.ReactNode;
}

function QueryCell<TData, TError = unknown>({
	query,
	success,
	error,
	loading,
}: QueryCellProps<TData, TError>) {
	if (query.isLoading) {
		if (loading) return loading;
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (query.isError) {
		if (error && query.error) return error(query.error);
		return (
			<div className="flex items-center justify-center py-12 text-destructive">
				{query.error instanceof Error
					? query.error.message
					: "Something went wrong. Try refreshing."}
			</div>
		);
	}

	return success(query.data as TData);
}

export { QueryCell };
