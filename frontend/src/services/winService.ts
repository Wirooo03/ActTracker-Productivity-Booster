import { httpClient } from '@/lib/api/httpClient';
import type {
	ApiItemResponse,
	ApiListResponse,
	MilestoneCellState,
	WinMilestoneMatrixData,
	WinMilestoneMatrixCell,
	WinPointsSeriesMeta,
	WinPointsSeriesPoint,
	WinPointsSeriesQuery,
} from '@/lib/api/types';

const WIN_POINTS_SERIES_ENDPOINT = '/api/win/points-series';
const WIN_MILESTONE_MATRIX_ENDPOINT = '/api/win/milestone-matrix';

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

function normalizeDateKey(rawDate: string): string {
	const matched = rawDate.match(/^\d{4}-\d{2}-\d{2}/);
	if (matched) {
		return matched[0];
	}

	const parsed = new Date(rawDate);
	if (Number.isNaN(parsed.getTime())) {
		return rawDate;
	}

	const year = parsed.getFullYear();
	const month = String(parsed.getMonth() + 1).padStart(2, '0');
	const day = String(parsed.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function normalizeSeriesPoint(item: WinPointsSeriesPoint): WinPointsSeriesPoint {
	return {
		date: normalizeDateKey(item.date),
		total_point: Number.isFinite(item.total_point) ? item.total_point : 0,
	};
}

function normalizeSeriesResponse(
	response: ApiListResponse<WinPointsSeriesPoint, WinPointsSeriesMeta>,
): ApiListResponse<WinPointsSeriesPoint, WinPointsSeriesMeta> {
	return {
		...response,
		data: response.data.map(normalizeSeriesPoint),
	};
}

function normalizeMilestoneState(state: string): MilestoneCellState {
	if (
		state === 'missing' ||
		state === 'check' ||
		state === 'cross' ||
		state === 'mixed' ||
		state === 'value'
	) {
		return state;
	}

	return 'missing';
}

function normalizeMilestoneCell(item: WinMilestoneMatrixCell): WinMilestoneMatrixCell {
	return {
		...item,
		date: normalizeDateKey(item.date),
		state: normalizeMilestoneState(item.state),
		value: typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : null,
	};
}

function normalizeMilestoneResponse(
	response: ApiItemResponse<WinMilestoneMatrixData>,
): ApiItemResponse<WinMilestoneMatrixData> {
	return {
		...response,
		data: {
			...response.data,
			dates: response.data.dates.map(normalizeDateKey),
			cells: response.data.cells.map(normalizeMilestoneCell),
		},
	};
}

async function getPointsSeries(
	query: WinPointsSeriesQuery,
): Promise<ApiListResponse<WinPointsSeriesPoint, WinPointsSeriesMeta>> {
	const response = await httpClient.get<ApiListResponse<WinPointsSeriesPoint, WinPointsSeriesMeta>>(
		WIN_POINTS_SERIES_ENDPOINT,
		{
			query,
		},
	);

	return normalizeSeriesResponse(response);
}

async function getMilestoneMatrix(
	year: number,
	month: number,
): Promise<ApiItemResponse<WinMilestoneMatrixData>> {
	assertPositiveInteger('year', year);
	assertMonth(month);

	const response = await httpClient.get<ApiItemResponse<WinMilestoneMatrixData>>(
		WIN_MILESTONE_MATRIX_ENDPOINT,
		{
			query: {
				year,
				month,
			},
		},
	);

	return normalizeMilestoneResponse(response);
}

export const winService = {
	getPointsSeries,
	getMilestoneMatrix,
};
