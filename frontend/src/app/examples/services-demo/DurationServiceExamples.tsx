'use client';

import { useMemo, useState } from 'react';
import { ApiError, getFieldErrors } from '@/lib/api/apiError';
import { normalizeDurationHHMMSS, normalizeTimeHHMMSS } from '@/lib/api/duration';
import type { Action } from '@/lib/api/types';
import { blocksService } from '@/services/blocksService';
import { expeditionsService } from '@/services/expeditionsService';

type DurationServiceExamplesProps = {
	actions: Action[];
	actionsLoadError: string | null;
};

function todayDateKey(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function parseOptionalPositiveInteger(raw: string): number | null {
	const value = raw.trim();
	if (!value) {
		return null;
	}

	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return Number.NaN;
	}

	return parsed;
}

export function DurationServiceExamples({ actions, actionsLoadError }: DurationServiceExamplesProps) {
	const [expeditionActionId, setExpeditionActionId] = useState<string>('');
	const [expeditionDuration, setExpeditionDuration] = useState<string>('05:30:00');
	const [expeditionMessage, setExpeditionMessage] = useState<string>('');
	const [expeditionError, setExpeditionError] = useState<string>('');
	const [expedition422Errors, setExpedition422Errors] = useState<string[]>([]);
	const [isSubmittingExpedition, setIsSubmittingExpedition] = useState(false);

	const [blockStartTime, setBlockStartTime] = useState<string>('08:30:00');
	const [blockDuration, setBlockDuration] = useState<string>('01:30:00');
	const [blockActivityName, setBlockActivityName] = useState<string>('Deep Work');
	const [blockDate, setBlockDate] = useState<string>(todayDateKey());
	const [blockPrev, setBlockPrev] = useState<string>('');
	const [blockNext, setBlockNext] = useState<string>('');
	const [blockMessage, setBlockMessage] = useState<string>('');
	const [blockError, setBlockError] = useState<string>('');
	const [block422Errors, setBlock422Errors] = useState<string[]>([]);
	const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);

	const sortedActions = useMemo(() => {
		return [...actions].sort((left, right) => left.action_id - right.action_id);
	}, [actions]);

	async function handleCreateExpedition(): Promise<void> {
		setExpeditionMessage('');
		setExpeditionError('');
		setExpedition422Errors([]);

		const actionId = Number(expeditionActionId);
		if (!Number.isInteger(actionId) || actionId <= 0) {
			setExpeditionError('Pilih action_id yang valid.');
			return;
		}

		const normalizedDuration = normalizeDurationHHMMSS(expeditionDuration);
		if (!normalizedDuration) {
			setExpeditionError(
				'Duration tidak valid. Gunakan HH:mm:ss atau HH:mm, contoh 05:30:00 atau 05:30.',
			);
			return;
		}

		setIsSubmittingExpedition(true);

		try {
			const response = await expeditionsService.create({
				action_id: actionId,
				duration: normalizedDuration,
			});

			setExpeditionMessage(
				`${response.message} payload.duration terkirim sebagai ${normalizedDuration}`,
			);
		} catch (error) {
			if (error instanceof ApiError && error.status === 422) {
				const validationMessages = [
					...getFieldErrors(error, 'action_id'),
					...getFieldErrors(error, 'duration'),
				];
				setExpedition422Errors(
					validationMessages.length > 0 ? validationMessages : [error.message],
				);
				return;
			}

			setExpeditionError(error instanceof Error ? error.message : 'Gagal membuat expedition.');
		} finally {
			setIsSubmittingExpedition(false);
		}
	}

	async function handleCreateBlock(): Promise<void> {
		setBlockMessage('');
		setBlockError('');
		setBlock422Errors([]);

		const normalizedStartTime = normalizeTimeHHMMSS(blockStartTime);
		if (!normalizedStartTime) {
			setBlockError('start_time tidak valid. Gunakan HH:mm:ss atau HH:mm.');
			return;
		}

		const normalizedDuration = normalizeDurationHHMMSS(blockDuration);
		if (!normalizedDuration) {
			setBlockError('duration tidak valid. Gunakan HH:mm:ss atau HH:mm.');
			return;
		}

		if (!blockActivityName.trim()) {
			setBlockError('activity_name wajib diisi.');
			return;
		}

		const prev = parseOptionalPositiveInteger(blockPrev);
		if (Number.isNaN(prev)) {
			setBlockError('prev harus angka positif atau kosong.');
			return;
		}

		const next = parseOptionalPositiveInteger(blockNext);
		if (Number.isNaN(next)) {
			setBlockError('next harus angka positif atau kosong.');
			return;
		}

		if (prev !== null && next !== null && prev === next) {
			setBlockError('prev dan next tidak boleh sama.');
			return;
		}

		setIsSubmittingBlock(true);

		try {
			const response = await blocksService.create({
				start_time: normalizedStartTime,
				duration: normalizedDuration,
				prev,
				next,
				activity_name: blockActivityName.trim(),
				date: blockDate,
			});

			setBlockMessage(
				`${response.message} payload.start_time=${normalizedStartTime}, payload.duration=${normalizedDuration}`,
			);
		} catch (error) {
			if (error instanceof ApiError && error.status === 422) {
				const validationMessages = [
					...getFieldErrors(error, 'start_time'),
					...getFieldErrors(error, 'duration'),
					...getFieldErrors(error, 'activity_name'),
					...getFieldErrors(error, 'date'),
					...getFieldErrors(error, 'prev'),
					...getFieldErrors(error, 'next'),
				];
				setBlock422Errors(
					validationMessages.length > 0 ? validationMessages : [error.message],
				);
				return;
			}

			setBlockError(error instanceof Error ? error.message : 'Gagal membuat block.');
		} finally {
			setIsSubmittingBlock(false);
		}
	}

	return (
		<section className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4">
			<h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
				Contoh Duration HH:mm:ss
			</h2>

			{actionsLoadError ? (
				<p className="mt-2 rounded-xl border border-amber-700/70 bg-amber-900/30 px-3 py-2 text-sm text-amber-200">
					{actionsLoadError}
				</p>
			) : null}

			<div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950/60 p-3">
				<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
					Render durasi rata-rata dari action
				</p>
				{sortedActions.length === 0 ? (
					<p className="mt-2 text-sm text-zinc-500">Belum ada action.</p>
				) : (
					<ul className="mt-2 space-y-1.5">
						{sortedActions.slice(0, 8).map((action) => (
							<li
								key={`duration-example-action-${action.action_id}`}
								className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-2.5 py-1.5 text-xs text-zinc-300"
							>
								#{action.action_id} {action.action_name} - avg:{' '}
								<span className="font-semibold text-zinc-100">
									{action['durasi rata-rata'] ?? '-'}
								</span>
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="mt-3 grid gap-3 lg:grid-cols-2">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void handleCreateExpedition();
					}}
					className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3"
				>
					<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
						Contoh create expedition
					</p>
					<label className="mt-2 block text-xs text-zinc-400">
						action_id
						<select
							value={expeditionActionId}
							onChange={(event) => setExpeditionActionId(event.target.value)}
							className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-100 outline-none"
						>
							<option value="">Pilih action...</option>
							{sortedActions.map((action) => (
								<option key={`expedition-action-${action.action_id}`} value={action.action_id}>
									{action.action_name} ({action['durasi rata-rata'] ?? '-'})
								</option>
							))}
						</select>
					</label>

					<label className="mt-2 block text-xs text-zinc-400">
						duration
						<input
							type="text"
							value={expeditionDuration}
							onChange={(event) => setExpeditionDuration(event.target.value)}
							placeholder="05:30:00 atau 05:30"
							className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-100 outline-none"
						/>
					</label>

					<button
						type="submit"
						disabled={isSubmittingExpedition}
						className="mt-3 rounded-lg border border-cyan-700/70 bg-cyan-900/35 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/45 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isSubmittingExpedition ? 'Menyimpan...' : 'Create Expedition'}
					</button>

					{expeditionError ? (
						<p className="mt-2 text-xs text-rose-300">{expeditionError}</p>
					) : null}
					{expedition422Errors.length > 0 ? (
						<ul className="mt-2 space-y-1 text-xs text-rose-300">
							{expedition422Errors.map((message) => (
								<li key={`expedition-422-${message}`}>- {message}</li>
							))}
						</ul>
					) : null}
					{expeditionMessage ? (
						<p className="mt-2 text-xs text-emerald-300">{expeditionMessage}</p>
					) : null}
				</form>

				<form
					onSubmit={(event) => {
						event.preventDefault();
						void handleCreateBlock();
					}}
					className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3"
				>
					<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
						Contoh create block
					</p>

					<label className="mt-2 block text-xs text-zinc-400">
						start_time
						<input
							type="text"
							value={blockStartTime}
							onChange={(event) => setBlockStartTime(event.target.value)}
							placeholder="08:30:00 atau 08:30"
							className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-100 outline-none"
						/>
					</label>

					<label className="mt-2 block text-xs text-zinc-400">
						duration
						<input
							type="text"
							value={blockDuration}
							onChange={(event) => setBlockDuration(event.target.value)}
							placeholder="01:30:00 atau 01:30"
							className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-100 outline-none"
						/>
					</label>

					<label className="mt-2 block text-xs text-zinc-400">
						activity_name
						<input
							type="text"
							value={blockActivityName}
							onChange={(event) => setBlockActivityName(event.target.value)}
							className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-100 outline-none"
						/>
					</label>

					<div className="mt-2 grid grid-cols-3 gap-2">
						<label className="block text-xs text-zinc-400">
							date
							<input
								type="date"
								value={blockDate}
								onChange={(event) => setBlockDate(event.target.value)}
								className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-100 outline-none"
							/>
						</label>
						<label className="block text-xs text-zinc-400">
							prev
							<input
								type="text"
								value={blockPrev}
								onChange={(event) => setBlockPrev(event.target.value)}
								placeholder="null"
								className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-100 outline-none"
							/>
						</label>
						<label className="block text-xs text-zinc-400">
							next
							<input
								type="text"
								value={blockNext}
								onChange={(event) => setBlockNext(event.target.value)}
								placeholder="null"
								className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-100 outline-none"
							/>
						</label>
					</div>

					<button
						type="submit"
						disabled={isSubmittingBlock}
						className="mt-3 rounded-lg border border-cyan-700/70 bg-cyan-900/35 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/45 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isSubmittingBlock ? 'Menyimpan...' : 'Create Block'}
					</button>

					{blockError ? <p className="mt-2 text-xs text-rose-300">{blockError}</p> : null}
					{block422Errors.length > 0 ? (
						<ul className="mt-2 space-y-1 text-xs text-rose-300">
							{block422Errors.map((message) => (
								<li key={`block-422-${message}`}>- {message}</li>
							))}
						</ul>
					) : null}
					{blockMessage ? <p className="mt-2 text-xs text-emerald-300">{blockMessage}</p> : null}
				</form>
			</div>
		</section>
	);
}
