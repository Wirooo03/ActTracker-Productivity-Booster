import { httpClient } from '@/lib/api/httpClient';
import { normalizeDurationHHMMSS, normalizeTimeHHMMSS } from '@/lib/api/duration';
import type { ApiItemResponse, PlanBootstrapAction, PlanDayBootstrapData } from '@/lib/api/types';

const PLAN_DAY_ENDPOINT = '/api/plan/day';

function normalizePlanAction(item: PlanBootstrapAction): PlanBootstrapAction {
	const averageDuration = item.average_duration ?? item['durasi rata-rata'];
	const normalizedAverage =
		typeof averageDuration === 'string'
			? normalizeDurationHHMMSS(averageDuration)
			: null;

	return {
		...item,
		average_duration: normalizedAverage,
		'durasi rata-rata': normalizedAverage,
	};
}

function normalizePlanBootstrapResponse(
	response: ApiItemResponse<PlanDayBootstrapData>,
): ApiItemResponse<PlanDayBootstrapData> {
	return {
		...response,
		data: {
			...response.data,
			blocks: response.data.blocks.map((block) => ({
				...block,
				start_time: normalizeTimeHHMMSS(block.start_time) ?? block.start_time,
				duration: normalizeDurationHHMMSS(block.duration) ?? block.duration,
			})),
			actions: response.data.actions.map(normalizePlanAction),
		},
	};
}

async function getDayBootstrap(date: string): Promise<ApiItemResponse<PlanDayBootstrapData>> {
	const response = await httpClient.get<ApiItemResponse<PlanDayBootstrapData>>(
		`${PLAN_DAY_ENDPOINT}/${encodeURIComponent(date)}`,
	);

	return normalizePlanBootstrapResponse(response);
}

export const planService = {
	getDayBootstrap,
};
