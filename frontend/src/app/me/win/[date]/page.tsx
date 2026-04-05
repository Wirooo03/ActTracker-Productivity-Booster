'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
	type FormEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useState,
} from 'react';
import {
	createActivity,
	createActivityTag,
	createTag,
	deleteActivity,
	deleteActivityTag,
	deleteTag,
	getActivitiesByDate,
	getActivityTags,
	getTags,
	type Activity,
	type Tag,
	updateActivity,
	updateActivityTag,
	updateTag,
} from '@/lib/activities-api';

const TARGET_POINT = 50;

type ModalState = 'add' | 'edit' | 'delete' | 'tags' | null;

type ActivityFormState = {
	point: string;
	description: string;
};

type ActivityTagFormState = {
	activityTagId: number | null;
	tagId: string;
	tagValue: string;
};

type PreparedActivityTagRelation = {
	activityTagId: number | null;
	tagId: number;
	tagValue: number | null;
};

const longDateFormatter = new Intl.DateTimeFormat('id-ID', {
	weekday: 'long',
	day: '2-digit',
	month: 'long',
	year: 'numeric',
});

const compactDateFormatter = new Intl.DateTimeFormat('id-ID', {
	day: '2-digit',
	month: 'short',
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

function parseDateSegment(rawDate: string | undefined): Date | null {
	if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
		return null;
	}

	const [yearText, monthText, dayText] = rawDate.split('-');
	const year = Number(yearText);
	const monthIndex = Number(monthText) - 1;
	const day = Number(dayText);

	if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
		return null;
	}

	const parsed = new Date(year, monthIndex, day);
	if (
		parsed.getFullYear() !== year ||
		parsed.getMonth() !== monthIndex ||
		parsed.getDate() !== day
	) {
		return null;
	}

	return startOfDay(parsed);
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return 'Terjadi kesalahan yang tidak terduga.';
}

function parsePointInput(rawPoint: string): number | null {
	const point = Number(rawPoint);
	if (!Number.isFinite(point)) {
		return null;
	}

	return Math.trunc(point);
}

function formatSigned(value: number): string {
	if (value > 0) {
		return `+${value}`;
	}

	return String(value);
}

function normalizeActivities(data: Activity[]): Activity[] {
	return [...data].sort((left, right) => left.activity_id - right.activity_id);
}

function normalizeTags(data: Tag[]): Tag[] {
	return [...data].sort((left, right) => left.tag_id - right.tag_id);
}

function createEmptyTagRelation(): ActivityTagFormState {
	return {
		activityTagId: null,
		tagId: '',
		tagValue: '',
	};
}

function prepareActivityTagRelations(
	rows: ActivityTagFormState[],
): { data: PreparedActivityTagRelation[]; error: string | null } {
	const prepared: PreparedActivityTagRelation[] = [];
	const usedTagIds = new Set<number>();

	for (const row of rows) {
		const rawTagId = row.tagId.trim();
		const rawTagValue = row.tagValue.trim();

		if (!rawTagId && !rawTagValue) {
			continue;
		}

		if (!rawTagId) {
			return {
				data: [],
				error: 'Pilih tag terlebih dulu sebelum mengisi value.',
			};
		}

		const tagId = Number(rawTagId);
		if (!Number.isInteger(tagId) || tagId < 1) {
			return {
				data: [],
				error: 'Tag yang dipilih tidak valid.',
			};
		}

		if (usedTagIds.has(tagId)) {
			return {
				data: [],
				error: 'Tag yang sama tidak boleh dipilih lebih dari satu kali.',
			};
		}

		usedTagIds.add(tagId);

		let tagValue: number | null = null;
		if (rawTagValue) {
			const parsedValue = Number(rawTagValue);
			if (!Number.isFinite(parsedValue)) {
				return {
					data: [],
					error: 'Value tag harus berupa angka yang valid atau dikosongkan.',
				};
			}

			tagValue = parsedValue;
		}

		prepared.push({
			activityTagId: row.activityTagId,
			tagId,
			tagValue,
		});
	}

	return { data: prepared, error: null };
}

type ModalFrameProps = {
	title: string;
	subtitle: string;
	onClose: () => void;
	disableClose: boolean;
	children: ReactNode;
};

function ModalFrame({
	title,
	subtitle,
	onClose,
	disableClose,
	children,
}: ModalFrameProps) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-8">
			<div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-900 p-4 shadow-[0_20px_45px_-15px_rgba(0,0,0,0.85)] sm:p-5">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h3 className="text-xl font-semibold text-zinc-100">{title}</h3>
						<p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						disabled={disableClose}
						className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Tutup
					</button>
				</div>
				<div className="mt-5">{children}</div>
			</div>
		</div>
	);
}

export default function WinDayDetailPage() {
	const params = useParams<{ date: string }>();
	const router = useRouter();
	const today = useMemo(() => startOfDay(new Date()), []);

	const rawDateParam = useMemo(() => {
		const value = params?.date;
		if (Array.isArray(value)) {
			return value[0];
		}

		return value;
	}, [params]);

	const parsedDate = useMemo(() => parseDateSegment(rawDateParam), [rawDateParam]);
	const selectedDate = parsedDate ?? today;
	const selectedDateKey = dateKey(selectedDate);

	const [activities, setActivities] = useState<Activity[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [modalState, setModalState] = useState<ModalState>(null);
	const [activeActivity, setActiveActivity] = useState<Activity | null>(null);
	const [formState, setFormState] = useState<ActivityFormState>({
		point: '1',
		description: '',
	});
	const [formError, setFormError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [tags, setTags] = useState<Tag[]>([]);
	const [isTagsLoading, setIsTagsLoading] = useState(false);
	const [tagsError, setTagsError] = useState<string | null>(null);
	const [tagFormName, setTagFormName] = useState('');
	const [tagFormError, setTagFormError] = useState<string | null>(null);
	const [editingTagId, setEditingTagId] = useState<number | null>(null);
	const [editingTagName, setEditingTagName] = useState('');
	const [isTagSubmitting, setIsTagSubmitting] = useState(false);
	const [tagRelations, setTagRelations] = useState<ActivityTagFormState[]>([
		createEmptyTagRelation(),
	]);
	const [initialTagRelationIds, setInitialTagRelationIds] = useState<number[]>([]);
	const [isTagRelationsLoading, setIsTagRelationsLoading] = useState(false);
	const [tagRelationError, setTagRelationError] = useState<string | null>(null);

	async function refreshTags(): Promise<void> {
		setIsTagsLoading(true);
		setTagsError(null);

		try {
			const response = await getTags();
			setTags(normalizeTags(response.data));
		} catch (error) {
			setTagsError(getErrorMessage(error));
		} finally {
			setIsTagsLoading(false);
		}
	}

	async function loadActivityTagRelations(activityId: number): Promise<void> {
		setIsTagRelationsLoading(true);
		setTagRelationError(null);

		try {
			const response = await getActivityTags();
			const relationRows = response.data
				.filter((relation) => relation.activity_id === activityId)
				.sort((left, right) => left.activity_tag_id - right.activity_tag_id);

			setInitialTagRelationIds(relationRows.map((relation) => relation.activity_tag_id));
			setTagRelations(
				relationRows.length > 0
					? relationRows.map((relation) => ({
							activityTagId: relation.activity_tag_id,
							tagId: String(relation.tag_id),
							tagValue:
								relation.tag_value === null ? '' : String(relation.tag_value),
						}))
					: [createEmptyTagRelation()],
			);
		} catch (error) {
			setTagRelationError(getErrorMessage(error));
			setInitialTagRelationIds([]);
			setTagRelations([createEmptyTagRelation()]);
		} finally {
			setIsTagRelationsLoading(false);
		}
	}

	function addTagRelationRow(): void {
		setTagRelations((current) => [...current, createEmptyTagRelation()]);
	}

	function updateTagRelationRow(
		index: number,
		patch: Partial<ActivityTagFormState>,
	): void {
		setTagRelations((current) =>
			current.map((row, rowIndex) =>
				rowIndex === index ? { ...row, ...patch } : row,
			),
		);
	}

	function removeTagRelationRow(index: number): void {
		setTagRelations((current) => {
			const next = current.filter((_, rowIndex) => rowIndex !== index);
			return next.length > 0 ? next : [createEmptyTagRelation()];
		});
	}

	useEffect(() => {
		if (!rawDateParam || parsedDate) {
			return;
		}

		router.replace(`/me/win/${dateKey(today)}`);
	}, [parsedDate, rawDateParam, router, today]);

	useEffect(() => {
		void refreshTags();
	}, []);

	useEffect(() => {
		let isCurrent = true;

		async function loadActivitiesForDate(): Promise<void> {
			setIsLoading(true);
			setLoadError(null);

			try {
				const response = await getActivitiesByDate(selectedDateKey);
				if (!isCurrent) {
					return;
				}

				setActivities(normalizeActivities(response.data));
			} catch (error) {
				if (!isCurrent) {
					return;
				}

				setActivities([]);
				setLoadError(getErrorMessage(error));
			} finally {
				if (isCurrent) {
					setIsLoading(false);
				}
			}
		}

		setModalState(null);
		setActiveActivity(null);
		setFormError(null);
		setIsSubmitting(false);
		setStatusMessage(null);
		setFormState({ point: '1', description: '' });
		setTagFormName('');
		setTagFormError(null);
		setEditingTagId(null);
		setEditingTagName('');
		setIsTagRelationsLoading(false);
		setTagRelationError(null);
		setInitialTagRelationIds([]);
		setTagRelations([createEmptyTagRelation()]);
		void loadActivitiesForDate();

		return () => {
			isCurrent = false;
		};
	}, [selectedDateKey]);

	const positivePoint = useMemo(
		() =>
			activities.reduce(
				(total, activity) =>
					activity.activity_point > 0 ? total + activity.activity_point : total,
				0,
			),
		[activities],
	);

	const negativePoint = useMemo(
		() =>
			activities.reduce(
				(total, activity) =>
					activity.activity_point < 0 ? total + activity.activity_point : total,
				0,
			),
		[activities],
	);

	const totalPoint = useMemo(
		() => activities.reduce((total, activity) => total + activity.activity_point, 0),
		[activities],
	);

	const pointDiff = totalPoint - TARGET_POINT;
	const pointDiffTextClass = pointDiff < 0 ? 'text-rose-300' : 'text-emerald-300';

	async function refreshActivities(): Promise<void> {
		const response = await getActivitiesByDate(selectedDateKey);
		setActivities(normalizeActivities(response.data));
	}

	async function retryLoadActivities(): Promise<void> {
		setIsLoading(true);
		setLoadError(null);

		try {
			await refreshActivities();
		} catch (error) {
			setLoadError(getErrorMessage(error));
		} finally {
			setIsLoading(false);
		}
	}

	function changeDate(nextDate: Date): void {
		router.push(`/me/win/${dateKey(nextDate)}`);
	}

	function openAddModal(): void {
		setStatusMessage(null);
		setFormError(null);
		setTagRelationError(null);
		setActiveActivity(null);
		setFormState({ point: '1', description: '' });
		setInitialTagRelationIds([]);
		setTagRelations([createEmptyTagRelation()]);
		setModalState('add');

		if (tags.length === 0 && !isTagsLoading) {
			void refreshTags();
		}
	}

	function openTagModal(): void {
		setStatusMessage(null);
		setTagFormError(null);
		setTagRelationError(null);
		setFormError(null);
		setEditingTagId(null);
		setEditingTagName('');
		setTagFormName('');
		setModalState('tags');

		if (tags.length === 0 && !isTagsLoading) {
			void refreshTags();
		}
	}

	function openEditModal(activity: Activity): void {
		setStatusMessage(null);
		setFormError(null);
		setTagRelationError(null);
		setActiveActivity(activity);
		setFormState({
			point: String(activity.activity_point),
			description: activity.activity_description,
		});
		setInitialTagRelationIds([]);
		setTagRelations([createEmptyTagRelation()]);
		setModalState('edit');

		if (tags.length === 0 && !isTagsLoading) {
			void refreshTags();
		}

		void loadActivityTagRelations(activity.activity_id);
	}

	function openDeleteModal(activity: Activity): void {
		setStatusMessage(null);
		setFormError(null);
		setTagRelationError(null);
		setActiveActivity(activity);
		setModalState('delete');
	}

	function adjustFormPoint(delta: number): void {
		setFormState((current) => {
			const currentPoint = parsePointInput(current.point) ?? 0;
			return {
				...current,
				point: String(currentPoint + delta),
			};
		});
	}

	async function handleCreateTagSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setTagFormError(null);

		const tagName = tagFormName.trim();
		if (!tagName) {
			setTagFormError('Nama tag wajib diisi.');
			return;
		}

		setIsTagSubmitting(true);

		try {
			const response = await createTag({ tag_name: tagName });
			await refreshTags();
			setTagFormName('');
			setStatusMessage(response.message);
		} catch (error) {
			setTagFormError(getErrorMessage(error));
		} finally {
			setIsTagSubmitting(false);
		}
	}

	function beginEditTag(tag: Tag): void {
		setTagFormError(null);
		setEditingTagId(tag.tag_id);
		setEditingTagName(tag.tag_name);
	}

	function cancelEditTag(): void {
		setEditingTagId(null);
		setEditingTagName('');
	}

	async function handleSaveTagEdit(tagId: number): Promise<void> {
		const tagName = editingTagName.trim();
		if (!tagName) {
			setTagFormError('Nama tag wajib diisi.');
			return;
		}

		setTagFormError(null);
		setIsTagSubmitting(true);

		try {
			const response = await updateTag(tagId, { tag_name: tagName });
			await refreshTags();
			cancelEditTag();
			setStatusMessage(response.message);
		} catch (error) {
			setTagFormError(getErrorMessage(error));
		} finally {
			setIsTagSubmitting(false);
		}
	}

	async function handleDeleteTag(tagId: number): Promise<void> {
		if (!window.confirm('Hapus tag ini?')) {
			return;
		}

		setTagFormError(null);
		setIsTagSubmitting(true);

		try {
			const response = await deleteTag(tagId);
			await refreshTags();
			setTagRelations((current) =>
				current.map((row) =>
					row.tagId === String(tagId)
						? {
								...row,
								tagId: '',
								tagValue: '',
							}
						: row,
				),
			);
			if (editingTagId === tagId) {
				cancelEditTag();
			}
			setStatusMessage(response.message);
		} catch (error) {
			setTagFormError(getErrorMessage(error));
		} finally {
			setIsTagSubmitting(false);
		}
	}

	function closeModal(): void {
		if (isSubmitting) {
			return;
		}

		setModalState(null);
		setFormError(null);
		setTagFormError(null);
		setTagRelationError(null);
	}

	async function handleAddSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setFormError(null);

		const point = parsePointInput(formState.point);
		const description = formState.description.trim();
		const preparedRelations = prepareActivityTagRelations(tagRelations);

		if (point === null) {
			setFormError('Point harus berupa angka yang valid.');
			return;
		}

		if (!description) {
			setFormError('Nama aktivitas wajib diisi.');
			return;
		}

		if (preparedRelations.error) {
			setFormError(preparedRelations.error);
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await createActivity({
				activity_date: selectedDateKey,
				activity_point: point,
				activity_description: description,
			});

			let relationWarning: string | null = null;
			if (preparedRelations.data.length > 0) {
				try {
					await Promise.all(
						preparedRelations.data.map((relation) =>
							createActivityTag({
								activity_tag_date: selectedDateKey,
								activity_id: response.data.activity_id,
								tag_id: relation.tagId,
								tag_value: relation.tagValue,
							}),
						),
					);
				} catch (error) {
					relationWarning = getErrorMessage(error);
				}
			}

			await refreshActivities();
			setStatusMessage(
				relationWarning
					? `${response.message} Namun relasi tag belum sepenuhnya tersimpan: ${relationWarning}`
					: response.message,
			);
			setModalState(null);
			setFormState({ point: '1', description: '' });
			setTagRelations([createEmptyTagRelation()]);
			setInitialTagRelationIds([]);
		} catch (error) {
			setFormError(getErrorMessage(error));
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleEditSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setFormError(null);

		if (!activeActivity) {
			setFormError('Aktivitas tidak ditemukan.');
			return;
		}

		const point = parsePointInput(formState.point);
		const description = formState.description.trim();
		const preparedRelations = prepareActivityTagRelations(tagRelations);

		if (point === null) {
			setFormError('Point harus berupa angka yang valid.');
			return;
		}

		if (!description) {
			setFormError('Nama aktivitas wajib diisi.');
			return;
		}

		if (preparedRelations.error) {
			setFormError(preparedRelations.error);
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await updateActivity(activeActivity.activity_id, {
				activity_date: selectedDateKey,
				activity_point: point,
				activity_description: description,
			});

			const relationIdsInForm = preparedRelations.data
				.filter((relation) => relation.activityTagId !== null)
				.map((relation) => relation.activityTagId as number);

			const relationIdsToDelete = initialTagRelationIds.filter(
				(relationId) => !relationIdsInForm.includes(relationId),
			);

			if (relationIdsToDelete.length > 0) {
				await Promise.all(
					relationIdsToDelete.map((relationId) => deleteActivityTag(relationId)),
				);
			}

			if (preparedRelations.data.length > 0) {
				await Promise.all(
					preparedRelations.data.map((relation) => {
						const payload = {
							activity_tag_date: selectedDateKey,
							activity_id: activeActivity.activity_id,
							tag_id: relation.tagId,
							tag_value: relation.tagValue,
						};

						if (relation.activityTagId === null) {
							return createActivityTag(payload);
						}

						return updateActivityTag(relation.activityTagId, payload);
					}),
				);
			}

			await refreshActivities();
			setStatusMessage(response.message);
			setModalState(null);
			setActiveActivity(null);
			setTagRelations([createEmptyTagRelation()]);
			setInitialTagRelationIds([]);
		} catch (error) {
			setFormError(getErrorMessage(error));
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleDeleteConfirm(): Promise<void> {
		if (!activeActivity) {
			setFormError('Aktivitas tidak ditemukan.');
			return;
		}

		setIsSubmitting(true);
		setFormError(null);

		try {
			const response = await deleteActivity(activeActivity.activity_id);
			await refreshActivities();
			setStatusMessage(response.message);
			setModalState(null);
			setActiveActivity(null);
		} catch (error) {
			setFormError(getErrorMessage(error));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937_0%,_#0b0b0b_42%,_#040404_100%)] px-3 py-4 text-zinc-100 sm:px-8 sm:py-10">
			<section className="mx-auto flex w-full max-w-5xl flex-col gap-4 [font-family:var(--font-geist-sans)] sm:gap-5">
				<header className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur sm:p-5">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
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
									Detail Aktivitas Harian
								</h1>
								<p className="max-w-2xl text-xs text-zinc-300 sm:text-base">
									Aktivitas untuk tanggal terpilih ditarik langsung dari endpoint.
								</p>
							</div>
						</div>

						<div className="w-full rounded-2xl border border-cyan-700/60 bg-cyan-950/50 px-4 py-3 text-left sm:w-auto sm:text-right">
							<p className="text-xs uppercase tracking-wide text-cyan-200/75">
								Tanggal aktif
							</p>
							<p className="text-base font-semibold text-cyan-100 sm:text-lg">
								{compactDateFormatter.format(selectedDate)}
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
						<span>/</span>
						<span className="rounded-full border border-zinc-700 bg-zinc-800/70 px-3 py-1 text-zinc-200">
							Aktivitas Tanggal
						</span>
					</div>
				</header>

				<section className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-4 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)] backdrop-blur sm:p-5">
					<div className="flex items-center gap-3">
						<div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
							<button
								type="button"
								onClick={() => changeDate(addDays(selectedDate, -1))}
								className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-lg leading-none text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
								aria-label="Tanggal sebelumnya"
							>
								&lt;
							</button>
							<div className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-200 sm:min-w-72 sm:flex-none sm:px-4 sm:text-base">
								{longDateFormatter.format(selectedDate)}
							</div>
							<button
								type="button"
								onClick={() => changeDate(addDays(selectedDate, 1))}
								className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-lg leading-none text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
								aria-label="Tanggal berikutnya"
							>
								&gt;
							</button>
						</div>
					</div>

					<div className="mt-4">
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
							<div className="rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 py-2">
								<p className="text-[11px] font-semibold tracking-wide text-zinc-500">Positive</p>
								<p className="text-lg font-bold text-emerald-300">{formatSigned(positivePoint)}</p>
							</div>
							<div className="rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 py-2">
								<p className="text-[11px] font-semibold tracking-wide text-zinc-500">Negative</p>
								<p className="text-lg font-bold text-rose-300">{formatSigned(negativePoint)}</p>
							</div>
							<div className="rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 py-2">
								<p className="text-[11px] font-semibold tracking-wide text-zinc-500">Total</p>
								<p className="text-lg font-bold text-cyan-300">{formatSigned(totalPoint)}</p>
							</div>
							<div className="rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 py-2">
								<p className="text-[11px] font-semibold tracking-wide text-zinc-500">Target</p>
								<p className="text-lg font-bold text-zinc-100">{TARGET_POINT}</p>
							</div>
							<div className="col-span-2 rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 py-2 sm:col-span-1">
								<p className="text-[11px] font-semibold tracking-wide text-zinc-500">Selisih</p>
								<p className={`text-lg font-bold ${pointDiffTextClass}`}>{formatSigned(pointDiff)}</p>
							</div>
						</div>
					</div>

					{statusMessage ? (
						<p className="mt-3 rounded-xl border border-emerald-700/60 bg-emerald-900/35 px-4 py-2 text-sm text-emerald-200">
							{statusMessage}
						</p>
					) : null}

					{loadError ? (
						<div className="mt-3 rounded-xl border border-amber-700/70 bg-amber-900/30 p-4 text-sm text-amber-200">
							<p>{loadError}</p>
							<button
								type="button"
								onClick={() => {
									void retryLoadActivities();
								}}
								className="mt-2 rounded-lg border border-amber-500/60 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-800/45"
							>
								Coba Lagi
							</button>
						</div>
					) : null}
				</section>

				<section className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-4 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)] backdrop-blur sm:p-5">
					<div className="max-h-[24rem] overflow-y-auto pr-1 [scrollbar-color:#52525b_transparent] sm:max-h-[30rem]">
						{isLoading ? (
							<div className="space-y-3">
								{Array.from({ length: 6 }, (_, index) => (
									<div
										key={`skeleton-${index}`}
										className="h-16 animate-pulse rounded-2xl border border-zinc-700 bg-zinc-800/50"
									/>
								))}
							</div>
						) : activities.length === 0 ? (
							<div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-6 text-center text-sm text-zinc-400">
								Belum ada aktivitas untuk tanggal ini.
							</div>
						) : (
							activities.map((activity, index) => {
								const activityToneClass =
									activity.activity_point > 0
										? 'border-emerald-900/40 bg-emerald-950/20 hover:border-emerald-600/40'
										: activity.activity_point < 0
											? 'border-rose-900/40 bg-rose-950/20 hover:border-rose-600/40'
											: 'border-zinc-700 bg-zinc-950/65 hover:border-zinc-500';

								const pointToneClass =
									activity.activity_point > 0
										? 'border-emerald-600/70 bg-emerald-900/35 text-emerald-200'
										: activity.activity_point < 0
											? 'border-rose-600/70 bg-rose-900/35 text-rose-200'
											: 'border-zinc-600 bg-zinc-800 text-zinc-200';

								return (
									<article
										key={activity.activity_id}
										className={`mb-3 rounded-2xl border p-3 transition hover:-translate-y-0.5 ${activityToneClass}`}
										style={{
											animation: 'fadeSlideIn 360ms ease-out both',
											animationDelay: `${index * 30}ms`,
										}}
									>
										<div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3">
											<span
												className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold sm:px-3 sm:py-2 sm:text-sm ${pointToneClass}`}
											>
												{formatSigned(activity.activity_point)}
											</span>

											<p className="truncate rounded-xl bg-zinc-700/70 px-3 py-2 text-sm font-medium text-zinc-100 sm:rounded-full sm:py-1 sm:text-base">
												{activity.activity_description}
											</p>

											<div className="flex items-center gap-1.5 sm:gap-2">
												<button
													type="button"
													onClick={() => openEditModal(activity)}
													className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-700"
													aria-label="Edit aktivitas"
													title="Edit aktivitas"
												>
													<svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
														<path
															d="M13.75 3.75a1.768 1.768 0 1 1 2.5 2.5L8 14.5 4.5 15.5 5.5 12l8.25-8.25Z"
															stroke="currentColor"
															strokeWidth="1.5"
															strokeLinecap="round"
															strokeLinejoin="round"
														/>
													</svg>
												</button>
												<button
													type="button"
													onClick={() => openDeleteModal(activity)}
													className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-200 transition hover:border-rose-500 hover:bg-rose-900/45"
													aria-label="Hapus aktivitas"
													title="Hapus aktivitas"
												>
													<svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
														<path
															d="M3.75 5.5h12.5M8 2.75h4M7 8.25v6m3-6v6m3-6v6M5.5 5.5l.75 10.25a1 1 0 0 0 1 .92h5.5a1 1 0 0 0 1-.92L14.5 5.5"
															stroke="currentColor"
															strokeWidth="1.5"
															strokeLinecap="round"
															strokeLinejoin="round"
														/>
													</svg>
												</button>
											</div>
										</div>
									</article>
								);
							})
						)}
					</div>

					<div className="mt-4 flex items-center justify-end gap-2">
						<button
							type="button"
							onClick={openTagModal}
							className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-100 transition hover:border-cyan-500 hover:bg-cyan-900/40"
							aria-label="Kelola tag"
							title="Kelola tag"
						>
							<svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
								<path
									d="M3.25 8.75V4.75A1.5 1.5 0 0 1 4.75 3.25h4L16.75 11.25a2.121 2.121 0 1 1-3 3l-8-8ZM6.25 6.25h.01"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							<span className="sr-only">Kelola Tag</span>
						</button>

						<button
							type="button"
							onClick={openAddModal}
							className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-100 transition hover:border-emerald-500 hover:bg-emerald-900/45"
							aria-label="Tambah aktivitas"
							title="Tambah aktivitas baru"
						>
							<svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
								<path
									d="M10 4.25v11.5M4.25 10h11.5"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="round"
								/>
							</svg>
							<span className="sr-only">Tambah Aktivitas</span>
						</button>
					</div>
				</section>
			</section>

			{modalState === 'add' ? (
				<ModalFrame
					title="Tambah Aktivitas"
					subtitle={`Tanggal: ${compactDateFormatter.format(selectedDate)}`}
					onClose={closeModal}
					disableClose={isSubmitting}
				>
					<form className="space-y-3" onSubmit={handleAddSubmit}>
						<label className="block text-sm text-zinc-300">
							<span className="mb-1 block">Point</span>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => adjustFormPoint(-1)}
									disabled={isSubmitting}
									className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-base font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
									aria-label="Kurangi point"
								>
									-
								</button>
								<input
									type="number"
									value={formState.point}
									onChange={(event) =>
										setFormState((current) => ({
											...current,
											point: event.target.value,
										}))
									}
									className="w-24 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
									required
								/>
								<button
									type="button"
									onClick={() => adjustFormPoint(1)}
									disabled={isSubmitting}
									className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-base font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
									aria-label="Tambah point"
								>
									+
								</button>
							</div>
						</label>

						<div className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-3">
							<div className="flex items-center justify-between gap-2">
								<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
									Tag Aktivitas
								</p>
								<button
									type="button"
									onClick={addTagRelationRow}
									disabled={isSubmitting || isTagsLoading}
									className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
								>
									+ Tag
								</button>
							</div>

							{tagsError ? (
								<p className="mt-2 text-xs text-amber-300">{tagsError}</p>
							) : null}

							{isTagsLoading ? (
								<p className="mt-2 text-xs text-zinc-400">Memuat daftar tag...</p>
							) : null}

							{isTagRelationsLoading ? (
								<p className="mt-2 text-xs text-zinc-400">Memuat relasi tag...</p>
							) : null}

							{!isTagsLoading && tags.length === 0 ? (
								<p className="mt-2 text-xs text-zinc-400">
									Belum ada tag. Tambahkan dulu lewat tombol kelola tag.
								</p>
							) : null}

							{!isTagRelationsLoading
								? tagRelations.map((relation, index) => (
										<div
											key={`add-tag-relation-${index}`}
											className="mt-2 grid grid-cols-[1fr_7.25rem_auto] gap-2"
										>
											<select
												value={relation.tagId}
												onChange={(event) =>
													updateTagRelationRow(index, {
														tagId: event.target.value,
													})
												}
												disabled={isSubmitting || isTagsLoading || tags.length === 0}
												className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
											>
												<option value="">Pilih tag</option>
												{tags.map((tag) => (
													<option key={tag.tag_id} value={tag.tag_id}>
														{tag.tag_name}
													</option>
												))}
											</select>

											<input
												type="number"
												step="any"
												value={relation.tagValue}
												onChange={(event) =>
													updateTagRelationRow(index, {
														tagValue: event.target.value,
													})
												}
												disabled={isSubmitting}
												placeholder="Value"
												className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-xs text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
											/>

											<button
												type="button"
												onClick={() => removeTagRelationRow(index)}
												disabled={isSubmitting}
												className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-200 transition hover:border-rose-500 hover:bg-rose-900/45 disabled:cursor-not-allowed disabled:opacity-60"
												aria-label="Hapus baris relasi tag"
											>
												x
											</button>
										</div>
									))
								: null}

							{tagRelationError ? (
								<p className="mt-2 text-xs text-rose-300">{tagRelationError}</p>
							) : null}
						</div>

						<label className="block text-sm text-zinc-300">
							<span className="mb-1 block">Nama Aktivitas</span>
							<input
								type="text"
								value={formState.description}
								onChange={(event) =>
									setFormState((current) => ({
										...current,
										description: event.target.value,
									}))
								}
								className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
								required
							/>
						</label>

						{formError ? (
							<p className="rounded-xl border border-rose-700/60 bg-rose-900/35 px-3 py-2 text-sm text-rose-200">
								{formError}
							</p>
						) : null}

						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full rounded-xl border border-emerald-700/70 bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-800/50 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isSubmitting ? 'Menyimpan...' : 'Simpan Aktivitas'}
						</button>
					</form>
				</ModalFrame>
			) : null}

			{modalState === 'edit' ? (
				<ModalFrame
					title="Edit Aktivitas"
					subtitle={`Tanggal: ${compactDateFormatter.format(selectedDate)}`}
					onClose={closeModal}
					disableClose={isSubmitting}
				>
					<form className="space-y-3" onSubmit={handleEditSubmit}>
						<label className="block text-sm text-zinc-300">
							<span className="mb-1 block">Point (C)</span>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => adjustFormPoint(-1)}
									disabled={isSubmitting}
									className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-base font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
									aria-label="Kurangi point"
								>
									-
								</button>
								<input
									type="number"
									value={formState.point}
									onChange={(event) =>
										setFormState((current) => ({
											...current,
											point: event.target.value,
										}))
									}
									className="w-24 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
									required
								/>
								<button
									type="button"
									onClick={() => adjustFormPoint(1)}
									disabled={isSubmitting}
									className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-base font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
									aria-label="Tambah point"
								>
									+
								</button>
							</div>
						</label>

						<div className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-3">
							<div className="flex items-center justify-between gap-2">
								<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
									Tag Aktivitas
								</p>
								<button
									type="button"
									onClick={addTagRelationRow}
									disabled={isSubmitting || isTagsLoading || isTagRelationsLoading}
									className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
								>
									+ Tag
								</button>
							</div>

							{tagsError ? (
								<p className="mt-2 text-xs text-amber-300">{tagsError}</p>
							) : null}

							{isTagsLoading ? (
								<p className="mt-2 text-xs text-zinc-400">Memuat daftar tag...</p>
							) : null}

							{isTagRelationsLoading ? (
								<p className="mt-2 text-xs text-zinc-400">Memuat relasi tag...</p>
							) : null}

							{!isTagsLoading && tags.length === 0 ? (
								<p className="mt-2 text-xs text-zinc-400">
									Belum ada tag. Tambahkan dulu lewat tombol kelola tag.
								</p>
							) : null}

							{!isTagRelationsLoading
								? tagRelations.map((relation, index) => (
										<div
											key={`edit-tag-relation-${index}`}
											className="mt-2 grid grid-cols-[1fr_7.25rem_auto] gap-2"
										>
											<select
												value={relation.tagId}
												onChange={(event) =>
													updateTagRelationRow(index, {
														tagId: event.target.value,
													})
												}
												disabled={isSubmitting || isTagsLoading || tags.length === 0}
												className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
											>
												<option value="">Pilih tag</option>
												{tags.map((tag) => (
													<option key={tag.tag_id} value={tag.tag_id}>
														{tag.tag_name}
													</option>
												))}
											</select>

											<input
												type="number"
												step="any"
												value={relation.tagValue}
												onChange={(event) =>
													updateTagRelationRow(index, {
														tagValue: event.target.value,
													})
												}
												disabled={isSubmitting}
												placeholder="Value"
												className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-xs text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
											/>

											<button
												type="button"
												onClick={() => removeTagRelationRow(index)}
												disabled={isSubmitting || isTagRelationsLoading}
												className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-200 transition hover:border-rose-500 hover:bg-rose-900/45 disabled:cursor-not-allowed disabled:opacity-60"
												aria-label="Hapus baris relasi tag"
											>
												x
											</button>
										</div>
									))
								: null}

							{tagRelationError ? (
								<p className="mt-2 text-xs text-rose-300">{tagRelationError}</p>
							) : null}
						</div>

						<label className="block text-sm text-zinc-300">
							<span className="mb-1 block">Nama Aktivitas</span>
							<input
								type="text"
								value={formState.description}
								onChange={(event) =>
									setFormState((current) => ({
										...current,
										description: event.target.value,
									}))
								}
								className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
								required
							/>
						</label>

						{formError ? (
							<p className="rounded-xl border border-rose-700/60 bg-rose-900/35 px-3 py-2 text-sm text-rose-200">
								{formError}
							</p>
						) : null}

						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full rounded-xl border border-cyan-700/70 bg-cyan-900/40 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-800/50 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isSubmitting ? 'Memperbarui...' : 'Simpan Perubahan'}
						</button>
					</form>
				</ModalFrame>
			) : null}

			{modalState === 'tags' ? (
				<ModalFrame
					title="Kelola Tag"
					subtitle="Tambah, ubah, atau hapus tag aktivitas"
					onClose={closeModal}
					disableClose={isTagSubmitting}
				>
					<div className="space-y-4">
						<form className="flex items-center gap-2" onSubmit={handleCreateTagSubmit}>
							<input
								type="text"
								value={tagFormName}
								onChange={(event) => setTagFormName(event.target.value)}
								placeholder="Nama tag"
								disabled={isTagSubmitting}
								className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
							/>
							<button
								type="submit"
								disabled={isTagSubmitting}
								className="rounded-xl border border-cyan-700/70 bg-cyan-900/40 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/50 disabled:cursor-not-allowed disabled:opacity-60"
							>
								Tambah
							</button>
						</form>

						{tagFormError ? (
							<p className="rounded-xl border border-rose-700/60 bg-rose-900/35 px-3 py-2 text-sm text-rose-200">
								{tagFormError}
							</p>
						) : null}

						{tagsError ? (
							<p className="rounded-xl border border-amber-700/60 bg-amber-900/35 px-3 py-2 text-sm text-amber-200">
								{tagsError}
							</p>
						) : null}

						{isTagsLoading ? (
							<p className="text-sm text-zinc-400">Memuat daftar tag...</p>
						) : tags.length === 0 ? (
							<div className="rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-4 text-center text-sm text-zinc-400">
								Belum ada tag.
							</div>
						) : (
							<div className="max-h-72 space-y-2 overflow-y-auto pr-1">
								{tags.map((tag) => (
									<div
										key={tag.tag_id}
										className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-3"
									>
										{editingTagId === tag.tag_id ? (
											<div className="space-y-2">
												<input
													type="text"
													value={editingTagName}
													onChange={(event) => setEditingTagName(event.target.value)}
													disabled={isTagSubmitting}
													className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
												/>
												<div className="flex items-center justify-end gap-2">
													<button
														type="button"
														onClick={cancelEditTag}
														disabled={isTagSubmitting}
														className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
													>
														Batal
													</button>
													<button
														type="button"
														onClick={() => {
															void handleSaveTagEdit(tag.tag_id);
														}}
														disabled={isTagSubmitting}
														className="rounded-lg border border-cyan-700/70 bg-cyan-900/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/50 disabled:cursor-not-allowed disabled:opacity-60"
													>
														Simpan
													</button>
												</div>
											</div>
										) : (
											<div className="flex items-center justify-between gap-2">
												<p className="text-sm font-medium text-zinc-100">{tag.tag_name}</p>
												<div className="flex items-center gap-2">
													<button
														type="button"
														onClick={() => beginEditTag(tag)}
														disabled={isTagSubmitting}
														className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
													>
														Edit
													</button>
													<button
														type="button"
														onClick={() => {
															void handleDeleteTag(tag.tag_id);
														}}
														disabled={isTagSubmitting}
														className="rounded-lg border border-rose-700/70 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/45 disabled:cursor-not-allowed disabled:opacity-60"
													>
														Hapus
													</button>
												</div>
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				</ModalFrame>
			) : null}

			{modalState === 'delete' ? (
				<ModalFrame
					title="Hapus Aktivitas"
					subtitle="Data yang dihapus tidak bisa dikembalikan"
					onClose={closeModal}
					disableClose={isSubmitting}
				>
					<div className="space-y-4">
						<p className="rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-300">
							{activeActivity?.activity_description ?? '-'}
						</p>

						{formError ? (
							<p className="rounded-xl border border-rose-700/60 bg-rose-900/35 px-3 py-2 text-sm text-rose-200">
								{formError}
							</p>
						) : null}

						<button
							type="button"
							onClick={handleDeleteConfirm}
							disabled={isSubmitting}
							className="w-full rounded-xl border border-rose-700/70 bg-rose-900/45 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-800/50 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isSubmitting ? 'Menghapus...' : 'Ya, Hapus Aktivitas'}
						</button>
					</div>
				</ModalFrame>
			) : null}

			<style jsx>{`
				@keyframes fadeSlideIn {
					from {
						opacity: 0;
						transform: translateY(8px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
			`}</style>
		</main>
	);
}
