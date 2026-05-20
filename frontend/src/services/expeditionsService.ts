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
	ExpeditionMutationMeta,
	MutationRequestOptions,
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
	response: ApiMutationResponse<Expedition, ExpeditionMutationMeta>,
): ApiMutationResponse<Expedition, ExpeditionMutationMeta> {
	const snapshotExpeditions = response.meta?.snapshot?.expeditions;
	const normalizedMeta =
		Array.isArray(snapshotExpeditions)
			? {
				...response.meta,
				snapshot: {
					...response.meta?.snapshot,
					expeditions: snapshotExpeditions.map(normalizeExpedition),
				},
			}
			: response.meta;

	return {
		...response,
		data: normalizeExpedition(response.data),
		meta: normalizedMeta,
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

function resolveMutationQuery(options?: MutationRequestOptions): { include_snapshot?: boolean } | undefined {
	if (!options) {
		return undefined;
	}

	return options.includeSnapshot ? { include_snapshot: true } : undefined;
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
 	options?: MutationRequestOptions,
): Promise<ApiMutationResponse<Expedition, ExpeditionMutationMeta>> {
	const normalizedPayload = normalizeCreatePayload(payload);
	const response = await httpClient.post<
		ApiMutationResponse<Expedition, ExpeditionMutationMeta>,
		ExpeditionCreatePayload
	>(
		EXPEDITIONS_ENDPOINT,
		normalizedPayload,
		{
			query: resolveMutationQuery(options),
		},
	);

	return normalizeMutationResponse(response);
}

async function replace(
	expeditionId: number,
	payload: ExpeditionPutPayload,
 	options?: MutationRequestOptions,
): Promise<ApiMutationResponse<Expedition, ExpeditionMutationMeta>> {
	assertPositiveInteger('expeditionId', expeditionId);
	const normalizedPayload = normalizePutPayload(payload);
	const response = await httpClient.put<
		ApiMutationResponse<Expedition, ExpeditionMutationMeta>,
		ExpeditionPutPayload
	>(
		`${EXPEDITIONS_ENDPOINT}/${expeditionId}`,
		normalizedPayload,
		{
			query: resolveMutationQuery(options),
		},
	);

	return normalizeMutationResponse(response);
}

async function update(
	expeditionId: number,
	payload: ExpeditionPatchPayload,
 	options?: MutationRequestOptions,
): Promise<ApiMutationResponse<Expedition, ExpeditionMutationMeta>> {
	assertPositiveInteger('expeditionId', expeditionId);
	const normalizedPayload = normalizePatchPayload(payload);
	const response = await httpClient.patch<
		ApiMutationResponse<Expedition, ExpeditionMutationMeta>,
		ExpeditionPatchPayload
	>(
		`${EXPEDITIONS_ENDPOINT}/${expeditionId}`,
		normalizedPayload,
		{
			query: resolveMutationQuery(options),
		},
	);

	return normalizeMutationResponse(response);
}

async function remove(
	expeditionId: number,
	options?: MutationRequestOptions,
): Promise<ApiDeleteResponse<ExpeditionMutationMeta>> {
	assertPositiveInteger('expeditionId', expeditionId);
	return httpClient.delete<ApiDeleteResponse<ExpeditionMutationMeta>>(
		`${EXPEDITIONS_ENDPOINT}/${expeditionId}`,
		{
			query: resolveMutationQuery(options),
		},
	);
}

export const expeditionsService = {
	list,
	getById,
	create,
	replace,
	update,
	remove,
};
