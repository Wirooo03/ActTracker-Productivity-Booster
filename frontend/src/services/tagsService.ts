import { httpClient } from '@/lib/api/httpClient';
import type {
	ApiDeleteResponse,
	ApiItemResponse,
	ApiListResponse,
	ApiMutationResponse,
	Tag,
	TagCreatePayload,
	TagListQuery,
	TagPatchPayload,
	TagPutPayload,
} from '@/lib/api/types';

const TAGS_ENDPOINT = '/api/tags';
const MAX_LIST_PER_PAGE = 200;

function assertPositiveInteger(name: string, value: number): void {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}
}

function normalizeListQuery(query?: TagListQuery): TagListQuery | undefined {
	if (!query) {
		return query;
	}

	const normalizedQuery: TagListQuery = { ...query };

	if (
		typeof normalizedQuery.per_page === 'number' &&
		normalizedQuery.per_page > MAX_LIST_PER_PAGE
	) {
		normalizedQuery.per_page = MAX_LIST_PER_PAGE;
	}

	if (Array.isArray(normalizedQuery.fields)) {
		const fields = normalizedQuery.fields
			.map((field) => field.trim())
			.filter((field) => field.length > 0)
			.join(',');

		normalizedQuery.fields = fields || undefined;
	}

	return normalizedQuery;
}

async function list(query?: TagListQuery): Promise<ApiListResponse<Tag>> {
	return httpClient.get<ApiListResponse<Tag>>(TAGS_ENDPOINT, {
		query: normalizeListQuery(query),
	});
}

async function getById(tagId: number): Promise<ApiItemResponse<Tag>> {
	assertPositiveInteger('tagId', tagId);
	return httpClient.get<ApiItemResponse<Tag>>(`${TAGS_ENDPOINT}/${tagId}`);
}

async function create(payload: TagCreatePayload): Promise<ApiMutationResponse<Tag>> {
	return httpClient.post<ApiMutationResponse<Tag>, TagCreatePayload>(TAGS_ENDPOINT, payload);
}

async function replace(tagId: number, payload: TagPutPayload): Promise<ApiMutationResponse<Tag>> {
	assertPositiveInteger('tagId', tagId);
	return httpClient.put<ApiMutationResponse<Tag>, TagPutPayload>(`${TAGS_ENDPOINT}/${tagId}`, payload);
}

async function update(tagId: number, payload: TagPatchPayload): Promise<ApiMutationResponse<Tag>> {
	assertPositiveInteger('tagId', tagId);
	return httpClient.patch<ApiMutationResponse<Tag>, TagPatchPayload>(
		`${TAGS_ENDPOINT}/${tagId}`,
		payload,
	);
}

async function remove(tagId: number): Promise<ApiDeleteResponse> {
	assertPositiveInteger('tagId', tagId);
	return httpClient.delete<ApiDeleteResponse>(`${TAGS_ENDPOINT}/${tagId}`);
}

export const tagsService = {
	list,
	getById,
	create,
	replace,
	update,
	remove,
};
