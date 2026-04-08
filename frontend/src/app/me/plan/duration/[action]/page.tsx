'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, getFieldErrors } from '@/lib/api/apiError';
import { normalizeDurationHHMMSS } from '@/lib/api/duration';
import type { Action, Expedition } from '@/lib/api/types';
import { actionsService } from '@/services/actionsService';
import { expeditionsService } from '@/services/expeditionsService';

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return 'Terjadi kesalahan yang tidak terduga.';
}

export default function DurationActionDetailPage() {
	const params = useParams<{ action: string | string[] }>();
	const router = useRouter();

	const rawActionParam = Array.isArray(params?.action)
		? params.action[0]
		: params?.action;
	const actionId = Number(rawActionParam);
	const isActionIdValid = Number.isInteger(actionId) && actionId > 0;

	const [action, setAction] = useState<Action | null>(null);
	const [expeditions, setExpeditions] = useState<Expedition[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const [actionNameDraft, setActionNameDraft] = useState('');
	const [actionNameError, setActionNameError] = useState<string | null>(null);
	const [isSavingAction, setIsSavingAction] = useState(false);

	const [newDuration, setNewDuration] = useState('01:30:00');
	const [newDurationError, setNewDurationError] = useState<string | null>(null);
	const [isCreatingExpedition, setIsCreatingExpedition] = useState(false);

	const [editingExpeditionId, setEditingExpeditionId] = useState<number | null>(null);
	const [editingDurationDraft, setEditingDurationDraft] = useState('');
	const [editingDurationError, setEditingDurationError] = useState<string | null>(null);
	const [isSavingExpeditionId, setIsSavingExpeditionId] = useState<number | null>(null);
	const [isDeletingExpeditionId, setIsDeletingExpeditionId] = useState<number | null>(null);

	const sortedExpeditions = useMemo(() => {
		return [...expeditions].sort((left, right) => right.expedition_id - left.expedition_id);
	}, [expeditions]);

	const loadData = useCallback(async (): Promise<void> => {
		if (!isActionIdValid) {
			setLoadError('Parameter action id tidak valid.');
			setAction(null);
			setExpeditions([]);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setLoadError(null);

		try {
			const [actionResponse, expeditionsResponse] = await Promise.all([
				actionsService.getById(actionId),
				expeditionsService.list({ action_id: actionId }),
			]);

			setAction(actionResponse.data);
			setActionNameDraft(actionResponse.data.action_name);
			setExpeditions(expeditionsResponse.data);
		} catch (error) {
			setLoadError(getErrorMessage(error));
			setAction(null);
			setExpeditions([]);
		} finally {
			setIsLoading(false);
		}
	}, [actionId, isActionIdValid]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	async function saveActionName(): Promise<void> {
		if (!action) {
			return;
		}

		setNotice(null);
		setActionNameError(null);

		const actionName = actionNameDraft.trim();
		if (!actionName) {
			setActionNameError('Nama action wajib diisi.');
			return;
		}

		setIsSavingAction(true);

		try {
			const response = await actionsService.update(action.action_id, {
				action_name: actionName,
			});

			setAction(response.data);
			setActionNameDraft(response.data.action_name);
			setNotice(response.message);
		} catch (error) {
			if (error instanceof ApiError && error.status === 422) {
				const fieldErrors = getFieldErrors(error, 'action_name');
				setActionNameError(fieldErrors[0] ?? error.message);
				return;
			}

			setActionNameError(getErrorMessage(error));
		} finally {
			setIsSavingAction(false);
		}
	}

	async function deleteCurrentAction(): Promise<void> {
		if (!action) {
			return;
		}

		if (!window.confirm('Hapus action ini beserta relasi duration yang terkait?')) {
			return;
		}

		setIsSavingAction(true);
		setNotice(null);

		try {
			await actionsService.remove(action.action_id);
			router.push('/me/plan/duration');
		} catch (error) {
			setNotice(getErrorMessage(error));
		} finally {
			setIsSavingAction(false);
		}
	}

	async function addExpedition(): Promise<void> {
		if (!action) {
			return;
		}

		setNotice(null);
		setNewDurationError(null);

		const normalizedDuration = normalizeDurationHHMMSS(newDuration);
		if (!normalizedDuration) {
			setNewDurationError(
				'Format duration tidak valid. Gunakan HH:mm:ss atau HH:mm, contoh 05:30:00 atau 05:30.',
			);
			return;
		}

		setIsCreatingExpedition(true);

		try {
			const response = await expeditionsService.create({
				action_id: action.action_id,
				duration: normalizedDuration,
			});

			setNewDuration('01:30:00');
			setNotice(response.message);
			await loadData();
		} catch (error) {
			if (error instanceof ApiError && error.status === 422) {
				const fieldErrors = getFieldErrors(error, 'duration');
				setNewDurationError(fieldErrors[0] ?? error.message);
				return;
			}

			setNewDurationError(getErrorMessage(error));
		} finally {
			setIsCreatingExpedition(false);
		}
	}

	function startEditExpedition(expedition: Expedition): void {
		setEditingExpeditionId(expedition.expedition_id);
		setEditingDurationDraft(expedition.duration);
		setEditingDurationError(null);
	}

	function cancelEditExpedition(): void {
		setEditingExpeditionId(null);
		setEditingDurationDraft('');
		setEditingDurationError(null);
	}

	async function saveEditedExpedition(expeditionId: number): Promise<void> {
		const normalizedDuration = normalizeDurationHHMMSS(editingDurationDraft);
		if (!normalizedDuration) {
			setEditingDurationError(
				'Format duration tidak valid. Gunakan HH:mm:ss atau HH:mm.',
			);
			return;
		}

		setIsSavingExpeditionId(expeditionId);
		setEditingDurationError(null);
		setNotice(null);

		try {
			const response = await expeditionsService.update(expeditionId, {
				duration: normalizedDuration,
			});

			setNotice(response.message);
			cancelEditExpedition();
			await loadData();
		} catch (error) {
			if (error instanceof ApiError && error.status === 422) {
				const fieldErrors = getFieldErrors(error, 'duration');
				setEditingDurationError(fieldErrors[0] ?? error.message);
				return;
			}

			setEditingDurationError(getErrorMessage(error));
		} finally {
			setIsSavingExpeditionId(null);
		}
	}

	async function deleteExpedition(expeditionId: number): Promise<void> {
		if (!window.confirm('Hapus duration expedition ini?')) {
			return;
		}

		setIsDeletingExpeditionId(expeditionId);
		setNotice(null);

		try {
			const response = await expeditionsService.remove(expeditionId);
			setNotice(response.message);
			if (editingExpeditionId === expeditionId) {
				cancelEditExpedition();
			}
			await loadData();
		} catch (error) {
			setNotice(getErrorMessage(error));
		} finally {
			setIsDeletingExpeditionId(null);
		}
	}

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937_0%,_#0b0b0b_42%,_#040404_100%)] px-2.5 py-3 text-zinc-100 sm:px-6 sm:py-6">
			<section className="mx-auto flex w-full max-w-4xl flex-col gap-3 [font-family:var(--font-geist-sans)] sm:gap-4">
				<header className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="flex min-w-0 items-start gap-3">
							<Link
								href="/me/plan/duration"
								className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-lg leading-none text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
								aria-label="Kembali"
								title="Kembali"
							>
								&lt;
							</Link>

							<div className="min-w-0 space-y-1">
								<h1 className="truncate text-xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
									{action ? action.action_name : 'Action Detail'}
								</h1>
								<p className="text-xs text-zinc-300 sm:text-sm">
									Expected duration rata-rata:{' '}
									<span className="font-semibold text-zinc-100">
										{action?.['durasi rata-rata'] ?? '-'}
									</span>
								</p>
							</div>
						</div>
					</div>
				</header>

				<section className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-3 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
					{loadError ? (
						<div className="rounded-xl border border-rose-700/70 bg-rose-900/30 p-3 text-sm text-rose-200">
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
						<p className="mb-2.5 rounded-xl border border-emerald-700/70 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-200">
							{notice}
						</p>
					) : null}

					{isLoading ? (
						<div className="space-y-2">
							{Array.from({ length: 5 }, (_, index) => (
								<div
									key={`expedition-skeleton-${index}`}
									className="h-20 animate-pulse rounded-xl border border-zinc-700 bg-zinc-800/50"
								/>
							))}
						</div>
					) : !action ? (
						<div className="rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 py-4 text-sm text-zinc-400">
							Action tidak ditemukan.
						</div>
					) : (
						<div className="space-y-3">
							<div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-3">
								<h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
									Edit Action
								</h2>
								<div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
									<input
										type="text"
										value={actionNameDraft}
										onChange={(event) => setActionNameDraft(event.target.value)}
										className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
									/>
									<button
										type="button"
										onClick={() => {
											void saveActionName();
										}}
										disabled={isSavingAction}
										className="rounded-xl border border-cyan-700/70 bg-cyan-900/35 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-800/45 disabled:cursor-not-allowed disabled:opacity-60"
									>
										Simpan
									</button>
									<button
										type="button"
										onClick={() => {
											void deleteCurrentAction();
										}}
										disabled={isSavingAction}
										className="rounded-xl border border-rose-700/70 bg-rose-900/35 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-800/45 disabled:cursor-not-allowed disabled:opacity-60"
									>
										Hapus Action
									</button>
								</div>
								{actionNameError ? (
									<p className="mt-2 text-sm text-rose-300">{actionNameError}</p>
								) : null}
							</div>

							<div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-3">
								<div className="flex items-center justify-between gap-2">
									<h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
										Expedition Durations
									</h2>
								</div>

								<div className="mt-2 space-y-2">
									{sortedExpeditions.length === 0 ? (
										<div className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-3 py-4 text-center text-sm text-zinc-400">
											Belum ada duration untuk action ini.
										</div>
									) : (
										sortedExpeditions.map((expedition) => {
											const isEditing = editingExpeditionId === expedition.expedition_id;
											const isSaving =
												isSavingExpeditionId === expedition.expedition_id;
											const isDeleting =
												isDeletingExpeditionId === expedition.expedition_id;

											return (
												<div
													key={expedition.expedition_id}
													className="rounded-xl border border-zinc-700 bg-zinc-900/70 px-3 py-2"
												>
													<div className="flex items-start justify-between gap-2">
														<div className="min-w-0">
															{isEditing ? (
																<input
																	type="text"
																	value={editingDurationDraft}
																	onChange={(event) => setEditingDurationDraft(event.target.value)}
																	className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-3xl font-semibold text-zinc-200 outline-none transition focus:border-cyan-500 sm:text-4xl"
																/>
															) : (
																<p className="text-3xl font-semibold text-zinc-200 sm:text-4xl">
																	{expedition.duration}
																</p>
															)}
															<p className="text-xs text-zinc-500">
																expedition id: {expedition.expedition_id}
															</p>
														</div>

														<div className="flex items-center gap-1.5">
															{isEditing ? (
																<>
																	<button
																		type="button"
																		onClick={() => {
																			void saveEditedExpedition(expedition.expedition_id);
																		}}
																		disabled={isSaving}
																		className="rounded-lg border border-cyan-700/70 px-2 py-1 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-900/35 disabled:cursor-not-allowed disabled:opacity-60"
																	>
																		Simpan
																	</button>
																	<button
																		type="button"
																		onClick={cancelEditExpedition}
																		disabled={isSaving}
																		className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
																	>
																		Batal
																	</button>
																</>
															) : (
																<button
																	type="button"
																	onClick={() => startEditExpedition(expedition)}
																	className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
																>
																	Edit
																</button>
															)}

															<button
																type="button"
																onClick={() => {
																	void deleteExpedition(expedition.expedition_id);
																}}
																disabled={isDeleting}
																className="rounded-lg border border-rose-700/70 px-2 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/35 disabled:cursor-not-allowed disabled:opacity-60"
															>
																{isDeleting ? '...' : 'Hapus'}
															</button>
														</div>
													</div>

													{isEditing && editingDurationError ? (
														<p className="mt-1.5 text-xs text-rose-300">
															{editingDurationError}
														</p>
													) : null}
												</div>
											);
										})
									)}
								</div>

								<div className="mt-3 flex items-start gap-2">
									<div className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-2xl leading-none text-zinc-100">
										+
									</div>
									<div className="flex-1">
										<input
											type="text"
											value={newDuration}
											onChange={(event) => setNewDuration(event.target.value)}
												placeholder="Tambah duration, contoh 02:45:00 atau 02:45"
											className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
										/>
										<button
											type="button"
											onClick={() => {
												void addExpedition();
											}}
											disabled={isCreatingExpedition}
											className="mt-2 rounded-xl border border-cyan-700/70 bg-cyan-900/35 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-800/45 disabled:cursor-not-allowed disabled:opacity-60"
										>
											{isCreatingExpedition ? 'Menyimpan...' : 'Tambah Duration'}
										</button>
										{newDurationError ? (
											<p className="mt-1.5 text-xs text-rose-300">{newDurationError}</p>
										) : null}
									</div>
								</div>
							</div>
						</div>
					)}
				</section>
			</section>
		</main>
	);
}
