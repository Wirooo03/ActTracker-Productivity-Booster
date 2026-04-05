'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getActivitiesByMonth, type Activity } from '@/lib/activities-api';

type CalendarCell = {
	date: Date;
	inCurrentMonth: boolean;
};

type TrendRangeValue = '7d' | '1m' | '3m' | '6m' | '1y' | '5y' | 'all';

type TrendPoint = {
	date: Date;
	value: number;
};

const WEEK_DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const TREND_RANGE_OPTIONS: Array<{ value: TrendRangeValue; label: string }> = [
	{ value: '7d', label: '1 minggu terakhir' },
	{ value: '1m', label: '1 bulan terakhir' },
	{ value: '3m', label: '3 bulan terakhir' },
	{ value: '6m', label: '6 bulan terakhir' },
	{ value: '1y', label: '1 tahun terakhir' },
	{ value: '5y', label: '5 tahun terakhir' },
	{ value: 'all', label: 'All time' },
];

const ALL_TIME_EMPTY_MONTH_STOP = 12;
const ALL_TIME_MAX_LOOKBACK_MONTHS = 240;

const monthTitleFormatter = new Intl.DateTimeFormat('id-ID', {
	month: 'long',
	year: 'numeric',
});

const longDateFormatter = new Intl.DateTimeFormat('id-ID', {
	weekday: 'long',
	day: '2-digit',
	month: 'long',
	year: 'numeric',
});

const chartLabelFormatter = new Intl.DateTimeFormat('id-ID', {
	day: '2-digit',
	month: 'short',
	year: '2-digit',
});

function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function monthKey(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, '0')}`;
}

function addDays(date: Date, amount: number): Date {
	const nextDate = new Date(date);
	nextDate.setDate(nextDate.getDate() + amount);
	return startOfDay(nextDate);
}

function addMonths(date: Date, amount: number): Date {
	return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildCalendarCells(viewDate: Date): CalendarCell[] {
	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();
	const firstDayInMonth = new Date(year, month, 1);
	const offset = firstDayInMonth.getDay();
	const gridStart = new Date(year, month, 1 - offset);
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const visibleRows = Math.ceil((offset + daysInMonth) / 7);
	const totalCells = visibleRows * 7;

	return Array.from({ length: totalCells }, (_, index) => {
		const cellDate = addDays(gridStart, index);
		return {
			date: cellDate,
			inCurrentMonth: cellDate.getMonth() === month,
		};
	});
}

function rangeStartFromSelection(range: Exclude<TrendRangeValue, 'all'>, today: Date): Date {
	switch (range) {
		case '7d':
			return addDays(today, -6);
		case '1m':
			return addDays(today, -29);
		case '3m':
			return addDays(today, -89);
		case '6m':
			return addDays(today, -179);
		case '1y':
			return addDays(today, -364);
		case '5y':
			return addDays(today, -1824);
	}
}

function parseActivityDate(activityDate: string): Date | null {
	const rawKey = extractDateKey(activityDate);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(rawKey)) {
		return null;
	}

	const [yearText, monthText, dayText] = rawKey.split('-');
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

	return startOfDay(parsed);
}

function listMonthSpan(startDate: Date, endDate: Date): Array<{ year: number; month: number }> {
	const startMonth = startOfMonth(startDate);
	const endMonth = startOfMonth(endDate);
	const span: Array<{ year: number; month: number }> = [];

	for (let cursor = startMonth; cursor <= endMonth; cursor = addMonths(cursor, 1)) {
		span.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
	}

	return span;
}

function buildTrendSeries(
	startDate: Date,
	endDate: Date,
	pointMap: Record<string, number>,
): TrendPoint[] {
	const series: TrendPoint[] = [];

	for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
		series.push({
			date: cursor,
			value: pointMap[dateKey(cursor)] ?? 0,
		});
	}

	return series;
}

function buildPath(points: Array<{ x: number; y: number }>): string {
	if (points.length === 0) {
		return '';
	}

	return points
		.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
		.join(' ');
}

function extractDateKey(activityDate: string): string {
	const matched = activityDate.match(/^\d{4}-\d{2}-\d{2}/);
	if (matched) {
		return matched[0];
	}

	const parsed = new Date(activityDate);
	if (Number.isNaN(parsed.getTime())) {
		return activityDate;
	}

	return dateKey(parsed);
}

function buildPointMap(activities: Activity[]): Record<string, number> {
	const totals: Record<string, number> = {};

	for (const activity of activities) {
		const key = extractDateKey(activity.activity_date);
		totals[key] = (totals[key] ?? 0) + activity.activity_point;
	}

	return totals;
}

export default function WinProgressPage() {
	const router = useRouter();
	const today = useMemo(() => startOfDay(new Date()), []);
	const monthCacheRef = useRef<Map<string, Activity[]>>(new Map());
	const [viewMonth, setViewMonth] = useState(
		() => new Date(today.getFullYear(), today.getMonth(), 1),
	);
	const [selectedDate, setSelectedDate] = useState(today);
	const [trendRange, setTrendRange] = useState<TrendRangeValue>('1m');
	const [trendSeries, setTrendSeries] = useState<TrendPoint[]>([]);
	const [isTrendLoading, setIsTrendLoading] = useState(false);
	const [trendError, setTrendError] = useState<string | null>(null);
	const [monthPointMap, setMonthPointMap] = useState<Record<string, number>>({});
	const [isMonthLoading, setIsMonthLoading] = useState(false);
	const [monthError, setMonthError] = useState<string | null>(null);

	const getMonthActivitiesCached = useCallback(async (year: number, month: number): Promise<Activity[]> => {
		const key = monthKey(year, month);
		const cached = monthCacheRef.current.get(key);
		if (cached) {
			return cached;
		}

		const response = await getActivitiesByMonth(year, month);
		monthCacheRef.current.set(key, response.data);
		return response.data;
	}, []);

	useEffect(() => {
		let isCurrent = true;

		async function loadMonthActivities(): Promise<void> {
			setIsMonthLoading(true);
			setMonthError(null);

			try {
				const monthActivities = await getMonthActivitiesCached(
					viewMonth.getFullYear(),
					viewMonth.getMonth() + 1,
				);

				if (!isCurrent) {
					return;
				}

				setMonthPointMap(buildPointMap(monthActivities));
			} catch (error) {
				if (!isCurrent) {
					return;
				}

				setMonthPointMap({});
				setMonthError(
					error instanceof Error
						? error.message
						: 'Gagal memuat data aktivitas bulan ini.',
				);
			} finally {
				if (isCurrent) {
					setIsMonthLoading(false);
				}
			}
		}

		void loadMonthActivities();

		return () => {
			isCurrent = false;
		};
	}, [getMonthActivitiesCached, viewMonth]);

	useEffect(() => {
		let isCurrent = true;

		async function loadTrendData(): Promise<void> {
			setIsTrendLoading(true);
			setTrendError(null);

			try {
				const trendEnd = today;
				let trendStart = trendEnd;

				if (trendRange === 'all') {
					let foundAny = false;
					let emptyStreak = 0;
					let earliestDate = trendEnd;

					for (let index = 0; index < ALL_TIME_MAX_LOOKBACK_MONTHS; index += 1) {
						const cursorMonth = addMonths(startOfMonth(trendEnd), -index);
						const monthActivities = await getMonthActivitiesCached(
							cursorMonth.getFullYear(),
							cursorMonth.getMonth() + 1,
						);

						if (monthActivities.length > 0) {
							foundAny = true;
							emptyStreak = 0;

							for (const activity of monthActivities) {
								const parsed = parseActivityDate(activity.activity_date);
								if (parsed && parsed < earliestDate) {
									earliestDate = parsed;
								}
							}
						} else if (foundAny) {
							emptyStreak += 1;
							if (emptyStreak >= ALL_TIME_EMPTY_MONTH_STOP) {
								break;
							}
						}
					}

					trendStart = foundAny ? earliestDate : addDays(trendEnd, -6);
				} else {
					trendStart = rangeStartFromSelection(trendRange, trendEnd);
				}

				const monthSpan = listMonthSpan(trendStart, trendEnd);
				const monthData = await Promise.all(
					monthSpan.map(({ year, month }) => getMonthActivitiesCached(year, month)),
				);

				if (!isCurrent) {
					return;
				}

				const mergedActivities = monthData.flat();
				const pointMap = buildPointMap(mergedActivities);
				setTrendSeries(buildTrendSeries(trendStart, trendEnd, pointMap));
			} catch (error) {
				if (!isCurrent) {
					return;
				}

				setTrendSeries([]);
				setTrendError(
					error instanceof Error ? error.message : 'Gagal memuat data trend aktivitas.',
				);
			} finally {
				if (isCurrent) {
					setIsTrendLoading(false);
				}
			}
		}

		void loadTrendData();

		return () => {
			isCurrent = false;
		};
	}, [getMonthActivitiesCached, today, trendRange]);

	const todayKey = dateKey(today);
	const selectedDateKey = dateKey(selectedDate);

	const calendarCells = useMemo(() => buildCalendarCells(viewMonth), [viewMonth]);

	const selectedPoint = useMemo(
		() => monthPointMap[selectedDateKey] ?? 0,
		[monthPointMap, selectedDateKey],
	);

	const monthPointTotal = useMemo(
		() => Object.values(monthPointMap).reduce((total, point) => total + point, 0),
		[monthPointMap],
	);

	const trendChartData = useMemo(() => {
		const svgWidth = 960;
		const svgHeight = 260;
		const paddingLeft = 16;
		const paddingRight = 16;
		const paddingTop = 12;
		const paddingBottom = 24;

		if (trendSeries.length === 0) {
			return {
				svgWidth,
				svgHeight,
				linePath: '',
				areaPath: '',
				points: [] as Array<{ x: number; y: number; value: number }>,
				zeroLineY: svgHeight / 2,
				totalValue: 0,
			};
		}

		const values = trendSeries.map((item) => item.value);
		const minValue = Math.min(...values, 0);
		const maxValue = Math.max(...values, 0);
		const valueSpan = maxValue - minValue || 1;
		const chartWidth = svgWidth - paddingLeft - paddingRight;
		const chartHeight = svgHeight - paddingTop - paddingBottom;
		const stepX = trendSeries.length > 1 ? chartWidth / (trendSeries.length - 1) : 0;

		const points = trendSeries.map((item, index) => {
			const x = paddingLeft + index * stepX;
			const y = paddingTop + ((maxValue - item.value) / valueSpan) * chartHeight;
			return {
				x,
				y,
				value: item.value,
			};
		});

		const linePath = buildPath(points);
		const areaPath =
			points.length > 0
				? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(svgHeight - paddingBottom).toFixed(2)} L ${points[0].x.toFixed(2)} ${(svgHeight - paddingBottom).toFixed(2)} Z`
				: '';

		const zeroLineY =
			paddingTop + ((maxValue - 0) / valueSpan) * chartHeight;

		return {
			svgWidth,
			svgHeight,
			linePath,
			areaPath,
			points,
			zeroLineY,
			totalValue: values.reduce((total, value) => total + value, 0),
		};
	}, [trendSeries]);

	function moveMonth(monthOffset: number): void {
		setViewMonth((current) =>
			new Date(current.getFullYear(), current.getMonth() + monthOffset, 1),
		);
	}

	function openDayDetail(date: Date): void {
		const normalizedDate = startOfDay(date);
		setSelectedDate(normalizedDate);
		router.push(`/me/win/${dateKey(normalizedDate)}`);
	}

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937_0%,_#0a0a0a_40%,_#050505_100%)] px-3 py-4 text-zinc-100 sm:px-8 sm:py-10">
			<section className="mx-auto flex w-full max-w-5xl flex-col gap-4 [font-family:var(--font-geist-sans)] sm:gap-5">
				<header className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur sm:p-5">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="space-y-2">
							<h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
								Daily Progress Monitor
							</h1>
							<p className="max-w-xl text-xs text-zinc-300 sm:text-base">
								Fondasi dashboard untuk melihat perkembangan harian berdasarkan poin
								per tanggal asli.
							</p>
						</div>
					</div>

					<div className="mt-4 hidden flex-wrap items-center gap-2 text-xs text-zinc-400 sm:flex sm:text-sm">
						<span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-3 py-1">
							Dashboard
						</span>
						<span>/</span>
						<span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-3 py-1">
							Perkembangan Harian
						</span>
					</div>
				</header>

				<section className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-4 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)] backdrop-blur sm:p-5">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-200 sm:text-base">
								Trend Poin Harian
							</h2>
							<p className="mt-1 text-xs text-zinc-400 sm:text-sm">
								Lihat perubahan poin berdasarkan rentang waktu yang dipilih.
							</p>
						</div>

						<label className="flex w-full items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/70 px-3 py-2 text-xs text-zinc-300 sm:w-auto sm:text-sm">
							<span>Rentang</span>
							<select
								value={trendRange}
								onChange={(event) => setTrendRange(event.target.value as TrendRangeValue)}
								className="w-full bg-transparent text-zinc-100 outline-none sm:w-auto"
								aria-label="Pilih rentang waktu trend"
							>
								{TREND_RANGE_OPTIONS.map((option) => (
									<option key={option.value} value={option.value} className="bg-zinc-900 text-zinc-100">
										{option.label}
									</option>
								))}
							</select>
						</label>
					</div>

					<div className="mt-3 rounded-2xl border border-zinc-700/70 bg-zinc-950/60 p-2 sm:p-3">
						{trendError ? (
							<p className="rounded-xl border border-amber-700/70 bg-amber-900/30 px-4 py-2 text-sm text-amber-200">
								{trendError}
							</p>
						) : isTrendLoading ? (
							<p className="px-2 py-12 text-center text-sm text-zinc-400">
								Memuat data trend aktivitas...
							</p>
						) : trendSeries.length === 0 ? (
							<p className="px-2 py-12 text-center text-sm text-zinc-400">
								Belum ada data untuk ditampilkan.
							</p>
						) : (
							<>
								<div className="h-52 w-full sm:h-60">
									<svg
										viewBox={`0 0 ${trendChartData.svgWidth} ${trendChartData.svgHeight}`}
										className="h-full w-full"
										role="img"
										aria-label="Grafik garis trend poin"
									>
										<defs>
											<linearGradient id="trendLineFill" x1="0" y1="0" x2="0" y2="1">
												<stop offset="0%" stopColor="rgba(56,189,248,0.35)" />
												<stop offset="100%" stopColor="rgba(56,189,248,0.02)" />
											</linearGradient>
										</defs>

										<line
											x1="16"
											x2={trendChartData.svgWidth - 16}
											y1={trendChartData.zeroLineY}
											y2={trendChartData.zeroLineY}
											stroke="rgba(244,244,245,0.2)"
											strokeDasharray="4 5"
										/>

										<path d={trendChartData.areaPath} fill="url(#trendLineFill)" />
										<path
											d={trendChartData.linePath}
											fill="none"
											stroke="rgb(34 211 238)"
											strokeWidth="2.4"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>

										{trendChartData.points.length <= 120
											? trendChartData.points.map((point, index) => (
													<circle
														key={`point-${index}`}
														cx={point.x}
														cy={point.y}
														r="2.1"
														fill="rgb(103 232 249)"
													/>
												))
											: null}
									</svg>
								</div>

								<div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400 sm:text-xs">
									<span>{chartLabelFormatter.format(trendSeries[0].date)}</span>
									<span className="text-zinc-300">Total: {trendChartData.totalValue}</span>
									<span>{chartLabelFormatter.format(trendSeries[trendSeries.length - 1].date)}</span>
								</div>
							</>
						)}
					</div>

					{monthError ? (
						<p className="mt-3 rounded-xl border border-amber-700/70 bg-amber-900/30 px-4 py-2 text-sm text-amber-200">
							{monthError}
						</p>
					) : null}
					{isMonthLoading ? (
						<p className="mt-3 text-sm text-zinc-400">Memuat data aktivitas bulanan...</p>
					) : null}
				</section>

				<section className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-4 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)] backdrop-blur sm:p-5">
					<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
						<div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
							<button
								type="button"
								onClick={() => moveMonth(-1)}
								className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-lg leading-none text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
								aria-label="Bulan sebelumnya"
							>
								&lt;
							</button>
							<div className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-200 sm:min-w-56 sm:flex-none sm:px-4 sm:text-base">
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

						<div className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-left sm:w-auto sm:text-right">
							<p className="text-xs uppercase tracking-wide text-zinc-400">
								Total poin bulan ini
							</p>
							<p className="text-lg font-bold text-zinc-100">{monthPointTotal}</p>
						</div>
					</div>

					<div className="mt-3 flex justify-end">
						<button
							type="button"
							onClick={() => router.push('/me/win/milestone')}
							className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-cyan-500 hover:bg-cyan-900/35 sm:text-sm"
						>
							Lihat Milestone
						</button>
					</div>

					<div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:gap-2 sm:text-sm">
						{WEEK_DAYS.map((day) => (
							<p key={day}>{day}</p>
						))}
					</div>

					<div className="mt-2 grid grid-cols-7 gap-1.5 sm:mt-3 sm:gap-2">
						{calendarCells.map((cell) => {
							const point = monthPointMap[dateKey(cell.date)] ?? 0;
							const key = dateKey(cell.date);
							const isToday = key === todayKey;
							const isSelected = key === selectedDateKey;

							return (
								<button
									key={key}
									type="button"
									onClick={() => openDayDetail(cell.date)}
									className={`flex min-h-14 flex-col items-start rounded-xl border px-1.5 py-1.5 text-left text-[10px] transition sm:min-h-20 sm:px-3 sm:py-2 sm:text-sm ${
										isSelected
											? 'border-cyan-400 bg-cyan-500/15 text-cyan-100 shadow-[0_8px_20px_-12px_rgba(34,211,238,0.9)]'
											: cell.inCurrentMonth
												? 'border-zinc-700 bg-zinc-800/70 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800'
												: 'border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:border-zinc-700'
									} ${isToday ? 'ring-1 ring-emerald-400/70' : ''}`}
									aria-label={`Pilih tanggal ${longDateFormatter.format(cell.date)}`}
								>
									<span className="font-semibold">{cell.date.getDate()}</span>
									<span className="mt-1 rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-300 sm:px-2 sm:text-[11px]">
										{point}
										<span className="hidden sm:inline"> poin</span>
									</span>
								</button>
							);
						})}
					</div>
				</section>
			</section>
		</main>
	);
}
