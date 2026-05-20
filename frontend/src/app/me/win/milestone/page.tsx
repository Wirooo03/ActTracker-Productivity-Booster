'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isApiError } from '@/lib/api/apiError';
import type { Activity, ActivityTag, Tag } from '@/lib/api/types';
import { activitiesService } from '@/services/activitiesService';
import { activityTagsService } from '@/services/activityTagsService';
import { tagsService } from '@/services/tagsService';
import { winService } from '@/services/winService';

type MilestoneCell =
	| { kind: 'missing' }
	| { kind: 'check' }
	| { kind: 'cross' }
	| { kind: 'mixed' }
	| { kind: 'value'; value: number };

const compactDateFormatter = new Intl.DateTimeFormat('id-ID', {
	day: '2-digit',
	month: '2-digit',
	year: '2-digit',
});

const longDateFormatter = new Intl.DateTimeFormat('id-ID', {
	weekday: 'long',
	day: '2-digit',
	month: 'long',
	year: 'numeric',
});

const monthTitleFormatter = new Intl.DateTimeFormat('id-ID', {
	month: 'long',
	year: 'numeric',
});

const USE_MILESTONE_MATRIX_ENDPOINT = false;

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return 'Terjadi kesalahan yang tidak terduga.';
}

function extractDateKey(rawDate: string | undefined): string | null {
	if (!rawDate) {
		return null;
	}

	const matched = rawDate.match(/^\d{4}-\d{2}-\d{2}/);
	if (matched) {
		return matched[0];
	}

	const parsed = new Date(rawDate);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	const year = parsed.getFullYear();
	const month = String(parsed.getMonth() + 1).padStart(2, '0');
	const day = String(parsed.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function dateFromKey(key: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
		return null;
	}

	const [yearText, monthText, dayText] = key.split('-');
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

function startOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number): Date {
	return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function toDateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function normalizeTags(data: Tag[]): Tag[] {
	return [...data].sort((left, right) => {
		const nameCompare = left.tag_name.localeCompare(right.tag_name, 'id-ID', {
			sensitivity: 'base',
		});

		if (nameCompare !== 0) {
			return nameCompare;
		}

		return left.tag_id - right.tag_id;
	});
}

function normalizeActivities(data: Activity[]): Activity[] {
	return [...data].sort((left, right) => {
		if (left.activity_date === right.activity_date) {
			return left.activity_id - right.activity_id;
		}

		return left.activity_date.localeCompare(right.activity_date);
	});
}

function formatCellValue(value: number): string {
	if (Number.isInteger(value)) {
		return String(value);
	}

	return value.toFixed(2).replace(/\.?0+$/, '');
}

function buildCellState(
	relations: ActivityTag[],
	activityPointById: Map<number, number>,
): MilestoneCell {
	if (relations.length === 0) {
		return { kind: 'missing' };
	}

	const values = relations
		.map((relation) => relation.tag_value)
		.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

	if (values.length > 0) {
		const average = values.reduce((total, value) => total + value, 0) / values.length;
		return { kind: 'value', value: average };
	}

	let hasPositive = false;
	let hasNegative = false;

	for (const relation of relations) {
		const point =
			typeof relation.activity?.activity_point === 'number'
				? relation.activity.activity_point
				: activityPointById.get(relation.activity_id);

		if (typeof point !== 'number') {
			continue;
		}

		if (point >= 0) {
			hasPositive = true;
		}

		if (point < 0) {
			hasNegative = true;
		}
	}

	if (hasPositive && !hasNegative) {
		return { kind: 'check' };
	}

	if (hasNegative && !hasPositive) {
		return { kind: 'cross' };
	}

	if (hasPositive && hasNegative) {
		return { kind: 'mixed' };
	}

	return { kind: 'missing' };
}

function milestoneCellFromPayload(state: string, value: number | null): MilestoneCell {
	if (state === 'check') {
		return { kind: 'check' };
	}

	if (state === 'cross') {
		return { kind: 'cross' };
	}

	if (state === 'mixed') {
		return { kind: 'mixed' };
	}

	if (state === 'value' && typeof value === 'number' && Number.isFinite(value)) {
		return { kind: 'value', value };
	}

	return { kind: 'missing' };
}

function MilestoneCellContent({ cell }: { cell: MilestoneCell }) {
	if (cell.kind === 'check') {
		return (
			<svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-emerald-400" aria-hidden="true">
				<path
					d="M4.5 10.5 8 14l7.5-8"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		);
	}

	if (cell.kind === 'cross') {
		return (
			<svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-rose-400" aria-hidden="true">
				<path
					d="m6 6 8 8m0-8-8 8"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		);
	}

	if (cell.kind === 'value') {
		return <span className="text-xs font-semibold text-cyan-300">{formatCellValue(cell.value)}</span>;
	}

	if (cell.kind === 'mixed') {
		return <span className="text-sm font-semibold text-amber-300">+/-</span>;
	}

	return <span className="text-sm font-semibold text-zinc-400">?</span>;
}

export default function WinMilestonePage() {
	const initialMonth = useMemo(() => startOfMonth(new Date()), []);
	const [viewMonth, setViewMonth] = useState(initialMonth);
	const [tags, setTags] = useState<Tag[]>([]);
	const [matrixDateKeys, setMatrixDateKeys] = useState<string[] | null>(null);
	const [matrixCellMap, setMatrixCellMap] = useState<Map<string, MilestoneCell> | null>(null);
	const [supportsMatrixEndpoint, setSupportsMatrixEndpoint] = useState(
		USE_MILESTONE_MATRIX_ENDPOINT,
	);
	const [activities, setActivities] = useState<Activity[]>([]);
	const [activityTags, setActivityTags] = useState<ActivityTag[]>([]);
	const [isMetadataLoading, setIsMetadataLoading] = useState(true);
	const [isMonthLoading, setIsMonthLoading] = useState(true);
	const [metadataError, setMetadataError] = useState<string | null>(null);
	const [monthError, setMonthError] = useState<string | null>(null);

	const loadMetadata = useCallback(async (): Promise<void> => {
		setIsMetadataLoading(true);
		setMetadataError(null);

		try {
			const tagsResponse = await tagsService.list({
				fields: ['tag_id', 'tag_name'],
			});

			setTags(normalizeTags(tagsResponse.data));
		} catch (error) {
			setMetadataError(getErrorMessage(error));
			setTags([]);
		} finally {
			setIsMetadataLoading(false);
		}
	}, []);

	const loadMonthActivities = useCallback(async (monthDate: Date): Promise<void> => {
		setIsMonthLoading(true);
		setMonthError(null);

		try {
			const response = await activitiesService.listByMonth(
				monthDate.getFullYear(),
				monthDate.getMonth() + 1,
			);

			const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
			const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
			const activityTagsByMonth: ActivityTag[] = [];
			const perPage = 200;
			let page = 1;

			while (true) {
				const activityTagsResponse = await activityTagsService.list({
					date_from: toDateKey(startDate),
					date_to: toDateKey(endDate),
					include: ['activity'],
					per_page: perPage,
					page,
				});

				activityTagsByMonth.push(...activityTagsResponse.data);

				const hasMoreRaw = activityTagsResponse.meta?.has_more;
				const hasMore = typeof hasMoreRaw === 'boolean' ? hasMoreRaw : null;
				const lastPageRaw = activityTagsResponse.meta?.last_page;
				const lastPage =
					typeof lastPageRaw === 'number' && Number.isInteger(lastPageRaw) && lastPageRaw > 0
						? lastPageRaw
						: null;

				if (hasMore === true) {
					page += 1;
					continue;
				}

				if (hasMore === false) {
					break;
				}

				if (lastPage !== null) {
					if (page >= lastPage) {
						break;
					}

					page += 1;
					continue;
				}

				if (activityTagsResponse.data.length < perPage) {
					break;
				}

				page += 1;

				if (page > 1000) {
					throw new Error('Pagination relasi tag melebihi batas wajar.');
				}
			}

			setActivities(normalizeActivities(response.data));
			setActivityTags(activityTagsByMonth);
		} catch (error) {
			setMonthError(getErrorMessage(error));
			setActivities([]);
			setActivityTags([]);
		} finally {
			setIsMonthLoading(false);
		}
	}, []);

	useEffect(() => {
		if (supportsMatrixEndpoint !== false) {
			return;
		}

		void loadMetadata();
	}, [loadMetadata, supportsMatrixEndpoint]);

	useEffect(() => {
		if (supportsMatrixEndpoint !== false) {
			return;
		}

		void loadMonthActivities(viewMonth);
	}, [loadMonthActivities, supportsMatrixEndpoint, viewMonth]);

	useEffect(() => {
		if (supportsMatrixEndpoint === false) {
			return;
		}

		let isCurrent = true;

		async function loadMatrix(): Promise<void> {
			setIsMetadataLoading(true);
			setIsMonthLoading(true);
			setMetadataError(null);
			setMonthError(null);

			try {
				const response = await winService.getMilestoneMatrix(
					viewMonth.getFullYear(),
					viewMonth.getMonth() + 1,
				);

				if (!isCurrent) {
					return;
				}

				setTags(normalizeTags(response.data.tags));
				setMatrixDateKeys([...response.data.dates].sort((left, right) => right.localeCompare(left)));

				const cellsMap = new Map<string, MilestoneCell>();
				for (const cell of response.data.cells) {
					cellsMap.set(
						`${cell.tag_id}|${cell.date}`,
						milestoneCellFromPayload(cell.state, cell.value),
					);
				}

				setMatrixCellMap(cellsMap);
				setActivities([]);
				setActivityTags([]);
				setSupportsMatrixEndpoint(true);
			} catch (error) {
				if (!isCurrent) {
					return;
				}

				if (isApiError(error) && (error.status === 404 || error.status === 405)) {
					setSupportsMatrixEndpoint(false);
					setMatrixDateKeys(null);
					setMatrixCellMap(null);
					return;
				}

				setMetadataError(getErrorMessage(error));
				setMonthError(null);
			} finally {
				if (isCurrent) {
					setIsMetadataLoading(false);
					setIsMonthLoading(false);
				}
			}
		}

		void loadMatrix();

		return () => {
			isCurrent = false;
		};
	}, [supportsMatrixEndpoint, viewMonth]);

	const legacyDateKeys = useMemo(() => {
		const keys = new Set<string>();

		for (const activity of activities) {
			const key = extractDateKey(activity.activity_date);
			if (key) {
				keys.add(key);
			}
		}

		// Latest date appears on the left.
		return [...keys].sort((left, right) => right.localeCompare(left));
	}, [activities]);

	const dateKeys = matrixDateKeys ?? legacyDateKeys;

	const activityDateById = useMemo(() => {
		const map = new Map<number, string>();

		for (const activity of activities) {
			const key = extractDateKey(activity.activity_date);
			if (key) {
				map.set(activity.activity_id, key);
			}
		}

		return map;
	}, [activities]);

	const activityPointById = useMemo(() => {
		const map = new Map<number, number>();

		for (const activity of activities) {
			map.set(activity.activity_id, activity.activity_point);
		}

		return map;
	}, [activities]);

	const relationMap = useMemo(() => {
		const map = new Map<string, ActivityTag[]>();

		for (const relation of activityTags) {
			const dateKey = activityDateById.get(relation.activity_id);
			if (!dateKey) {
				continue;
			}

			const cellKey = `${relation.tag_id}|${dateKey}`;
			const current = map.get(cellKey);
			if (current) {
				current.push(relation);
			} else {
				map.set(cellKey, [relation]);
			}
		}

		return map;
	}, [activityDateById, activityTags]);

	const isLoading = isMetadataLoading || isMonthLoading;
	const loadErrors = [metadataError, monthError].filter(
		(message): message is string => Boolean(message),
	);

	function moveMonth(offset: number): void {
		setViewMonth((current) => addMonths(current, offset));
	}

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937_0%,_#0b0b0b_42%,_#040404_100%)] px-2.5 py-3 text-zinc-100 sm:px-5 sm:py-5">
			<section className="mx-auto flex w-full max-w-5xl flex-col gap-3 [font-family:var(--font-geist-sans)] sm:gap-4">
				<header className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="flex min-w-0 items-start gap-3">
							<Link
								href="/me/win"
								className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-lg leading-none text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
								aria-label="Kembali ke kalender"
								title="Kembali ke kalender"
							>
								&lt;
							</Link>

							<div className="min-w-0 space-y-1.5 sm:space-y-2">
								<h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
									Milestone Tag Harian
								</h1>
								<p className="max-w-2xl text-xs text-zinc-300 sm:text-base">
									Matriks status tag terhadap tanggal aktivitas pada bulan terpilih.
								</p>
							</div>
						</div>

						<div className="w-full rounded-2xl border border-cyan-700/60 bg-cyan-950/50 px-3 py-2.5 text-left sm:w-auto sm:text-right">
							<p className="text-xs uppercase tracking-wide text-cyan-200/75">Ringkasan data</p>
							<p className="text-base font-semibold text-cyan-100 sm:text-lg">
								{tags.length} tag / {dateKeys.length} tanggal
							</p>
						</div>
					</div>

					<div className="mt-3 hidden flex-wrap items-center gap-2 text-xs text-zinc-400 sm:flex sm:text-sm">
						<span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-3 py-1">Dashboard</span>
						<span>/</span>
						<span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-3 py-1">Perkembangan Harian</span>
						<span>/</span>
						<span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-3 py-1 text-zinc-200">Milestone</span>
					</div>
				</header>

				<section className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-3 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
					<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => moveMonth(-1)}
								className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-lg leading-none text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
								aria-label="Bulan sebelumnya"
							>
								&lt;
							</button>
							<div className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-200 sm:text-base">
								{monthTitleFormatter.format(viewMonth)}
							</div>
							<button
								type="button"
								onClick={() => moveMonth(1)}
								className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-lg leading-none text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
								aria-label="Bulan berikutnya"
							>
								&gt;
							</button>
						</div>
					</div>

					{loadErrors.length > 0 ? (
						<div className="mt-2.5 space-y-2">
							{loadErrors.map((error, index) => (
								<div
									key={`milestone-error-${index}`}
									className="rounded-xl border border-amber-700/70 bg-amber-900/30 p-3 text-sm text-amber-200"
								>
									<p>{error}</p>
								</div>
							))}
						</div>
					) : null}

					<div className="mt-2.5 rounded-2xl border border-zinc-700/70 bg-zinc-950/60 p-1.5 sm:p-2">
						{isLoading ? (
							<div className="space-y-2">
								{Array.from({ length: 6 }, (_, index) => (
									<div
										key={`milestone-skeleton-${index}`}
										className="h-10 animate-pulse rounded-xl border border-zinc-700 bg-zinc-800/50"
									/>
								))}
							</div>
						) : dateKeys.length === 0 || tags.length === 0 ? (
							<div className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-3 py-6 text-center text-sm text-zinc-400">
								Belum ada data milestone untuk bulan ini.
							</div>
						) : (
							<div className="max-h-[68vh] overflow-auto pb-2">
								<table className="min-w-max border-separate border-spacing-x-1 border-spacing-y-1">
									<thead>
										<tr>
											<th className="sticky left-0 z-20 w-[4rem] min-w-[4rem] max-w-[4rem] rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
												Tags
											</th>
											{dateKeys.map((key) => {
												const parsedDate = dateFromKey(key);
												const dateLabel = parsedDate
													? compactDateFormatter.format(parsedDate)
													: key;

												return (
													<th
														key={`head-${key}`}
														className="h-14 min-w-12 align-bottom text-center"
														title={parsedDate ? longDateFormatter.format(parsedDate) : key}
													>
														<span className="inline-block origin-bottom-left -rotate-45 whitespace-nowrap text-[9px] font-medium text-zinc-400">
															{dateLabel}
														</span>
													</th>
												);
											})}
										</tr>
									</thead>

									<tbody>
										{tags.map((tag) => (
											<tr key={`row-${tag.tag_id}`}>
												<th className="sticky left-0 z-10 w-[4rem] min-w-[4rem] max-w-[4rem] rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-left text-xs font-medium text-zinc-200 sm:text-sm">
													<span className="block truncate" title={tag.tag_name}>
														{tag.tag_name}
													</span>
												</th>

												{dateKeys.map((key) => {
													const cell = matrixCellMap
														? (matrixCellMap.get(`${tag.tag_id}|${key}`) ?? { kind: 'missing' })
														: buildCellState(
															relationMap.get(`${tag.tag_id}|${key}`) ?? [],
															activityPointById,
														);

													return (
														<td key={`cell-${tag.tag_id}-${key}`} className="min-w-12">
															<div className="flex h-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/60">
																<MilestoneCellContent cell={cell} />
															</div>
														</td>
													);
												})}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</section>
			</section>
		</main>
	);
}
