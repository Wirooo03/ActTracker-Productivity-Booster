import { httpClient } from '@/lib/api/httpClient';
import type {
	ApiDeleteResponse,
	ApiItemResponse,
	ApiListResponse,
	ApiMutationResponse,
	Tag,
	TagCreatePayload,
	TagPatchPayload,
	TagPutPayload,
} from '@/lib/api/types';

const TAGS_ENDPOINT = '/api/tags';

function assertPositiveInteger(name: string, value: number): void {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}
}

async function list(): Promise<ApiListResponse<Tag>> {
	return httpClient.get<ApiListResponse<Tag>>(TAGS_ENDPOINT);
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
