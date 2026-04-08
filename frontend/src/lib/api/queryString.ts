import type { PrimitiveQueryValue, QueryParams, QueryValue } from './types';

function appendValue(
	searchParams: URLSearchParams,
	key: string,
	value: PrimitiveQueryValue,
): void {
	searchParams.append(key, String(value));
}

function appendQueryParam(searchParams: URLSearchParams, key: string, value: QueryValue): void {
	if (value === null || value === undefined) {
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			if (item === null || item === undefined) {
				continue;
			}

			appendValue(searchParams, key, item);
		}
		return;
	}

	appendValue(searchParams, key, value);
}

export function toQueryString(params?: QueryParams): string {
	if (!params) {
		return '';
	}

	const searchParams = new URLSearchParams();

	for (const [key, value] of Object.entries(params)) {
		appendQueryParam(searchParams, key, value);
	}

	const serialized = searchParams.toString();
	return serialized ? `?${serialized}` : '';
}

export function withQueryString(path: string, params?: QueryParams): string {
	if (!params) {
		return path;
	}

	const [pathname, existingQuery = ''] = path.split('?', 2);
	const searchParams = new URLSearchParams(existingQuery);

	for (const [key, value] of Object.entries(params)) {
		appendQueryParam(searchParams, key, value);
	}

	const serialized = searchParams.toString();
	if (!serialized) {
		return pathname;
	}

	return `${pathname}?${serialized}`;
}
