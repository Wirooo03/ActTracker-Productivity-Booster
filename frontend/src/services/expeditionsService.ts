import { httpClient } from '@/lib/api/httpClient';
import { normalizeDurationHHMMSS } from '@/lib/api/duration';
import type {
	ApiDeleteResponse,
	ApiItemResponse,
	ApiListResponse,
	ApiMutationResponse,
	Expedition,
	ExpeditionCreatePayload,
	ExpeditionListQuery,
	ExpeditionPatchPayload,
	ExpeditionPutPayload,
} from '@/lib/api/types';

const EXPEDITIONS_ENDPOINT = '/api/expeditions';

function normalizeExpedition(item: Expedition): Expedition {
	return {
		...item,
		duration: normalizeDurationHHMMSS(item.duration) ?? item.duration,
	};
}

function normalizeListResponse(
	response: ApiListResponse<Expedition>,
): ApiListResponse<Expedition> {
	return {
		...response,
		data: response.data.map(normalizeExpedition),
	};
}

function normalizeItemResponse(
	response: ApiItemResponse<Expedition>,
): ApiItemResponse<Expedition> {
	return {
		...response,
		data: normalizeExpedition(response.data),
	};
}

function normalizeMutationResponse(
	response: ApiMutationResponse<Expedition>,
): ApiMutationResponse<Expedition> {
	return {
		...response,
		data: normalizeExpedition(response.data),
	};
}

function normalizeCreatePayload(payload: ExpeditionCreatePayload): ExpeditionCreatePayload {
	const normalizedDuration = normalizeDurationHHMMSS(payload.duration);
	if (!normalizedDuration) {
		throw new Error('Invalid duration format. Use HH:mm:ss or HH:mm.');
	}

	return {
		...payload,
		duration: normalizedDuration,
	};
}

function normalizePutPayload(payload: ExpeditionPutPayload): ExpeditionPutPayload {
	const normalizedDuration = normalizeDurationHHMMSS(payload.duration);
	if (!normalizedDuration) {
		throw new Error('Invalid duration format. Use HH:mm:ss or HH:mm.');
	}

	return {
		...payload,
		duration: normalizedDuration,
	};
}

function normalizePatchPayload(payload: ExpeditionPatchPayload): ExpeditionPatchPayload {
	if (payload.duration === undefined) {
		return payload;
	}

	const normalizedDuration = normalizeDurationHHMMSS(payload.duration);
	if (!normalizedDuration) {
		throw new Error('Invalid duration format. Use HH:mm:ss or HH:mm.');
	}

	return {
		...payload,
		duration: normalizedDuration,
	};
}

function assertPositiveInteger(name: string, value: number): void {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}
}

async function list(query?: ExpeditionListQuery): Promise<ApiListResponse<Expedition>> {
	const response = await httpClient.get<ApiListResponse<Expedition>>(EXPEDITIONS_ENDPOINT, {
		query,
	});

	return normalizeListResponse(response);
}

async function getById(expeditionId: number): Promise<ApiItemResponse<Expedition>> {
	assertPositiveInteger('expeditionId', expeditionId);
	const response = await httpClient.get<ApiItemResponse<Expedition>>(
		`${EXPEDITIONS_ENDPOINT}/${expeditionId}`,
	);

	return normalizeItemResponse(response);
}

async function create(
	payload: ExpeditionCreatePayload,
): Promise<ApiMutationResponse<Expedition>> {
	const normalizedPayload = normalizeCreatePayload(payload);
	const response = await httpClient.post<ApiMutationResponse<Expedition>, ExpeditionCreatePayload>(
		EXPEDITIONS_ENDPOINT,
		normalizedPayload,
	);

	return normalizeMutationResponse(response);
}

async function replace(
	expeditionId: number,
	payload: ExpeditionPutPayload,
): Promise<ApiMutationResponse<Expedition>> {
	assertPositiveInteger('expeditionId', expeditionId);
	const normalizedPayload = normalizePutPayload(payload);
	const response = await httpClient.put<ApiMutationResponse<Expedition>, ExpeditionPutPayload>(
		`${EXPEDITIONS_ENDPOINT}/${expeditionId}`,
		normalizedPayload,
	);

	return normalizeMutationResponse(response);
}

async function update(
	expeditionId: number,
	payload: ExpeditionPatchPayload,
): Promise<ApiMutationResponse<Expedition>> {
	assertPositiveInteger('expeditionId', expeditionId);
	const normalizedPayload = normalizePatchPayload(payload);
	const response = await httpClient.patch<ApiMutationResponse<Expedition>, ExpeditionPatchPayload>(
		`${EXPEDITIONS_ENDPOINT}/${expeditionId}`,
		normalizedPayload,
	);

	return normalizeMutationResponse(response);
}

async function remove(expeditionId: number): Promise<ApiDeleteResponse> {
	assertPositiveInteger('expeditionId', expeditionId);
	return httpClient.delete<ApiDeleteResponse>(`${EXPEDITIONS_ENDPOINT}/${expeditionId}`);
}

export const expeditionsService = {
	list,
	getById,
	create,
	replace,
	update,
	remove,
};
