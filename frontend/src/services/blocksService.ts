import { httpClient } from '@/lib/api/httpClient';
import { normalizeDurationHHMMSS, normalizeTimeHHMMSS } from '@/lib/api/duration';
import type {
	ApiDeleteResponse,
	ApiItemResponse,
	ApiListResponse,
	ApiMutationResponse,
	Block,
	BlockCreatePayload,
	BlockListQuery,
	BlockPatchPayload,
	BlockPutPayload,
} from '@/lib/api/types';

const BLOCKS_ENDPOINT = '/api/blocks';

function normalizeBlock(item: Block): Block {
	return {
		...item,
		start_time: normalizeTimeHHMMSS(item.start_time) ?? item.start_time,
		duration: normalizeDurationHHMMSS(item.duration) ?? item.duration,
	};
}

function normalizeListResponse(response: ApiListResponse<Block>): ApiListResponse<Block> {
	return {
		...response,
		data: response.data.map(normalizeBlock),
	};
}

function normalizeItemResponse(response: ApiItemResponse<Block>): ApiItemResponse<Block> {
	return {
		...response,
		data: normalizeBlock(response.data),
	};
}

function normalizeMutationResponse(
	response: ApiMutationResponse<Block>,
): ApiMutationResponse<Block> {
	return {
		...response,
		data: normalizeBlock(response.data),
	};
}

function normalizeCreatePayload(payload: BlockCreatePayload): BlockCreatePayload {
	const normalizedStartTime = normalizeTimeHHMMSS(payload.start_time);
	if (!normalizedStartTime) {
		throw new Error('Invalid start_time format. Use HH:mm:ss or HH:mm.');
	}

	const normalizedDuration = normalizeDurationHHMMSS(payload.duration);
	if (!normalizedDuration) {
		throw new Error('Invalid duration format. Use HH:mm:ss or HH:mm.');
	}

	return {
		...payload,
		start_time: normalizedStartTime,
		duration: normalizedDuration,
	};
}

function normalizePutPayload(payload: BlockPutPayload): BlockPutPayload {
	const normalizedStartTime = normalizeTimeHHMMSS(payload.start_time);
	if (!normalizedStartTime) {
		throw new Error('Invalid start_time format. Use HH:mm:ss or HH:mm.');
	}

	const normalizedDuration = normalizeDurationHHMMSS(payload.duration);
	if (!normalizedDuration) {
		throw new Error('Invalid duration format. Use HH:mm:ss or HH:mm.');
	}

	return {
		...payload,
		start_time: normalizedStartTime,
		duration: normalizedDuration,
	};
}

function normalizePatchPayload(payload: BlockPatchPayload): BlockPatchPayload {
	let normalizedStartTime: string | undefined = payload.start_time;
	if (payload.start_time !== undefined) {
		const parsedStartTime = normalizeTimeHHMMSS(payload.start_time);
		if (!parsedStartTime) {
			throw new Error('Invalid start_time format. Use HH:mm:ss or HH:mm.');
		}
		normalizedStartTime = parsedStartTime;
	}

	let normalizedDuration: string | undefined = payload.duration;
	if (payload.duration !== undefined) {
		const parsedDuration = normalizeDurationHHMMSS(payload.duration);
		if (!parsedDuration) {
			throw new Error('Invalid duration format. Use HH:mm:ss or HH:mm.');
		}
		normalizedDuration = parsedDuration;
	}

	return {
		...payload,
		...(normalizedStartTime !== undefined ? { start_time: normalizedStartTime } : {}),
		...(normalizedDuration !== undefined ? { duration: normalizedDuration } : {}),
	};
}

function assertPositiveInteger(name: string, value: number): void {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}
}

async function list(query?: BlockListQuery): Promise<ApiListResponse<Block>> {
	const response = await httpClient.get<ApiListResponse<Block>>(BLOCKS_ENDPOINT, { query });
	return normalizeListResponse(response);
}

async function listByDate(date: string): Promise<ApiListResponse<Block>> {
	return list({ date });
}

async function getById(blockId: number): Promise<ApiItemResponse<Block>> {
	assertPositiveInteger('blockId', blockId);
	const response = await httpClient.get<ApiItemResponse<Block>>(`${BLOCKS_ENDPOINT}/${blockId}`);
	return normalizeItemResponse(response);
}

async function create(payload: BlockCreatePayload): Promise<ApiMutationResponse<Block>> {
	const normalizedPayload = normalizeCreatePayload(payload);
	const response = await httpClient.post<ApiMutationResponse<Block>, BlockCreatePayload>(
		BLOCKS_ENDPOINT,
		normalizedPayload,
	);

	return normalizeMutationResponse(response);
}

async function replace(blockId: number, payload: BlockPutPayload): Promise<ApiMutationResponse<Block>> {
	assertPositiveInteger('blockId', blockId);
	const normalizedPayload = normalizePutPayload(payload);
	const response = await httpClient.put<ApiMutationResponse<Block>, BlockPutPayload>(
		`${BLOCKS_ENDPOINT}/${blockId}`,
		normalizedPayload,
	);

	return normalizeMutationResponse(response);
}

async function update(blockId: number, payload: BlockPatchPayload): Promise<ApiMutationResponse<Block>> {
	assertPositiveInteger('blockId', blockId);
	const normalizedPayload = normalizePatchPayload(payload);
	const response = await httpClient.patch<ApiMutationResponse<Block>, BlockPatchPayload>(
		`${BLOCKS_ENDPOINT}/${blockId}`,
		normalizedPayload,
	);

	return normalizeMutationResponse(response);
}

async function remove(blockId: number): Promise<ApiDeleteResponse> {
	assertPositiveInteger('blockId', blockId);
	return httpClient.delete<ApiDeleteResponse>(`${BLOCKS_ENDPOINT}/${blockId}`);
}

export const blocksService = {
	list,
	listByDate,
	getById,
	create,
	replace,
	update,
	remove,
};
