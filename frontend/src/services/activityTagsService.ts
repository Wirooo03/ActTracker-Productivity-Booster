import { httpClient } from '@/lib/api/httpClient';
import type {
	ActivityTag,
	ActivityTagCreatePayload,
	ActivityTagListQuery,
	ActivityTagPatchPayload,
	ActivityTagPutPayload,
	ApiDeleteResponse,
	ApiItemResponse,
	ApiListResponse,
	ApiMutationResponse,
} from '@/lib/api/types';

const ACTIVITY_TAGS_ENDPOINT = '/api/activity-tags';

function assertPositiveInteger(name: string, value: number): void {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}
}

async function list(query?: ActivityTagListQuery): Promise<ApiListResponse<ActivityTag>> {
	return httpClient.get<ApiListResponse<ActivityTag>>(ACTIVITY_TAGS_ENDPOINT, { query });
}

async function getById(activityTagId: number): Promise<ApiItemResponse<ActivityTag>> {
	assertPositiveInteger('activityTagId', activityTagId);
	return httpClient.get<ApiItemResponse<ActivityTag>>(`${ACTIVITY_TAGS_ENDPOINT}/${activityTagId}`);
}

async function create(
	payload: ActivityTagCreatePayload,
): Promise<ApiMutationResponse<ActivityTag>> {
	return httpClient.post<ApiMutationResponse<ActivityTag>, ActivityTagCreatePayload>(
		ACTIVITY_TAGS_ENDPOINT,
		payload,
	);
}

async function replace(
	activityTagId: number,
	payload: ActivityTagPutPayload,
): Promise<ApiMutationResponse<ActivityTag>> {
	assertPositiveInteger('activityTagId', activityTagId);
	return httpClient.put<ApiMutationResponse<ActivityTag>, ActivityTagPutPayload>(
		`${ACTIVITY_TAGS_ENDPOINT}/${activityTagId}`,
		payload,
	);
}

async function update(
	activityTagId: number,
	payload: ActivityTagPatchPayload,
): Promise<ApiMutationResponse<ActivityTag>> {
	assertPositiveInteger('activityTagId', activityTagId);
	return httpClient.patch<ApiMutationResponse<ActivityTag>, ActivityTagPatchPayload>(
		`${ACTIVITY_TAGS_ENDPOINT}/${activityTagId}`,
		payload,
	);
}

async function remove(activityTagId: number): Promise<ApiDeleteResponse> {
	assertPositiveInteger('activityTagId', activityTagId);
	return httpClient.delete<ApiDeleteResponse>(`${ACTIVITY_TAGS_ENDPOINT}/${activityTagId}`);
}

export const activityTagsService = {
	list,
	getById,
	create,
	replace,
	update,
	remove,
};
