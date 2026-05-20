import { httpClient } from '@/lib/api/httpClient';
import type {
	ApiDeleteResponse,
	ApiItemResponse,
	ApiListResponse,
	ApiMutationResponse,
	Group,
	GroupCreatePayload,
	GroupListQuery,
	GroupPatchPayload,
	GroupPutPayload,
} from '@/lib/api/types';

const GROUPS_ENDPOINT = '/api/groups';
const MAX_LIST_PER_PAGE = 200;

function assertPositiveInteger(name: string, value: number): void {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}
}

function normalizeListQuery(query?: GroupListQuery): GroupListQuery | undefined {
	if (!query) {
		return query;
	}

	const normalizedQuery: GroupListQuery = { ...query };

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

async function list(query?: GroupListQuery): Promise<ApiListResponse<Group>> {
	return httpClient.get<ApiListResponse<Group>>(GROUPS_ENDPOINT, {
		query: normalizeListQuery(query),
	});
}

async function getById(groupId: number): Promise<ApiItemResponse<Group>> {
	assertPositiveInteger('groupId', groupId);
	return httpClient.get<ApiItemResponse<Group>>(`${GROUPS_ENDPOINT}/${groupId}`);
}

async function create(payload: GroupCreatePayload): Promise<ApiMutationResponse<Group>> {
	return httpClient.post<ApiMutationResponse<Group>, GroupCreatePayload>(
		GROUPS_ENDPOINT,
		payload,
	);
}

async function replace(groupId: number, payload: GroupPutPayload): Promise<ApiMutationResponse<Group>> {
	assertPositiveInteger('groupId', groupId);
	return httpClient.put<ApiMutationResponse<Group>, GroupPutPayload>(
		`${GROUPS_ENDPOINT}/${groupId}`,
		payload,
	);
}

async function update(groupId: number, payload: GroupPatchPayload): Promise<ApiMutationResponse<Group>> {
	assertPositiveInteger('groupId', groupId);
	return httpClient.patch<ApiMutationResponse<Group>, GroupPatchPayload>(
		`${GROUPS_ENDPOINT}/${groupId}`,
		payload,
	);
}

async function remove(groupId: number): Promise<ApiDeleteResponse> {
	assertPositiveInteger('groupId', groupId);
	return httpClient.delete<ApiDeleteResponse>(`${GROUPS_ENDPOINT}/${groupId}`);
}

export const groupsService = {
	list,
	getById,
	create,
	replace,
	update,
	remove,
};
