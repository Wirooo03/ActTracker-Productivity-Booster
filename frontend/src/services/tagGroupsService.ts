import { httpClient } from '@/lib/api/httpClient';
import type {
	ApiDeleteResponse,
	ApiItemResponse,
	ApiListResponse,
	ApiMutationResponse,
	TagGroup,
	TagGroupCreatePayload,
	TagGroupListQuery,
	TagGroupPatchPayload,
	TagGroupPutPayload,
} from '@/lib/api/types';

const TAG_GROUPS_ENDPOINT = '/api/tag-groups';
const MAX_LIST_PER_PAGE = 200;

function assertPositiveInteger(name: string, value: number): void {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}
}

function normalizeListQuery(query?: TagGroupListQuery): TagGroupListQuery | undefined {
	if (!query) {
		return query;
	}

	const normalizedQuery: TagGroupListQuery = { ...query };

	if (
		typeof normalizedQuery.per_page === 'number' &&
		normalizedQuery.per_page > MAX_LIST_PER_PAGE
	) {
		normalizedQuery.per_page = MAX_LIST_PER_PAGE;
	}

	if (Array.isArray(normalizedQuery.fields)) {
		normalizedQuery.fields = normalizedQuery.fields
			.map((field) => field.trim())
			.filter((field) => field.length > 0)
			.join(',');
	}

	if (Array.isArray(normalizedQuery.include)) {
		normalizedQuery.include = normalizedQuery.include
			.map((relation) => relation.trim())
			.filter((relation) => relation.length > 0)
			.join(',');
	}

	return normalizedQuery;
}

async function list(query?: TagGroupListQuery): Promise<ApiListResponse<TagGroup>> {
	return httpClient.get<ApiListResponse<TagGroup>>(TAG_GROUPS_ENDPOINT, {
		query: normalizeListQuery(query),
	});
}

async function getById(tagGroupsId: number): Promise<ApiItemResponse<TagGroup>> {
	assertPositiveInteger('tagGroupsId', tagGroupsId);
	return httpClient.get<ApiItemResponse<TagGroup>>(`${TAG_GROUPS_ENDPOINT}/${tagGroupsId}`);
}

async function create(payload: TagGroupCreatePayload): Promise<ApiMutationResponse<TagGroup>> {
	return httpClient.post<ApiMutationResponse<TagGroup>, TagGroupCreatePayload>(
		TAG_GROUPS_ENDPOINT,
		payload,
	);
}

async function replace(
	tagGroupsId: number,
	payload: TagGroupPutPayload,
): Promise<ApiMutationResponse<TagGroup>> {
	assertPositiveInteger('tagGroupsId', tagGroupsId);
	return httpClient.put<ApiMutationResponse<TagGroup>, TagGroupPutPayload>(
		`${TAG_GROUPS_ENDPOINT}/${tagGroupsId}`,
		payload,
	);
}

async function update(
	tagGroupsId: number,
	payload: TagGroupPatchPayload,
): Promise<ApiMutationResponse<TagGroup>> {
	assertPositiveInteger('tagGroupsId', tagGroupsId);
	return httpClient.patch<ApiMutationResponse<TagGroup>, TagGroupPatchPayload>(
		`${TAG_GROUPS_ENDPOINT}/${tagGroupsId}`,
		payload,
	);
}

async function remove(tagGroupsId: number): Promise<ApiDeleteResponse> {
	assertPositiveInteger('tagGroupsId', tagGroupsId);
	return httpClient.delete<ApiDeleteResponse>(`${TAG_GROUPS_ENDPOINT}/${tagGroupsId}`);
}

export const tagGroupsService = {
	list,
	getById,
	create,
	replace,
	update,
	remove,
};
