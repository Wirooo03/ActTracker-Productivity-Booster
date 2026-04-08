import { ApiError } from './apiError';
import { withQueryString } from './queryString';
import type { QueryParams } from './types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type HttpRequestOptions<TBody = unknown> = Omit<
	RequestInit,
	'method' | 'body' | 'cache'
> & {
	method?: HttpMethod;
	query?: QueryParams;
	body?: TBody;
	cache?: RequestCache;
};

function resolveApiBaseUrl(): string {
	const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');

	if (!value) {
		throw new Error(
			'Missing NEXT_PUBLIC_API_BASE_URL. Define it in your environment variables.',
		);
	}

	return value;
}

function normalizePath(path: string): string {
	if (/^https?:\/\//i.test(path)) {
		return path;
	}

	return path.startsWith('/') ? path : `/${path}`;
}

function isJsonBody(value: unknown): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value !== 'object') {
		return false;
	}

	if (value instanceof FormData) {
		return false;
	}

	if (value instanceof URLSearchParams) {
		return false;
	}

	if (typeof Blob !== 'undefined' && value instanceof Blob) {
		return false;
	}

	if (value instanceof ArrayBuffer) {
		return false;
	}

	if (ArrayBuffer.isView(value)) {
		return false;
	}

	return true;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
	const rawText = await response.text();

	if (!rawText) {
		return null;
	}

	try {
		return JSON.parse(rawText) as unknown;
	} catch {
		return rawText;
	}
}

export async function request<TResponse, TBody = unknown>(
	path: string,
	options: HttpRequestOptions<TBody> = {},
): Promise<TResponse> {
	const {
		method = 'GET',
		query,
		body,
		headers: rawHeaders,
		cache = 'no-store',
		...rest
	} = options;

	const baseUrl = resolveApiBaseUrl();
	const url = withQueryString(`${baseUrl}${normalizePath(path)}`, query);
	const headers = new Headers(rawHeaders);
	headers.set('Accept', 'application/json');

	let serializedBody: BodyInit | undefined;
	if (body !== undefined) {
		if (isJsonBody(body)) {
			if (!headers.has('Content-Type')) {
				headers.set('Content-Type', 'application/json');
			}
			serializedBody = JSON.stringify(body);
		} else {
			serializedBody = body as BodyInit;
		}
	}

	const response = await fetch(url, {
		...rest,
		method,
		cache,
		headers,
		body: serializedBody,
	});

	const payload = await parseResponsePayload(response);

	if (!response.ok) {
		throw ApiError.fromResponse(response.status, payload);
	}

	return payload as TResponse;
}

export const httpClient = {
	request,
	get<TResponse>(
		path: string,
		options?: Omit<HttpRequestOptions<never>, 'method' | 'body'>,
	): Promise<TResponse> {
		return request<TResponse>(path, {
			...options,
			method: 'GET',
		});
	},
	post<TResponse, TBody>(
		path: string,
		body: TBody,
		options?: Omit<HttpRequestOptions<TBody>, 'method' | 'body'>,
	): Promise<TResponse> {
		return request<TResponse, TBody>(path, {
			...options,
			method: 'POST',
			body,
		});
	},
	put<TResponse, TBody>(
		path: string,
		body: TBody,
		options?: Omit<HttpRequestOptions<TBody>, 'method' | 'body'>,
	): Promise<TResponse> {
		return request<TResponse, TBody>(path, {
			...options,
			method: 'PUT',
			body,
		});
	},
	patch<TResponse, TBody>(
		path: string,
		body: TBody,
		options?: Omit<HttpRequestOptions<TBody>, 'method' | 'body'>,
	): Promise<TResponse> {
		return request<TResponse, TBody>(path, {
			...options,
			method: 'PATCH',
			body,
		});
	},
	delete<TResponse>(
		path: string,
		options?: Omit<HttpRequestOptions<never>, 'method' | 'body'>,
	): Promise<TResponse> {
		return request<TResponse>(path, {
			...options,
			method: 'DELETE',
		});
	},
};
