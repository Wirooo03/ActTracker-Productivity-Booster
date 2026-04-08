'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, getFieldErrors } from '@/lib/api/apiError';
import { normalizeDurationHHMMSS } from '@/lib/api/duration';
import type { Action } from '@/lib/api/types';
import { actionsService } from '@/services/actionsService';
import { expeditionsService } from '@/services/expeditionsService';

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return 'Terjadi kesalahan yang tidak terduga.';
}

export default function DurationActionsPage() {
	const [actions, setActions] = useState<Action[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const [newActionName, setNewActionName] = useState('');
	const [createActionError, setCreateActionError] = useState<string | null>(null);
	const [isCreatingAction, setIsCreatingAction] = useState(false);

	const [editingActionId, setEditingActionId] = useState<number | null>(null);
	const [editingActionName, setEditingActionName] = useState('');
	const [actionRowBusyId, setActionRowBusyId] = useState<number | null>(null);

	const [durationDraftByActionId, setDurationDraftByActionId] = useState<Record<number, string>>({});
	const [durationErrorByActionId, setDurationErrorByActionId] = useState<Record<number, string>>({});
	const [expeditionSubmittingActionId, setExpeditionSubmittingActionId] = useState<number | null>(null);

	const sortedActions = useMemo(() => {
		return [...actions].sort((left, right) => left.action_id - right.action_id);
	}, [actions]);

	const loadActions = useCallback(async (): Promise<void> => {
		setIsLoading(true);
		setLoadError(null);

		try {
			const response = await actionsService.list();
			setActions(response.data);
		} catch (error) {
			setLoadError(getErrorMessage(error));
			setActions([]);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadActions();
	}, [loadActions]);

	async function handleCreateAction(): Promise<void> {
		setCreateActionError(null);
		setNotice(null);

		const actionName = newActionName.trim();
		if (!actionName) {
			setCreateActionError('Nama action wajib diisi.');
			return;
		}

		setIsCreatingAction(true);

		try {
			const response = await actionsService.create({
				action_name: actionName,
			});

			setNewActionName('');
			setNotice(response.message);
			await loadActions();
		} catch (error) {
			if (error instanceof ApiError && error.status === 422) {
				const fieldErrors = getFieldErrors(error, 'action_name');
				setCreateActionError(fieldErrors[0] ?? error.message);
				return;
			}

			setCreateActionError(getErrorMessage(error));
		} finally {
			setIsCreatingAction(false);
		}
	}

	function startEditAction(action: Action): void {
		setEditingActionId(action.action_id);
		setEditingActionName(action.action_name);
		setNotice(null);
	}

	function cancelEditAction(): void {
		setEditingActionId(null);
		setEditingActionName('');
	}

	async function saveEditAction(actionId: number): Promise<void> {
		const actionName = editingActionName.trim();
		if (!actionName) {
			setNotice('Nama action tidak boleh kosong.');
			return;
		}

		setActionRowBusyId(actionId);
		setNotice(null);

		try {
			const response = await actionsService.update(actionId, {
				action_name: actionName,
			});

			setNotice(response.message);
			cancelEditAction();
			await loadActions();
		} catch (error) {
			setNotice(getErrorMessage(error));
		} finally {
			setActionRowBusyId(null);
		}
	}

	async function deleteAction(actionId: number): Promise<void> {
		if (!window.confirm('Hapus action ini?')) {
			return;
		}

		setActionRowBusyId(actionId);
		setNotice(null);

		try {
			const response = await actionsService.remove(actionId);
			setNotice(response.message);
			if (editingActionId === actionId) {
				cancelEditAction();
			}
			await loadActions();
		} catch (error) {
			setNotice(getErrorMessage(error));
		} finally {
			setActionRowBusyId(null);
		}
	}

	function setDurationDraft(actionId: number, value: string): void {
		setDurationDraftByActionId((current) => ({
			...current,
			[actionId]: value,
		}));
		setDurationErrorByActionId((current) => ({
			...current,
			[actionId]: '',
		}));
	}

	async function addExpeditionDuration(actionId: number): Promise<void> {
		setNotice(null);
		const durationInput = (durationDraftByActionId[actionId] ?? '').trim();
		const duration = normalizeDurationHHMMSS(durationInput);

		if (!duration) {
			setDurationErrorByActionId((current) => ({
				...current,
				[actionId]: 'Format durasi tidak valid. Gunakan HH:mm:ss atau HH:mm, contoh 05:30:00 atau 05:30.',
			}));
			return;
		}

		setExpeditionSubmittingActionId(actionId);

		try {
			const response = await expeditionsService.create({
				action_id: actionId,
				duration,
			});

			setDurationDraftByActionId((current) => ({
				...current,
				[actionId]: '',
			}));
			setDurationErrorByActionId((current) => ({
				...current,
				[actionId]: '',
			}));
			setNotice(response.message);
			await loadActions();
		} catch (error) {
			if (error instanceof ApiError && error.status === 422) {
				const fieldErrors = getFieldErrors(error, 'duration');
				setDurationErrorByActionId((current) => ({
					...current,
					[actionId]: fieldErrors[0] ?? error.message,
				}));
				return;
			}

			setDurationErrorByActionId((current) => ({
				...current,
				[actionId]: getErrorMessage(error),
			}));
		} finally {
			setExpeditionSubmittingActionId(null);
		}
	}

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937_0%,_#0b0b0b_42%,_#040404_100%)] px-2.5 py-3 text-zinc-100 sm:px-6 sm:py-6">
			<section className="mx-auto flex w-full max-w-5xl flex-col gap-3 [font-family:var(--font-geist-sans)] sm:gap-4">
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
								<h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
									Plan Action & Duration
								</h1>
								<p className="max-w-2xl text-xs text-zinc-300 sm:text-sm">
									Setiap action bisa punya banyak expedition duration. Rata-rata durasi
									ditampilkan dari backend.
								</p>
							</div>
						</div>
					</div>
				</header>

				<section className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-3 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
					<div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-3">
						<h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">Tambah Action</h2>
						<div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
							<input
								type="text"
								value={newActionName}
								onChange={(event) => setNewActionName(event.target.value)}
								placeholder="Contoh: Coding"
								className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
							/>
							<button
								type="button"
								onClick={() => {
									void handleCreateAction();
								}}
								disabled={isCreatingAction}
								className="rounded-xl border border-cyan-700/70 bg-cyan-900/35 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-800/45 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isCreatingAction ? 'Menyimpan...' : 'Tambah'}
							</button>
						</div>

						{createActionError ? (
							<p className="mt-2 rounded-xl border border-rose-700/70 bg-rose-900/30 px-3 py-2 text-sm text-rose-200">
								{createActionError}
							</p>
						) : null}
						{notice ? (
							<p className="mt-2 rounded-xl border border-emerald-700/70 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-200">
								{notice}
							</p>
						) : null}
					</div>

					{loadError ? (
						<div className="mt-3 rounded-xl border border-rose-700/70 bg-rose-900/30 p-3 text-sm text-rose-200">
							<p>{loadError}</p>
							<button
								type="button"
								onClick={() => {
									void loadActions();
								}}
								className="mt-2 rounded-lg border border-rose-700/70 px-3 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-800/45"
							>
								Coba Lagi
							</button>
						</div>
					) : null}

					<div className="mt-3 space-y-2">
						{isLoading ? (
							<div className="space-y-2">
								{Array.from({ length: 4 }, (_, index) => (
									<div
										key={`action-skeleton-${index}`}
										className="h-24 animate-pulse rounded-2xl border border-zinc-700 bg-zinc-800/50"
									/>
								))}
							</div>
						) : sortedActions.length === 0 ? (
							<div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-4 text-center text-sm text-zinc-400">
								Belum ada action. Tambahkan action pertama.
							</div>
						) : (
							sortedActions.map((action) => {
								const isEditing = editingActionId === action.action_id;
								const isActionBusy = actionRowBusyId === action.action_id;
								const isAddingExpedition =
									expeditionSubmittingActionId === action.action_id;

								return (
									<article
										key={action.action_id}
										className="grid gap-2 rounded-2xl border border-zinc-700 bg-zinc-950/60 p-2.5 md:grid-cols-[1fr_15rem]"
									>
										<div className="rounded-xl border border-zinc-700 bg-zinc-900/70 px-3 py-2">
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0">
													{isEditing ? (
														<input
															type="text"
															value={editingActionName}
															onChange={(event) => setEditingActionName(event.target.value)}
															className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
														/>
													) : (
														<h3 className="truncate text-xl font-semibold text-zinc-100">
															{action.action_name}
														</h3>
													)}
													<p className="mt-0.5 text-xs text-zinc-400">
														Expected duration:{' '}
														<span className="font-semibold text-zinc-300">
															{action['durasi rata-rata'] ?? '-'}
														</span>
													</p>
												</div>
											</div>

											<div className="mt-2 flex flex-wrap items-center gap-1.5">
												<Link
													href={`/me/plan/duration/${action.action_id}`}
													className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-200 transition hover:border-cyan-500 hover:bg-cyan-900/35"
												>
													Detail
												</Link>

												{isEditing ? (
													<>
														<button
															type="button"
															onClick={() => {
																void saveEditAction(action.action_id);
															}}
															disabled={isActionBusy}
															className="rounded-lg border border-cyan-700/70 px-2 py-1 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-900/35 disabled:cursor-not-allowed disabled:opacity-60"
														>
															Simpan
														</button>
														<button
															type="button"
															onClick={cancelEditAction}
															disabled={isActionBusy}
															className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
														>
															Batal
														</button>
													</>
												) : (
													<button
														type="button"
														onClick={() => startEditAction(action)}
														disabled={isActionBusy}
														className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
													>
														Edit
													</button>
												)}

												<button
													type="button"
													onClick={() => {
														void deleteAction(action.action_id);
													}}
													disabled={isActionBusy}
													className="rounded-lg border border-rose-700/70 px-2 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/35 disabled:cursor-not-allowed disabled:opacity-60"
												>
													Hapus
												</button>
											</div>
										</div>

										<div className="rounded-xl border border-zinc-700 bg-zinc-900/70 px-3 py-2">
											<p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
												Add expedition duration
											</p>
											<input
												type="text"
												value={durationDraftByActionId[action.action_id] ?? ''}
												onChange={(event) =>
													setDurationDraft(action.action_id, event.target.value)
												}
												placeholder="Contoh: 05:30:00 atau 05:30"
												className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
											/>
											<button
												type="button"
												onClick={() => {
													void addExpeditionDuration(action.action_id);
												}}
												disabled={isAddingExpedition}
												className="mt-2 w-full rounded-lg border border-cyan-700/70 bg-cyan-900/35 px-2 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/45 disabled:cursor-not-allowed disabled:opacity-60"
											>
												{isAddingExpedition ? 'Menyimpan...' : 'Tambah durasi'}
											</button>

											{durationErrorByActionId[action.action_id] ? (
												<p className="mt-1.5 text-xs text-rose-300">
													{durationErrorByActionId[action.action_id]}
												</p>
											) : null}
										</div>
									</article>
								);
							})
						)}
					</div>
				</section>
			</section>
		</main>
	);
}
