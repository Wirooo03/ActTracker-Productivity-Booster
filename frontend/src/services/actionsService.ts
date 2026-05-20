import { httpClient } from '@/lib/api/httpClient';
import { normalizeDurationHHMMSS } from '@/lib/api/duration';
import type {
	Action,
	ActionCreatePayload,
	ActionListQuery,
	ActionPatchPayload,
	ActionPutPayload,
	ApiDeleteResponse,
	ApiItemResponse,
	ApiListResponse,
	ApiMutationResponse,
} from '@/lib/api/types';

const ACTIONS_ENDPOINT = '/api/actions';
const MAX_LIST_PER_PAGE = 200;

function normalizeAction(item: Action): Action {
	const averageDuration = item['durasi rata-rata'] ?? item.average_duration;
	const normalizedAverageDuration =
		typeof averageDuration === 'string'
			? normalizeDurationHHMMSS(averageDuration)
			: null;

	return {
		...item,
		'durasi rata-rata': normalizedAverageDuration,
		average_duration: normalizedAverageDuration,
	};
}

function normalizeListResponse(response: ApiListResponse<Action>): ApiListResponse<Action> {
	return {
		...response,
		data: response.data.map(normalizeAction),
	};
}

function normalizeItemResponse(response: ApiItemResponse<Action>): ApiItemResponse<Action> {
	return {
		...response,
		data: normalizeAction(response.data),
	};
}

function normalizeMutationResponse(
	response: ApiMutationResponse<Action>,
): ApiMutationResponse<Action> {
	return {
		...response,
		data: normalizeAction(response.data),
	};
}

function assertPositiveInteger(name: string, value: number): void {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}
}

function normalizeListQuery(query?: ActionListQuery): ActionListQuery | undefined {
	if (!query) {
		return query;
	}

	const normalizedQuery: ActionListQuery = { ...query };

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

async function list(query?: ActionListQuery): Promise<ApiListResponse<Action>> {
	const response = await httpClient.get<ApiListResponse<Action>>(ACTIONS_ENDPOINT, {
		query: normalizeListQuery(query),
	});
	return normalizeListResponse(response);
}

async function getById(actionId: number): Promise<ApiItemResponse<Action>> {
	assertPositiveInteger('actionId', actionId);
	const response = await httpClient.get<ApiItemResponse<Action>>(`${ACTIONS_ENDPOINT}/${actionId}`);
	return normalizeItemResponse(response);
}

async function create(payload: ActionCreatePayload): Promise<ApiMutationResponse<Action>> {
	const response = await httpClient.post<ApiMutationResponse<Action>, ActionCreatePayload>(
		ACTIONS_ENDPOINT,
		payload,
	);

	return normalizeMutationResponse(response);
}

async function replace(actionId: number, payload: ActionPutPayload): Promise<ApiMutationResponse<Action>> {
	assertPositiveInteger('actionId', actionId);
	const response = await httpClient.put<ApiMutationResponse<Action>, ActionPutPayload>(
		`${ACTIONS_ENDPOINT}/${actionId}`,
		payload,
	);

	return normalizeMutationResponse(response);
}

async function update(actionId: number, payload: ActionPatchPayload): Promise<ApiMutationResponse<Action>> {
	assertPositiveInteger('actionId', actionId);
	const response = await httpClient.patch<ApiMutationResponse<Action>, ActionPatchPayload>(
		`${ACTIONS_ENDPOINT}/${actionId}`,
		payload,
	);

	return normalizeMutationResponse(response);
}

async function remove(actionId: number): Promise<ApiDeleteResponse> {
	assertPositiveInteger('actionId', actionId);
	return httpClient.delete<ApiDeleteResponse>(`${ACTIONS_ENDPOINT}/${actionId}`);
}

export const actionsService = {
	list,
	getById,
	create,
	replace,
	update,
	remove,
};
