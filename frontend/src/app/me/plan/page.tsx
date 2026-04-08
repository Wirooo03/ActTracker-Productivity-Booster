'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type CalendarCell = {
	date: Date;
	inCurrentMonth: boolean;
};

const WEEK_DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

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

function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number): Date {
	const nextDate = new Date(date);
	nextDate.setDate(nextDate.getDate() + amount);
	return startOfDay(nextDate);
}

function dateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
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

export default function PlanCalendarPage() {
	const router = useRouter();
	const today = useMemo(() => startOfDay(new Date()), []);
	const [viewMonth, setViewMonth] = useState(
		() => new Date(today.getFullYear(), today.getMonth(), 1),
	);
	const [selectedDate, setSelectedDate] = useState(today);

	const todayKey = dateKey(today);
	const selectedDateKey = dateKey(selectedDate);
	const calendarCells = useMemo(() => buildCalendarCells(viewMonth), [viewMonth]);

	function moveMonth(monthOffset: number): void {
		setViewMonth(
			(current) => new Date(current.getFullYear(), current.getMonth() + monthOffset, 1),
		);
	}

	function openDayPlan(date: Date): void {
		const normalized = startOfDay(date);
		setSelectedDate(normalized);
		router.push(`/me/plan/${dateKey(normalized)}`);
	}

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937_0%,_#0a0a0a_40%,_#050505_100%)] px-2.5 py-3 text-zinc-100 sm:px-5 sm:py-5">
			<section className="mx-auto flex w-full max-w-5xl flex-col gap-3 [font-family:var(--font-geist-sans)] sm:gap-4">
				<header className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="space-y-2">
							<h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
								Plan Calendar
							</h1>
							<p className="max-w-xl text-xs text-zinc-300 sm:text-sm">
								Pilih tanggal untuk membuka time-block plan harian yang tersimpan di backend.
							</p>
						</div>
					</div>

					<div className="mt-3 hidden flex-wrap items-center gap-2 text-xs text-zinc-400 sm:flex sm:text-sm">
						<span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-3 py-1">
							Plan
						</span>
						<span>/</span>
						<span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-3 py-1">
							Calendar
						</span>
					</div>
				</header>

				<section className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-3 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
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
							<p className="text-xs uppercase tracking-wide text-zinc-400">Tanggal dipilih</p>
							<p className="text-sm font-semibold text-zinc-100 sm:text-base">
								{longDateFormatter.format(selectedDate)}
							</p>
						</div>
					</div>

					<div className="mt-3 flex justify-end gap-2">
                        <Link
								href="/me/win"
								className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-700 sm:text-sm"
							>
								Win
							</Link>
						<Link
							href="/me/plan/duration"
							className="rounded-xl border border-cyan-700/70 bg-cyan-900/35 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-800/45 sm:text-sm"
						>
							Kelola Action Duration
						</Link>
					</div>

					<div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:gap-2 sm:text-sm">
						{WEEK_DAYS.map((day) => (
							<p key={day}>{day}</p>
						))}
					</div>

					<div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
						{calendarCells.map((cell) => {
							const key = dateKey(cell.date);
							const isToday = key === todayKey;
							const isSelected = key === selectedDateKey;

							return (
								<button
									key={key}
									type="button"
									onClick={() => openDayPlan(cell.date)}
									className={`flex min-h-12 flex-col items-start rounded-xl border px-1.5 py-1.5 text-left text-[10px] transition sm:min-h-[4.25rem] sm:px-2.5 sm:py-1.5 sm:text-sm ${
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
										Open plan
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
