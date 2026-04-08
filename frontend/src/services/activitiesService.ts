import { httpClient } from '@/lib/api/httpClient';
import type {
	Activity,
	ActivityCreatePayload,
	ActivityPatchPayload,
	ActivityPutPayload,
	ApiDeleteResponse,
	ApiItemResponse,
	ApiListResponse,
	ApiMutationResponse,
} from '@/lib/api/types';

const ACTIVITIES_ENDPOINT = '/api/activities';

function assertPositiveInteger(name: string, value: number): void {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}
}

function assertMonth(month: number): void {
	if (!Number.isInteger(month) || month < 1 || month > 12) {
		throw new Error('month must be an integer in range 1..12.');
	}
}

async function list(): Promise<ApiListResponse<Activity>> {
	return httpClient.get<ApiListResponse<Activity>>(ACTIVITIES_ENDPOINT);
}

async function listByDate(date: string): Promise<ApiListResponse<Activity>> {
	return httpClient.get<ApiListResponse<Activity>>(
		`${ACTIVITIES_ENDPOINT}/date/${encodeURIComponent(date)}`,
	);
}

async function listByMonth(year: number, month: number): Promise<ApiListResponse<Activity>> {
	assertPositiveInteger('year', year);
	assertMonth(month);

	return httpClient.get<ApiListResponse<Activity>>(`${ACTIVITIES_ENDPOINT}/month/${year}/${month}`);
}

async function getById(activityId: number): Promise<ApiItemResponse<Activity>> {
	assertPositiveInteger('activityId', activityId);
	return httpClient.get<ApiItemResponse<Activity>>(`${ACTIVITIES_ENDPOINT}/${activityId}`);
}

async function create(payload: ActivityCreatePayload): Promise<ApiMutationResponse<Activity>> {
	return httpClient.post<ApiMutationResponse<Activity>, ActivityCreatePayload>(
		ACTIVITIES_ENDPOINT,
		payload,
	);
}

async function replace(
	activityId: number,
	payload: ActivityPutPayload,
): Promise<ApiMutationResponse<Activity>> {
	assertPositiveInteger('activityId', activityId);
	return httpClient.put<ApiMutationResponse<Activity>, ActivityPutPayload>(
		`${ACTIVITIES_ENDPOINT}/${activityId}`,
		payload,
	);
}

async function update(
	activityId: number,
	payload: ActivityPatchPayload,
): Promise<ApiMutationResponse<Activity>> {
	assertPositiveInteger('activityId', activityId);
	return httpClient.patch<ApiMutationResponse<Activity>, ActivityPatchPayload>(
		`${ACTIVITIES_ENDPOINT}/${activityId}`,
		payload,
	);
}

async function remove(activityId: number): Promise<ApiDeleteResponse> {
	assertPositiveInteger('activityId', activityId);
	return httpClient.delete<ApiDeleteResponse>(`${ACTIVITIES_ENDPOINT}/${activityId}`);
}

export const activitiesService = {
	list,
	listByDate,
	listByMonth,
	getById,
	create,
	replace,
	update,
	remove,
};
