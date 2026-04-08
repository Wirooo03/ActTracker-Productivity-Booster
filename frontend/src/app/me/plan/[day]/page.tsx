'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getFieldErrors } from '@/lib/api/apiError';
import {
	durationHHMMSSToSeconds,
	normalizeDurationHHMMSS,
	normalizeTimeHHMMSS,
	secondsToDurationHHMMSS,
	timeHHMMSSToSeconds,
} from '@/lib/api/duration';
import type { Action, Block, BlockCreatePayload } from '@/lib/api/types';
import { actionsService } from '@/services/actionsService';
import { blocksService } from '@/services/blocksService';

type DurationSource = 'custom' | 'action';

type BlockFormState = {
	activityName: string;
	startTime: string;
	durationSource: DurationSource;
	customDuration: string;
	actionId: string;
	prevId: string;
	nextId: string;
};

type Notice = {
	type: 'success' | 'error' | 'info';
	text: string;
};

type ParsedTimelineItem = {
	block: Block;
	startMinute: number | null;
	durationMinute: number | null;
	endMinute: number | null;
};

type TimelineItem = {
	block: Block;
	startMinute: number;
	durationMinute: number;
	endMinute: number;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const BASE_HOUR_UNIT_WIDTH = 120;
const MIN_BLOCK_WIDTH = 12;
const BLOCK_HEIGHT = 86;
const BLOCK_VERTICAL_GAP = 18;
const CANVAS_PADDING_X = 24;
const CANVAS_PADDING_Y = 18;
const MORNING_START_MINUTE = 0;
const NIGHT_END_MINUTE = 24 * 60;
const FALLBACK_TIMELINE_WIDTH = 960;
const MIN_TIMELINE_ZOOM = 1;
const MAX_TIMELINE_ZOOM = 10;
const TIMELINE_ZOOM_STEP = 0.5;
const COMPACT_DETAIL_MIN_WIDTH = 96;
const FULL_DETAIL_MIN_WIDTH = 150;

const dayTitleFormatter = new Intl.DateTimeFormat('id-ID', {
	weekday: 'long',
	day: '2-digit',
	month: 'long',
	year: 'numeric',
});

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return 'Terjadi kesalahan yang tidak terduga.';
}

function parseDateKey(value: string): Date | null {
	if (!DATE_KEY_PATTERN.test(value)) {
		return null;
	}

	const [yearText, monthText, dayText] = value.split('-');
	const year = Number(yearText);
	const month = Number(monthText) - 1;
	const day = Number(dayText);

	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
		return null;
	}

	const parsed = new Date(year, month, day);
	if (parsed.getFullYear() !== year || parsed.getMonth() !== month || parsed.getDate() !== day) {
		return null;
	}

	return parsed;
}

function dateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): Date {
	const nextDate = new Date(date);
	nextDate.setDate(nextDate.getDate() + amount);
	return new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
}

function shiftDateKey(value: string, amount: number): string {
	const parsed = parseDateKey(value);
	if (!parsed) {
		return value;
	}

	return dateKey(addDays(parsed, amount));
}

function parseClockMinutes(raw: string): number | null {
	const totalSeconds = timeHHMMSSToSeconds(raw);
	if (totalSeconds === null) {
		return null;
	}

	return Math.floor(totalSeconds / 60);
}

function formatClock(minutes: number): string {
	const hour = Math.floor(minutes / 60);
	const minute = minutes % 60;
	return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatClockWithSeconds(date: Date): string {
	const hour = String(date.getHours()).padStart(2, '0');
	const minute = String(date.getMinutes()).padStart(2, '0');
	const second = String(date.getSeconds()).padStart(2, '0');
	return `${hour}:${minute}:${second}`;
}

function normalizeClock(raw: string): string {
	return normalizeTimeHHMMSS(raw) ?? '07:00:00';
}

function parseDurationMinutes(raw: string): number | null {
	const totalSeconds = durationHHMMSSToSeconds(raw);
	if (totalSeconds === null) {
		return null;
	}

	return Math.round(totalSeconds / 60);
}

function splitDayMinute(totalMinutes: number): { dayOffset: number; minuteOfDay: number } {
	const dayOffset = Math.floor(totalMinutes / 1440);
	const minuteOfDay = totalMinutes - dayOffset * 1440;
	return { dayOffset, minuteOfDay };
}

function minuteToDisplayLabel(totalMinutes: number): string {
	if (totalMinutes === 24 * 60) {
		return '24:00';
	}

	const { dayOffset, minuteOfDay } = splitDayMinute(totalMinutes);
	const hour = Math.floor(minuteOfDay / 60);
	const minute = minuteOfDay % 60;
	const base = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

	if (dayOffset === 0) {
		return base;
	}

	return `${base} (D${dayOffset >= 0 ? '+' : ''}${dayOffset})`;
}

function formatDuration(minutes: number): string {
	return secondsToDurationHHMMSS(Math.max(0, Math.round(minutes) * 60)) ?? '00:00:00';
}

function normalizeDuration(raw: string): string {
	return normalizeDurationHHMMSS(raw) ?? raw.trim();
}

function clampTimelineZoom(value: number): number {
	return Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, value));
}

function createInitialForm(defaultStartTime = '07:00:00'): BlockFormState {
	return {
		activityName: '',
		startTime: defaultStartTime,
		durationSource: 'custom',
		customDuration: '01:00:00',
		actionId: '',
		prevId: '',
		nextId: '',
	};
}

function getSuggestedStartTime(blocks: Block[]): string {
	if (blocks.length === 0) {
		return '07:00:00';
	}

	let latestEnd = 7 * 60;
	for (const block of blocks) {
		const start = parseClockMinutes(block.start_time);
		const duration = parseDurationMinutes(block.duration);

		if (start === null || duration === null) {
			continue;
		}

		latestEnd = Math.max(latestEnd, start + duration);
	}

	const clamped = Math.min(Math.max(latestEnd, 0), 23 * 60 + 59);
	return `${formatClock(clamped)}:00`;
}

function parseNullableBlockId(raw: string): { value: number | null; error?: string } {
	const trimmed = raw.trim();
	if (!trimmed) {
		return { value: null };
	}

	const parsed = Number(trimmed);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return { value: null, error: 'Relasi prev/next harus memilih block yang valid.' };
	}

	return { value: parsed };
}

function hasLinkedNeighbor(form: Pick<BlockFormState, 'prevId' | 'nextId'>): boolean {
	return form.prevId.trim().length > 0 || form.nextId.trim().length > 0;
}

function resolveDurationMinutesFromForm(
	form: Pick<BlockFormState, 'durationSource' | 'customDuration' | 'actionId'>,
	actionsById: Map<number, Action>,
): number | null {
	if (form.durationSource === 'custom') {
		return parseDurationMinutes(form.customDuration);
	}

	const actionId = Number(form.actionId);
	if (!Number.isInteger(actionId) || actionId <= 0) {
		return null;
	}

	const selectedAction = actionsById.get(actionId);
	if (!selectedAction || !selectedAction['durasi rata-rata']) {
		return null;
	}

	return parseDurationMinutes(selectedAction['durasi rata-rata']);
}

function getBlockTimeSpanMinutes(block: Block): { startMinute: number; endMinute: number } | null {
	const startMinute = parseClockMinutes(block.start_time);
	const durationMinute = parseDurationMinutes(block.duration);

	if (startMinute === null || durationMinute === null) {
		return null;
	}

	return {
		startMinute,
		endMinute: startMinute + durationMinute,
	};
}

function resolveStartMinute(options: {
	formStartTime: string;
	prevId: number | null;
	nextId: number | null;
	durationMinute: number;
	blocksById: Map<number, Block>;
}):
	| {
		startMinute: number;
	}
	| {
		error: string;
	} {
	const { formStartTime, prevId, nextId, durationMinute, blocksById } = options;

	let startFromPrev: number | null = null;
	if (prevId !== null) {
		const prevBlock = blocksById.get(prevId);
		if (!prevBlock) {
			return { error: 'Block prev tidak ditemukan.' };
		}

		const prevSpan = getBlockTimeSpanMinutes(prevBlock);
		if (!prevSpan) {
			return { error: 'Format waktu/durasi block prev tidak valid.' };
		}

		startFromPrev = prevSpan.endMinute;
	}

	let startFromNext: number | null = null;
	if (nextId !== null) {
		const nextBlock = blocksById.get(nextId);
		if (!nextBlock) {
			return { error: 'Block next tidak ditemukan.' };
		}

		const nextSpan = getBlockTimeSpanMinutes(nextBlock);
		if (!nextSpan) {
			return { error: 'Format waktu/durasi block next tidak valid.' };
		}

		startFromNext = nextSpan.startMinute - durationMinute;
	}

	let startMinute: number;

	if (startFromPrev !== null && startFromNext !== null) {
		if (startFromPrev !== startFromNext) {
			return {
				error:
					'Durasi tidak pas dengan relasi prev/next. Pastikan block tersusun rapat tanpa jeda.',
			};
		}

		startMinute = startFromPrev;
	} else if (startFromPrev !== null) {
		startMinute = startFromPrev;
	} else if (startFromNext !== null) {
		startMinute = startFromNext;
	} else {
		const manualStart = parseClockMinutes(formStartTime);
		if (manualStart === null) {
			return { error: 'Format waktu mulai tidak valid. Gunakan HH:mm:ss atau HH:mm.' };
		}

		startMinute = manualStart;
	}

	if (startMinute < 0 || startMinute > 23 * 60 + 59) {
		return {
			error:
				'Waktu mulai hasil perhitungan relasi keluar dari rentang hari (00:00:00 sampai 23:59:59).',
		};
	}

	return { startMinute };
}

function resolveDurationFromForm(
	form: BlockFormState,
	actionsById: Map<number, Action>,
): { duration: string; summary: string } | { error: string } {
	if (form.durationSource === 'action') {
		const actionId = Number(form.actionId);
		if (!Number.isInteger(actionId) || actionId <= 0) {
			return { error: 'Pilih action terlebih dulu untuk memakai durasi rata-rata.' };
		}

		const selectedAction = actionsById.get(actionId);
		if (!selectedAction) {
			return { error: 'Action yang dipilih tidak ditemukan.' };
		}

		const estimatedDuration = selectedAction['durasi rata-rata'];
		if (!estimatedDuration) {
			return {
				error: 'Action ini belum punya durasi rata-rata. Tambahkan di menu Action Duration.',
			};
		}

		const estimatedMinutes = parseDurationMinutes(estimatedDuration);
		if (estimatedMinutes === null) {
			return { error: 'Format durasi rata-rata action tidak valid.' };
		}

		const normalized = formatDuration(estimatedMinutes);
		return {
			duration: normalized,
			summary: `${selectedAction.action_name} (${normalized})`,
		};
	}

	const customMinutes = parseDurationMinutes(form.customDuration);
	if (customMinutes === null) {
		return {
			error: 'Durasi custom tidak valid. Gunakan format HH:mm:ss atau HH:mm.',
		};
	}

	const normalized = formatDuration(customMinutes);
	return {
		duration: normalized,
		summary: normalized,
	};
}

function buildBlockPayload(options: {
	form: BlockFormState;
	date: string;
	actionsById: Map<number, Action>;
	blocksById: Map<number, Block>;
	editingBlockId?: number;
}):
	| {
		payload: BlockCreatePayload;
		durationSummary: string;
	}
	| {
		error: string;
	} {
	const { form, date, actionsById, blocksById, editingBlockId } = options;

	const activityName = form.activityName.trim();
	if (!activityName) {
		return { error: 'Nama aktivitas wajib diisi.' };
	}

	const durationResult = resolveDurationFromForm(form, actionsById);
	if ('error' in durationResult) {
		return durationResult;
	}

	const durationMinute = parseDurationMinutes(durationResult.duration);
	if (durationMinute === null) {
		return { error: 'Durasi tidak valid untuk perhitungan waktu.' };
	}

	const prevResult = parseNullableBlockId(form.prevId);
	if (prevResult.error) {
		return { error: prevResult.error };
	}

	const nextResult = parseNullableBlockId(form.nextId);
	if (nextResult.error) {
		return { error: nextResult.error };
	}

	if (prevResult.value !== null && prevResult.value === nextResult.value) {
		return { error: 'Prev dan next tidak boleh menunjuk block yang sama.' };
	}

	if (
		typeof editingBlockId === 'number' &&
		(prevResult.value === editingBlockId || nextResult.value === editingBlockId)
	) {
		return { error: 'Block tidak boleh mereferensikan dirinya sendiri sebagai prev/next.' };
	}

	const startMinuteResult = resolveStartMinute({
		formStartTime: form.startTime,
		prevId: prevResult.value,
		nextId: nextResult.value,
		durationMinute,
		blocksById,
	});

	if ('error' in startMinuteResult) {
		return startMinuteResult;
	}

	const normalizedStartTime = normalizeTimeHHMMSS(`${formatClock(startMinuteResult.startMinute)}:00`);
	if (!normalizedStartTime) {
		return { error: 'Format waktu mulai tidak valid. Gunakan HH:mm:ss atau HH:mm.' };
	}

	return {
		payload: {
			activity_name: activityName,
			start_time: normalizedStartTime,
			duration: durationResult.duration,
			prev: prevResult.value,
			next: nextResult.value,
			date,
		},
		durationSummary: durationResult.summary,
	};
}

function blockOptionLabel(block: Block): string {
	const time = normalizeClock(block.start_time);
	return `${block.block_id} | ${time} | ${block.activity_name}`;
}

function isTimelineItemValid(item: ParsedTimelineItem): item is TimelineItem {
	return (
		item.startMinute !== null &&
		item.durationMinute !== null &&
		item.endMinute !== null
	);
}

export default function PlanDayPage() {
	const params = useParams<{ day: string | string[] }>();
	const router = useRouter();

	const rawDayParam = Array.isArray(params?.day) ? params.day[0] : params?.day;
	const dayKey = typeof rawDayParam === 'string' ? rawDayParam : '';
	const parsedDayDate = parseDateKey(dayKey);
	const isDayValid = Boolean(parsedDayDate);

	const [blocks, setBlocks] = useState<Block[]>([]);
	const [actions, setActions] = useState<Action[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [notice, setNotice] = useState<Notice | null>(null);

	const [isCreating, setIsCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);
	const [createForm, setCreateForm] = useState<BlockFormState>(() => createInitialForm());

	const [editingBlockId, setEditingBlockId] = useState<number | null>(null);
	const [editForm, setEditForm] = useState<BlockFormState | null>(null);
	const [editError, setEditError] = useState<string | null>(null);
	const [isSavingBlockId, setIsSavingBlockId] = useState<number | null>(null);
	const [isDeletingBlockId, setIsDeletingBlockId] = useState<number | null>(null);
	const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
	const [timelineZoom, setTimelineZoom] = useState(1);
	const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
	const timelineViewportRef = useRef<HTMLDivElement | null>(null);
	const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
	const pendingZoomAnchorMinuteRef = useRef<number | null>(null);

	const actionsById = useMemo(() => {
		return new Map(actions.map((action) => [action.action_id, action]));
	}, [actions]);

	const blocksById = useMemo(() => {
		return new Map(blocks.map((block) => [block.block_id, block]));
	}, [blocks]);

	const isCreateStartTimeLocked = hasLinkedNeighbor(createForm);
	const isEditStartTimeLocked = editForm ? hasLinkedNeighbor(editForm) : false;

	const sortedBlocks = useMemo(() => {
		return [...blocks].sort((left, right) => {
			const leftMinute = parseClockMinutes(left.start_time);
			const rightMinute = parseClockMinutes(right.start_time);

			if (leftMinute === null && rightMinute === null) {
				return left.block_id - right.block_id;
			}

			if (leftMinute === null) {
				return 1;
			}

			if (rightMinute === null) {
				return -1;
			}

			if (leftMinute === rightMinute) {
				return left.block_id - right.block_id;
			}

			return leftMinute - rightMinute;
		});
	}, [blocks]);

	const previousDayKey = useMemo(() => shiftDateKey(dayKey, -1), [dayKey]);
	const nextDayKey = useMemo(() => shiftDateKey(dayKey, 1), [dayKey]);

	const selectedCreateAction = useMemo(() => {
		const actionId = Number(createForm.actionId);
		if (!Number.isInteger(actionId) || actionId <= 0) {
			return null;
		}

		return actionsById.get(actionId) ?? null;
	}, [actionsById, createForm.actionId]);

	const selectedEditAction = useMemo(() => {
		if (!editForm) {
			return null;
		}

		const actionId = Number(editForm.actionId);
		if (!Number.isInteger(actionId) || actionId <= 0) {
			return null;
		}

		return actionsById.get(actionId) ?? null;
	}, [actionsById, editForm]);

	const parsedTimelineItems = useMemo(() => {
		return sortedBlocks.map((block) => {
			const startMinute = parseClockMinutes(block.start_time);
			const durationMinute = parseDurationMinutes(block.duration);
			return {
				block,
				startMinute,
				durationMinute,
				endMinute:
					startMinute !== null && durationMinute !== null
						? startMinute + durationMinute
						: null,
			} as ParsedTimelineItem;
		});
	}, [sortedBlocks]);

	const timelineLayout = useMemo(() => {
		const validItems = parsedTimelineItems.filter(isTimelineItemValid);
		const invalidItems = parsedTimelineItems.filter((item) => !isTimelineItemValid(item));
		const availableWidth = Math.max(340, timelineViewportWidth || FALLBACK_TIMELINE_WIDTH);
		const hourUnitWidth = BASE_HOUR_UNIT_WIDTH * timelineZoom;

		if (validItems.length === 0) {
			return {
				hasValid: false,
				items: [] as TimelineItem[],
				invalidItems,
				positionedMap: new Map<
					number,
					{ item: TimelineItem; x: number; y: number; width: number; lane: number }
				>(),
				hourMarks: [] as number[],
				width: availableWidth,
				height: 180,
				minStartMinute: MORNING_START_MINUTE,
				maxEndMinute: NIGHT_END_MINUTE,
				pixelsPerMinute: 1,
			};
		}

		const sortedValid = [...validItems].sort((left, right) => {
			if (left.startMinute === right.startMinute) {
				return left.block.block_id - right.block.block_id;
			}

			return left.startMinute - right.startMinute;
		});

		const laneIntervals: Array<Array<{ start: number; end: number }>> = [];
		const laneByBlockId = new Map<number, number>();

		for (const item of sortedValid) {
			let preferredLane = 0;
			if (item.block.prev !== null) {
				const prevLane = laneByBlockId.get(item.block.prev);
				if (typeof prevLane === 'number') {
					preferredLane = prevLane;
				}
			}

			let lane = preferredLane;
			while (true) {
				const intervals = laneIntervals[lane] ?? [];
				const overlap = intervals.some(
					(interval) =>
						!(item.endMinute <= interval.start || item.startMinute >= interval.end),
				);

				if (!overlap) {
					break;
				}

				lane += 1;
			}

			if (!laneIntervals[lane]) {
				laneIntervals[lane] = [];
			}

			laneIntervals[lane].push({
				start: item.startMinute,
				end: item.endMinute,
			});

			laneByBlockId.set(item.block.block_id, lane);
		}

		const minStartMinute = Math.min(
			MORNING_START_MINUTE,
			...validItems.map((item) => item.startMinute),
		);
		const maxEndMinute = Math.max(
			NIGHT_END_MINUTE,
			...validItems.map((item) => item.endMinute),
		);

		const minuteSpan = Math.max(60, maxEndMinute - minStartMinute);
		const naturalWidth = Math.max(
			FALLBACK_TIMELINE_WIDTH,
			CANVAS_PADDING_X * 2 + (minuteSpan / 60) * hourUnitWidth,
		);
		const width = Math.max(availableWidth, naturalWidth);
		const drawableWidth = Math.max(180, width - CANVAS_PADDING_X * 2);
		const pixelsPerMinute = drawableWidth / minuteSpan;
		const contentRight = CANVAS_PADDING_X + drawableWidth;

		const positionedMap = new Map<
			number,
			{ item: TimelineItem; x: number; y: number; width: number; lane: number }
		>();

		for (const item of validItems) {
			const lane = laneByBlockId.get(item.block.block_id) ?? 0;
			const x =
				CANVAS_PADDING_X +
				(item.startMinute - minStartMinute) * pixelsPerMinute;

			const proportionalWidth = item.durationMinute * pixelsPerMinute;
			const maxAllowedWidth = Math.max(24, contentRight - x);
			const width = Math.min(maxAllowedWidth, Math.max(MIN_BLOCK_WIDTH, proportionalWidth));
			const y = CANVAS_PADDING_Y + lane * (BLOCK_HEIGHT + BLOCK_VERTICAL_GAP);

			positionedMap.set(item.block.block_id, {
				item,
				x,
				y,
				width,
				lane,
			});
		}

		const laneCount = Math.max(1, laneIntervals.length);
		const height =
			CANVAS_PADDING_Y * 2 + laneCount * (BLOCK_HEIGHT + BLOCK_VERTICAL_GAP) - BLOCK_VERTICAL_GAP;

		const firstHour = Math.floor(minStartMinute / 60);
		const lastHour = Math.ceil(maxEndMinute / 60);
		const hourMarks: number[] = [];
		for (let hour = firstHour; hour <= lastHour; hour += 1) {
			hourMarks.push(hour);
		}

		return {
			hasValid: true,
			items: validItems,
			invalidItems,
			positionedMap,
			hourMarks,
			width,
			height,
			minStartMinute,
			maxEndMinute,
			pixelsPerMinute,
		};
	}, [parsedTimelineItems, timelineViewportWidth, timelineZoom]);

	const captureTimelineCenterMinute = useCallback((): number | null => {
		const viewport = timelineViewportRef.current;
		const canvas = timelineCanvasRef.current;

		if (!viewport || !canvas || !timelineLayout.hasValid) {
			return null;
		}

		const centerXOnCanvas =
			viewport.scrollLeft + viewport.clientWidth / 2 - canvas.offsetLeft;
		const centerMinute =
			timelineLayout.minStartMinute +
			(centerXOnCanvas - CANVAS_PADDING_X) / timelineLayout.pixelsPerMinute;

		return Math.min(
			Math.max(centerMinute, timelineLayout.minStartMinute),
			timelineLayout.maxEndMinute,
		);
	}, [timelineLayout]);

	const updateTimelineZoom = useCallback(
		(nextZoom: number): void => {
			const clampedZoom = clampTimelineZoom(nextZoom);
			if (clampedZoom === timelineZoom) {
				return;
			}

			pendingZoomAnchorMinuteRef.current = captureTimelineCenterMinute();
			setTimelineZoom(clampedZoom);
		},
		[captureTimelineCenterMinute, timelineZoom],
	);

	const edgePaths = useMemo(() => {
		const paths: Array<{ key: string; d: string }> = [];

		for (const item of timelineLayout.items) {
			if (item.block.next === null) {
				continue;
			}

			const source = timelineLayout.positionedMap.get(item.block.block_id);
			const target = timelineLayout.positionedMap.get(item.block.next);

			if (!source || !target) {
				continue;
			}

			const sourceX = source.x + source.width;
			const sourceY = source.y + BLOCK_HEIGHT / 2;
			const targetX = target.x;
			const targetY = target.y + BLOCK_HEIGHT / 2;

			const bend = Math.max(28, Math.abs(targetX - sourceX) / 2);
			const d = `M ${sourceX} ${sourceY} C ${sourceX + bend} ${sourceY}, ${targetX - bend} ${targetY}, ${targetX} ${targetY}`;

			paths.push({
				key: `${item.block.block_id}-${item.block.next}`,
				d,
			});
		}

		return paths;
	}, [timelineLayout.items, timelineLayout.positionedMap]);

	const nowIndicator = useMemo(() => {
		if (!timelineLayout.hasValid) {
			return null;
		}

		const now = new Date(nowTimestamp);
		if (dayKey !== dateKey(now)) {
			return null;
		}

		const currentMinute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
		const clampedMinute = Math.min(
			Math.max(currentMinute, timelineLayout.minStartMinute),
			timelineLayout.maxEndMinute,
		);

		const x =
			CANVAS_PADDING_X +
			(clampedMinute - timelineLayout.minStartMinute) * timelineLayout.pixelsPerMinute;

		return {
			x,
			label: formatClockWithSeconds(now),
			outsideRange:
				currentMinute < timelineLayout.minStartMinute || currentMinute > timelineLayout.maxEndMinute,
		};
	}, [dayKey, nowTimestamp, timelineLayout]);

	const loadData = useCallback(async (): Promise<void> => {
		if (!isDayValid) {
			setIsLoading(false);
			setLoadError('Format tanggal tidak valid.');
			setBlocks([]);
			setActions([]);
			return;
		}

		setIsLoading(true);
		setLoadError(null);

		try {
			const [blocksResponse, actionsResponse] = await Promise.all([
				blocksService.listByDate(dayKey),
				actionsService.list(),
			]);

			setBlocks(blocksResponse.data);
			setActions(actionsResponse.data);
		} catch (error) {
			setLoadError(getErrorMessage(error));
			setBlocks([]);
			setActions([]);
		} finally {
			setIsLoading(false);
		}
	}, [dayKey, isDayValid]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	useEffect(() => {
		const element = timelineViewportRef.current;
		if (!element) {
			return;
		}

		const horizontalPadding = 16;

		const updateWidth = (): void => {
			setTimelineViewportWidth(Math.max(320, element.clientWidth - horizontalPadding));
		};

		updateWidth();

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setTimelineViewportWidth(
					Math.max(320, Math.round(entry.contentRect.width) - horizontalPadding),
				);
			}
		});

		observer.observe(element);

		return () => {
			observer.disconnect();
		};
	}, []);

	useEffect(() => {
		const timer = window.setInterval(() => {
			setNowTimestamp(Date.now());
		}, 1000);

		return () => {
			window.clearInterval(timer);
		};
	}, []);

	useLayoutEffect(() => {
		const anchorMinute = pendingZoomAnchorMinuteRef.current;
		if (anchorMinute === null) {
			return;
		}

		const viewport = timelineViewportRef.current;
		const canvas = timelineCanvasRef.current;

		if (!viewport || !canvas || !timelineLayout.hasValid) {
			pendingZoomAnchorMinuteRef.current = null;
			return;
		}

		const anchorX =
			CANVAS_PADDING_X +
			(anchorMinute - timelineLayout.minStartMinute) * timelineLayout.pixelsPerMinute;
		const targetScrollLeft = canvas.offsetLeft + anchorX - viewport.clientWidth / 2;
		const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);

		viewport.scrollLeft = Math.min(Math.max(0, targetScrollLeft), maxScrollLeft);
		pendingZoomAnchorMinuteRef.current = null;
	}, [timelineLayout]);

	useEffect(() => {
		if (!isDayValid) {
			setCreateForm(createInitialForm());
			return;
		}

		setCreateForm(createInitialForm(getSuggestedStartTime(blocks)));
	}, [blocks, isDayValid]);

	useEffect(() => {
		if (!isDayValid || !hasLinkedNeighbor(createForm)) {
			return;
		}

		const durationMinute = resolveDurationMinutesFromForm(createForm, actionsById);
		if (durationMinute === null) {
			return;
		}

		const prevResult = parseNullableBlockId(createForm.prevId);
		const nextResult = parseNullableBlockId(createForm.nextId);
		if (prevResult.error || nextResult.error) {
			return;
		}

		const startMinuteResult = resolveStartMinute({
			formStartTime: createForm.startTime,
			prevId: prevResult.value,
			nextId: nextResult.value,
			durationMinute,
			blocksById,
		});

		if ('error' in startMinuteResult) {
			return;
		}

		const computedStart = `${formatClock(startMinuteResult.startMinute)}:00`;
		if (computedStart === createForm.startTime) {
			return;
		}

		setCreateForm((current) =>
			current.startTime === computedStart
				? current
				: {
					...current,
					startTime: computedStart,
				},
		);
	}, [isDayValid, createForm, actionsById, blocksById]);

	useEffect(() => {
		if (!editForm || !hasLinkedNeighbor(editForm)) {
			return;
		}

		const durationMinute = resolveDurationMinutesFromForm(editForm, actionsById);
		if (durationMinute === null) {
			return;
		}

		const prevResult = parseNullableBlockId(editForm.prevId);
		const nextResult = parseNullableBlockId(editForm.nextId);
		if (prevResult.error || nextResult.error) {
			return;
		}

		const startMinuteResult = resolveStartMinute({
			formStartTime: editForm.startTime,
			prevId: prevResult.value,
			nextId: nextResult.value,
			durationMinute,
			blocksById,
		});

		if ('error' in startMinuteResult) {
			return;
		}

		const computedStart = `${formatClock(startMinuteResult.startMinute)}:00`;

		setEditForm((current) => {
			if (!current || current.startTime === computedStart) {
				return current;
			}

			return {
				...current,
				startTime: computedStart,
			};
		});
	}, [editForm, actionsById, blocksById]);

	function startEditing(block: Block): void {
		setEditingBlockId(block.block_id);
		setEditForm({
			activityName: block.activity_name,
			startTime: normalizeClock(block.start_time),
			durationSource: 'custom',
			customDuration: normalizeDuration(block.duration),
			actionId: '',
			prevId: block.prev !== null ? String(block.prev) : '',
			nextId: block.next !== null ? String(block.next) : '',
		});
		setEditError(null);
		setNotice(null);
	}

	function cancelEditing(): void {
		setEditingBlockId(null);
		setEditForm(null);
		setEditError(null);
	}

	async function handleCreateBlock(): Promise<void> {
		if (!isDayValid) {
			setCreateError('Tanggal tidak valid.');
			return;
		}

		setCreateError(null);
		setNotice(null);

		const payloadResult = buildBlockPayload({
			form: createForm,
			date: dayKey,
			actionsById,
			blocksById,
		});

		if ('error' in payloadResult) {
			setCreateError(payloadResult.error);
			return;
		}

		setIsCreating(true);

		try {
			const response = await blocksService.create(payloadResult.payload);
			setNotice({
				type: 'success',
				text: `${response.message} Durasi: ${payloadResult.durationSummary}.`,
			});
			setCreateForm(createInitialForm(createForm.startTime));
			await loadData();
		} catch (error) {
			if (error instanceof ApiError && error.status === 422) {
				const firstFieldError =
					getFieldErrors(error, 'activity_name')[0] ??
					getFieldErrors(error, 'start_time')[0] ??
					getFieldErrors(error, 'duration')[0] ??
					getFieldErrors(error, 'prev')[0] ??
					getFieldErrors(error, 'next')[0] ??
					getFieldErrors(error, 'date')[0];

				setCreateError(firstFieldError ?? error.message);
				return;
			}

			setCreateError(getErrorMessage(error));
		} finally {
			setIsCreating(false);
		}
	}

	async function handleUpdateBlock(blockId: number): Promise<void> {
		if (!editForm || !isDayValid) {
			return;
		}

		setEditError(null);
		setNotice(null);

		const payloadResult = buildBlockPayload({
			form: editForm,
			date: dayKey,
			actionsById,
			blocksById,
			editingBlockId: blockId,
		});

		if ('error' in payloadResult) {
			setEditError(payloadResult.error);
			return;
		}

		setIsSavingBlockId(blockId);

		try {
			const response = await blocksService.update(blockId, payloadResult.payload);
			setNotice({
				type: 'success',
				text: `${response.message} Durasi: ${payloadResult.durationSummary}.`,
			});
			cancelEditing();
			await loadData();
		} catch (error) {
			if (error instanceof ApiError && error.status === 422) {
				const firstFieldError =
					getFieldErrors(error, 'activity_name')[0] ??
					getFieldErrors(error, 'start_time')[0] ??
					getFieldErrors(error, 'duration')[0] ??
					getFieldErrors(error, 'prev')[0] ??
					getFieldErrors(error, 'next')[0] ??
					getFieldErrors(error, 'date')[0];

				setEditError(firstFieldError ?? error.message);
				return;
			}

			setEditError(getErrorMessage(error));
		} finally {
			setIsSavingBlockId(null);
		}
	}

	async function handleDeleteBlock(blockId: number): Promise<void> {
		if (!window.confirm('Hapus block ini?')) {
			return;
		}

		setIsDeletingBlockId(blockId);
		setNotice(null);

		try {
			const response = await blocksService.remove(blockId);
			if (editingBlockId === blockId) {
				cancelEditing();
			}
			setNotice({ type: 'info', text: response.message });
			await loadData();
		} catch (error) {
			setNotice({ type: 'error', text: getErrorMessage(error) });
		} finally {
			setIsDeletingBlockId(null);
		}
	}

	if (!isDayValid || !parsedDayDate) {
		return (
			<main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937_0%,_#0a0a0a_45%,_#050505_100%)] px-2.5 py-3 text-zinc-100 sm:px-6 sm:py-6">
				<section className="mx-auto w-full max-w-3xl rounded-3xl border border-rose-700/60 bg-zinc-900/80 p-4 [font-family:var(--font-geist-sans)] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur">
					<h1 className="text-lg font-semibold text-rose-200 sm:text-2xl">Tanggal tidak valid</h1>
					<p className="mt-2 text-sm text-zinc-300">
						Gunakan format URL /me/plan/YYYY-MM-DD, contoh /me/plan/2026-01-24.
					</p>
					<Link
						href="/me/plan"
						className="mt-4 inline-flex rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
					>
						Kembali ke kalender
					</Link>
				</section>
			</main>
		);
	}

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937_0%,_#0b0b0b_42%,_#040404_100%)] px-2.5 py-3 text-zinc-100 sm:px-6 sm:py-6">
			<section className="mx-auto flex w-full max-w-6xl flex-col gap-3 [font-family:var(--font-geist-sans)] sm:gap-4">
				<header className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="flex min-w-0 items-start gap-3">
							<Link
								href="/me/plan"
								className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-lg leading-none text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
								aria-label="Kembali"
								title="Kembali"
							>
								&lt;
							</Link>

							<div className="min-w-0 space-y-1">
								<h1 className="truncate text-xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
									Plan Day - {dayTitleFormatter.format(parsedDayDate)}
								</h1>
								<p className="max-w-3xl text-xs text-zinc-300 sm:text-sm">
									Semua block dibaca dan disimpan langsung lewat endpoint backend. Gunakan
									prev/next untuk membentuk chain.
								</p>
							</div>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={() => router.push(`/me/plan/${previousDayKey}`)}
								className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 sm:text-sm"
							>
								Prev Day
							</button>
							<button
								type="button"
								onClick={() => router.push(`/me/plan/${nextDayKey}`)}
								className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 sm:text-sm"
							>
								Next Day
							</button>
							<Link
								href="/me/plan/duration"
								className="rounded-xl border border-cyan-700/70 bg-cyan-900/35 px-3 py-2 text-center text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/45 sm:text-sm"
							>
								Action Duration
							</Link>
						</div>
					</div>

					<div className="mt-3 hidden flex-wrap items-center gap-2 text-xs text-zinc-400 sm:flex">
						<span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-3 py-1">
							Plan
						</span>
						<span>/</span>
						<span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-3 py-1">
							{dayKey}
						</span>
					</div>
				</header>

				<section className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-3 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
					<div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-3">
							<h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
								Tambah Block
							</h2>

							<div className="mt-2 grid gap-2 sm:grid-cols-2">
								<label className="text-xs text-zinc-400 sm:col-span-2">
									Nama aktivitas
									<input
										type="text"
										value={createForm.activityName}
										onChange={(event) =>
											setCreateForm((current) => ({
												...current,
												activityName: event.target.value,
											}))
										}
										placeholder="Contoh: Deep Work"
										className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
									/>
								</label>

								<label className="text-xs text-zinc-400">
									Waktu mulai
									<input
										type="time"
										step={1}
										disabled={isCreateStartTimeLocked}
										value={createForm.startTime}
										onChange={(event) =>
											setCreateForm((current) => ({
												...current,
												startTime: event.target.value,
											}))
										}
										className="mt-1 w-full max-w-[12rem] rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
									/>
									{isCreateStartTimeLocked ? (
										<p className="mt-1 text-[11px] text-zinc-500">
											Waktu mulai otomatis mengikuti relasi prev/next agar rapat tanpa jeda.
										</p>
									) : null}
								</label>

								<div className="text-xs text-zinc-400">
									Durasi
									<div className="mt-1 grid gap-1.5">
										<label className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/70 px-2 py-1.5 text-xs text-zinc-200">
											<input
												type="radio"
												name="create-duration-source"
												checked={createForm.durationSource === 'custom'}
												onChange={() =>
													setCreateForm((current) => ({
														...current,
														durationSource: 'custom',
													}))
												}
											/>
											Custom
										</label>
										<label className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/70 px-2 py-1.5 text-xs text-zinc-200">
											<input
												type="radio"
												name="create-duration-source"
												checked={createForm.durationSource === 'action'}
												onChange={() =>
													setCreateForm((current) => ({
														...current,
														durationSource: 'action',
													}))
												}
											/>
											Dari action
										</label>
									</div>
								</div>

								{createForm.durationSource === 'custom' ? (
									<label className="text-xs text-zinc-400 sm:col-span-2">
										Durasi custom
										<input
											type="text"
											value={createForm.customDuration}
											onChange={(event) =>
												setCreateForm((current) => ({
													...current,
													customDuration: event.target.value,
												}))
											}
											placeholder="Contoh: 01:30:00 atau 01:30"
											className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
										/>
									</label>
								) : (
									<label className="text-xs text-zinc-400 sm:col-span-2">
										Pilih action (durasi rata-rata)
										<select
											value={createForm.actionId}
											onChange={(event) =>
												setCreateForm((current) => ({
													...current,
													actionId: event.target.value,
												}))
											}
											className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
										>
											<option value="">Pilih action...</option>
											{actions.map((action) => (
												<option key={action.action_id} value={action.action_id}>
													{action.action_name} ({action['durasi rata-rata'] ?? '-'})
												</option>
											))}
										</select>
										<p className="mt-1 text-[11px] text-zinc-500">
											Durasi terpilih:{' '}
											{selectedCreateAction?.['durasi rata-rata']
												? normalizeDuration(selectedCreateAction['durasi rata-rata'])
												: '-'}
										</p>
									</label>
								)}

								<label className="text-xs text-zinc-400">
									Prev
									<select
										value={createForm.prevId}
										onChange={(event) =>
											setCreateForm((current) => ({
												...current,
												prevId: event.target.value,
											}))
										}
										className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
									>
										<option value="">None</option>
										{sortedBlocks.map((block) => (
											<option key={`create-prev-${block.block_id}`} value={block.block_id}>
												{blockOptionLabel(block)}
											</option>
										))}
									</select>
								</label>

								<label className="text-xs text-zinc-400">
									Next
									<select
										value={createForm.nextId}
										onChange={(event) =>
											setCreateForm((current) => ({
												...current,
												nextId: event.target.value,
											}))
										}
										className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
									>
										<option value="">None</option>
										{sortedBlocks.map((block) => (
											<option key={`create-next-${block.block_id}`} value={block.block_id}>
												{blockOptionLabel(block)}
											</option>
										))}
									</select>
								</label>
							</div>

							<button
								type="button"
								onClick={() => {
									void handleCreateBlock();
								}}
								disabled={isCreating}
								className="mt-3 inline-flex rounded-xl border border-emerald-700/70 bg-emerald-900/35 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-800/45 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isCreating ? 'Menyimpan...' : 'Tambah Block'}
							</button>

							{createError ? (
								<p className="mt-2 rounded-xl border border-rose-700/70 bg-rose-900/30 px-3 py-2 text-sm text-rose-200">
									{createError}
								</p>
							) : null}
					</div>

					{loadError ? (
						<div className="mt-2.5 rounded-xl border border-rose-700/70 bg-rose-900/30 p-3 text-sm text-rose-200">
							<p>{loadError}</p>
							<button
								type="button"
								onClick={() => {
									void loadData();
								}}
								className="mt-2 rounded-lg border border-rose-700/70 px-3 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-800/45"
							>
								Coba Lagi
							</button>
						</div>
					) : null}

					{notice ? (
						<p
							className={`mt-2.5 rounded-xl border px-3 py-2 text-sm ${
								notice.type === 'success'
									? 'border-emerald-700/60 bg-emerald-900/30 text-emerald-200'
									: notice.type === 'error'
										? 'border-rose-700/60 bg-rose-900/30 text-rose-200'
										: 'border-cyan-700/60 bg-cyan-900/30 text-cyan-200'
							}`}
						>
							{notice.text}
						</p>
					) : null}
				</section>

				<section className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-3 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
							Timeline Preview
						</h2>
						<div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-300 sm:gap-2 sm:text-xs">
							<span className="rounded-md border border-zinc-700 bg-zinc-800/70 px-2 py-1 font-semibold text-zinc-200">
								Zoom {timelineZoom.toFixed(1)}x
							</span>
							<button
								type="button"
								onClick={() =>
									updateTimelineZoom(
										Number((timelineZoom - TIMELINE_ZOOM_STEP).toFixed(2)),
									)
								}
								disabled={timelineZoom <= MIN_TIMELINE_ZOOM}
								className="grid h-7 w-7 place-items-center rounded-md border border-zinc-700 bg-zinc-800/70 font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
							>
								-
							</button>
							<input
								type="range"
								min={MIN_TIMELINE_ZOOM}
								max={MAX_TIMELINE_ZOOM}
								step={TIMELINE_ZOOM_STEP}
								value={timelineZoom}
								onChange={(event) => {
									updateTimelineZoom(Number(event.target.value));
								}}
								className="h-2 w-24 cursor-pointer accent-cyan-400 sm:w-36"
								aria-label="Zoom timeline"
							/>
							<button
								type="button"
								onClick={() =>
									updateTimelineZoom(
										Number((timelineZoom + TIMELINE_ZOOM_STEP).toFixed(2)),
									)
								}
								disabled={timelineZoom >= MAX_TIMELINE_ZOOM}
								className="grid h-7 w-7 place-items-center rounded-md border border-zinc-700 bg-zinc-800/70 font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
							>
								+
							</button>
							<button
								type="button"
								onClick={() => {
									updateTimelineZoom(1);
								}}
								disabled={timelineZoom === 1}
								className="rounded-md border border-zinc-700 bg-zinc-800/70 px-2 py-1 font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
							>
								Reset
							</button>
						</div>
					</div>

					<div
						ref={timelineViewportRef}
						className="mt-2.5 max-w-full overflow-auto rounded-2xl border border-zinc-700/70 bg-zinc-950/60 p-2"
					>
						{isLoading ? (
							<div className="space-y-2">
								{Array.from({ length: 4 }, (_, index) => (
									<div
										key={`timeline-skeleton-${index}`}
										className="h-24 animate-pulse rounded-xl border border-zinc-700 bg-zinc-800/50"
									/>
								))}
							</div>
						) : !timelineLayout.hasValid && timelineLayout.invalidItems.length === 0 ? (
							<div className="flex h-40 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/60 text-sm text-zinc-400">
								Belum ada block untuk tanggal ini.
							</div>
						) : (
							<div className="space-y-2">
								{timelineLayout.invalidItems.length > 0 ? (
									<p className="rounded-lg border border-amber-700/60 bg-amber-900/25 px-3 py-2 text-xs text-amber-200">
										{timelineLayout.invalidItems.length} block tidak bisa diplot karena format
										waktu/durasi tidak valid.
									</p>
								) : null}

								{timelineLayout.hasValid ? (
									<div
										ref={timelineCanvasRef}
										className="relative"
										style={{
											width: `${timelineLayout.width}px`,
											height: `${timelineLayout.height + 32}px`,
										}}
									>
										{timelineLayout.hourMarks.map((hour) => {
											const absoluteMinute = hour * 60;
											const x =
												CANVAS_PADDING_X +
												(absoluteMinute - timelineLayout.minStartMinute) *
													timelineLayout.pixelsPerMinute;

											return (
												<div key={`hour-${hour}`} className="absolute top-0" style={{ left: x }}>
													<p className="-translate-x-1/2 text-[10px] font-semibold text-zinc-400">
														{minuteToDisplayLabel(absoluteMinute)}
													</p>
													<div
														className="mt-1 h-[1px] w-px bg-zinc-600"
														style={{ height: `${timelineLayout.height + 8}px` }}
													/>
												</div>
											);
										})}

										{nowIndicator ? (
											<div
												className="pointer-events-none absolute top-0 z-20"
												style={{ left: `${nowIndicator.x}px` }}
											>
												<p className="-translate-x-1/2 rounded-md border border-rose-400/70 bg-rose-500/85 px-1.5 py-0.5 text-[10px] font-semibold text-rose-50 shadow-[0_0_16px_rgba(244,63,94,0.55)]">
													Now {nowIndicator.label}
												</p>
												<div
													className={`ml-[-0.5px] mt-1 w-px ${
														nowIndicator.outsideRange
															? 'bg-rose-300/50'
															: 'bg-rose-400/90'
													}`}
													style={{ height: `${timelineLayout.height + 8}px` }}
												/>
											</div>
										) : null}

										<svg
											className="pointer-events-none absolute left-0 top-8"
											width={timelineLayout.width}
											height={timelineLayout.height}
										>
											<defs>
												<marker
													id="plan-edge-arrow"
													markerWidth="8"
													markerHeight="8"
													refX="7"
													refY="4"
													orient="auto"
												>
													<path d="M0,0 L8,4 L0,8 Z" fill="rgba(125,211,252,0.8)" />
												</marker>
											</defs>

											{edgePaths.map((edge) => (
												<path
													key={edge.key}
													d={edge.d}
													fill="none"
													stroke="rgba(125,211,252,0.8)"
													strokeWidth="1.5"
													markerEnd="url(#plan-edge-arrow)"
												/>
											))}
										</svg>

										{timelineLayout.items.map((item) => {
											const placed = timelineLayout.positionedMap.get(item.block.block_id);
											if (!placed) {
												return null;
											}

											const isEditing = editingBlockId === item.block.block_id;
											const startLabel = minuteToDisplayLabel(item.startMinute);
											const endLabel = minuteToDisplayLabel(item.endMinute);
											const showCompactDetail = placed.width >= COMPACT_DETAIL_MIN_WIDTH;
											const showFullDetail = placed.width >= FULL_DETAIL_MIN_WIDTH;

											return (
												<button
													key={`timeline-block-${item.block.block_id}`}
													type="button"
													onClick={() => startEditing(item.block)}
													title={`${item.block.activity_name} | ${startLabel} -> ${endLabel}`}
													className={`absolute overflow-hidden rounded-xl border p-1.5 text-left transition sm:p-2 ${
														isEditing
															? 'border-cyan-400 bg-cyan-900/35 shadow-[0_10px_25px_-15px_rgba(34,211,238,0.9)]'
															: 'border-zinc-700 bg-zinc-900/85 hover:border-zinc-500 hover:bg-zinc-800/85'
													}`}
													style={{
														left: `${placed.x}px`,
														top: `${placed.y + 32}px`,
														width: `${placed.width}px`,
														height: `${BLOCK_HEIGHT}px`,
													}}
												>
													{showCompactDetail ? (
														<>
															<p className="truncate text-[11px] font-semibold text-zinc-100 sm:text-sm">
																#{item.block.block_id} - {item.block.activity_name}
															</p>
															{showFullDetail ? (
																<>
																	<p className="mt-1 text-[11px] text-zinc-300">
																		Durasi: {normalizeDuration(item.block.duration)}
																	</p>
																	<div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400">
																		<span>{startLabel}</span>
																		<span>{endLabel}</span>
																	</div>
																	<p className="mt-1 text-[10px] text-zinc-500">
																		prev: {item.block.prev ?? '-'} | next: {item.block.next ?? '-'}
																	</p>
																</>
															) : (
																<p className="mt-1 truncate text-[10px] text-zinc-300">
																	{startLabel} - {endLabel}
																</p>
															)}
														</>
													) : (
														<p className="truncate text-[10px] font-semibold text-zinc-200">
															#{item.block.block_id}
														</p>
													)}
												</button>
											);
										})}
									</div>
								) : null}
							</div>
						)}
					</div>
				</section>

				{editingBlockId !== null && editForm ? (
					<section className="rounded-3xl border border-cyan-700/60 bg-cyan-950/25 p-3 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
								Edit Block #{editingBlockId}
							</h2>
							<button
								type="button"
								onClick={cancelEditing}
								className="rounded-lg border border-cyan-700/70 px-3 py-1 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-900/35"
							>
								Tutup
							</button>
						</div>

						<div className="mt-2 grid gap-2 sm:grid-cols-2">
							<label className="text-xs text-cyan-100 sm:col-span-2">
								Nama aktivitas
								<input
									type="text"
									value={editForm.activityName}
									onChange={(event) =>
										setEditForm((current) =>
											current
												? {
													...current,
													activityName: event.target.value,
												}
												: current,
										)
									}
									className="mt-1 w-full rounded-xl border border-cyan-700/70 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
								/>
							</label>

							<label className="text-xs text-cyan-100">
								Waktu mulai
								<input
									type="time"
									step={1}
									disabled={isEditStartTimeLocked}
									value={editForm.startTime}
									onChange={(event) =>
										setEditForm((current) =>
											current
												? {
													...current,
													startTime: event.target.value,
												}
												: current,
										)
									}
									className="mt-1 w-full max-w-[12rem] rounded-xl border border-cyan-700/70 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
								/>
								{isEditStartTimeLocked ? (
									<p className="mt-1 text-[11px] text-cyan-200/80">
										Waktu mulai otomatis mengikuti relasi prev/next.
									</p>
								) : null}
							</label>

							<div className="text-xs text-cyan-100">
								Durasi
								<div className="mt-1 grid gap-1.5">
									<label className="inline-flex items-center gap-2 rounded-lg border border-cyan-700/50 bg-cyan-900/20 px-2 py-1.5 text-xs text-cyan-100">
										<input
											type="radio"
											name="edit-duration-source"
											checked={editForm.durationSource === 'custom'}
											onChange={() =>
												setEditForm((current) =>
													current
														? {
															...current,
															durationSource: 'custom',
														}
														: current,
												)
											}
										/>
										Custom
									</label>
									<label className="inline-flex items-center gap-2 rounded-lg border border-cyan-700/50 bg-cyan-900/20 px-2 py-1.5 text-xs text-cyan-100">
										<input
											type="radio"
											name="edit-duration-source"
											checked={editForm.durationSource === 'action'}
											onChange={() =>
												setEditForm((current) =>
													current
														? {
															...current,
															durationSource: 'action',
														}
														: current,
												)
											}
										/>
										Dari action
									</label>
								</div>
							</div>

							{editForm.durationSource === 'custom' ? (
								<label className="text-xs text-cyan-100 sm:col-span-2">
									Durasi custom
									<input
										type="text"
										value={editForm.customDuration}
										onChange={(event) =>
											setEditForm((current) =>
												current
													? {
														...current,
														customDuration: event.target.value,
													}
													: current,
											)
										}
										className="mt-1 w-full rounded-xl border border-cyan-700/70 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none"
									/>
								</label>
							) : (
								<label className="text-xs text-cyan-100 sm:col-span-2">
									Pilih action (durasi rata-rata)
									<select
										value={editForm.actionId}
										onChange={(event) =>
											setEditForm((current) =>
												current
													? {
														...current,
														actionId: event.target.value,
													}
													: current,
											)
										}
										className="mt-1 w-full rounded-xl border border-cyan-700/70 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none"
									>
										<option value="">Pilih action...</option>
										{actions.map((action) => (
											<option key={`edit-action-${action.action_id}`} value={action.action_id}>
												{action.action_name} ({action['durasi rata-rata'] ?? '-'})
											</option>
										))}
									</select>
									<p className="mt-1 text-[11px] text-cyan-200/80">
										Durasi terpilih:{' '}
										{selectedEditAction?.['durasi rata-rata']
											? normalizeDuration(selectedEditAction['durasi rata-rata'])
											: '-'}
									</p>
								</label>
							)}

							<label className="text-xs text-cyan-100">
								Prev
								<select
									value={editForm.prevId}
									onChange={(event) =>
										setEditForm((current) =>
											current
												? {
													...current,
													prevId: event.target.value,
												}
												: current,
										)
									}
									className="mt-1 w-full rounded-xl border border-cyan-700/70 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none"
								>
									<option value="">None</option>
									{sortedBlocks
										.filter((block) => block.block_id !== editingBlockId)
										.map((block) => (
											<option key={`edit-prev-${block.block_id}`} value={block.block_id}>
												{blockOptionLabel(block)}
											</option>
										))}
								</select>
							</label>

							<label className="text-xs text-cyan-100">
								Next
								<select
									value={editForm.nextId}
									onChange={(event) =>
										setEditForm((current) =>
											current
												? {
													...current,
													nextId: event.target.value,
												}
												: current,
										)
									}
									className="mt-1 w-full rounded-xl border border-cyan-700/70 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none"
								>
									<option value="">None</option>
									{sortedBlocks
										.filter((block) => block.block_id !== editingBlockId)
										.map((block) => (
											<option key={`edit-next-${block.block_id}`} value={block.block_id}>
												{blockOptionLabel(block)}
											</option>
										))}
								</select>
							</label>
						</div>

						<div className="mt-3 flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() => {
									void handleUpdateBlock(editingBlockId);
								}}
								disabled={isSavingBlockId === editingBlockId}
								className="rounded-xl border border-cyan-700/70 bg-cyan-900/35 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-800/45 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isSavingBlockId === editingBlockId ? 'Menyimpan...' : 'Simpan Perubahan'}
							</button>
							<button
								type="button"
								onClick={cancelEditing}
								disabled={isSavingBlockId === editingBlockId}
								className="rounded-xl border border-zinc-700 bg-zinc-800/70 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
							>
								Batal
							</button>
							<button
								type="button"
								onClick={() => {
									void handleDeleteBlock(editingBlockId);
								}}
								disabled={isDeletingBlockId === editingBlockId}
								className="rounded-xl border border-rose-700/70 bg-rose-900/35 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-800/45 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isDeletingBlockId === editingBlockId ? 'Menghapus...' : 'Hapus Block'}
							</button>
						</div>

						{editError ? (
							<p className="mt-2 rounded-xl border border-rose-700/70 bg-rose-900/30 px-3 py-2 text-sm text-rose-200">
								{editError}
							</p>
						) : null}
					</section>
				) : null}
			</section>
		</main>
	);
}
