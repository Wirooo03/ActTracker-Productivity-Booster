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
import type {
	Activity,
	Group,
	Tag,
	TagGroup,
	Template,
	TemplateTagInputPayload,
} from '@/lib/api/types';
import { activitiesService } from '@/services/activitiesService';
import { activityTagsService } from '@/services/activityTagsService';
import { groupsService } from '@/services/groupsService';
import { tagGroupsService } from '@/services/tagGroupsService';
import { tagsService } from '@/services/tagsService';
import { templatesService } from '@/services/templatesService';

const TARGET_POINT = 120;

type ModalState =
	| 'add'
	| 'edit'
	| 'delete'
	| 'tags'
	| 'templates'
	| 'tag-groups'
	| 'activity-to-template'
	| null;

type ActivityCreateMode = 'custom' | 'template';

type TagPickerTarget = 'group' | 'tag';

type TagPickerContext = {
	rowIndex: number;
	target: TagPickerTarget;
} | null;

type ActivityFormState = {
	point: string;
	description: string;
};

type ActivityTagFormState = {
	activityTagId: number | null;
	groupId: string;
	tagId: string;
	tagValue: string;
};

type PreparedActivityTagRelation = {
	activityTagId: number | null;
	tagId: number;
	tagValue: number | null;
};

type TemplateTagDraftState = {
	tagId: string;
	points: string;
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

function normalizeGroups(data: Group[]): Group[] {
	return [...data].sort((left, right) => {
		const nameCompare = left.group_name.localeCompare(right.group_name, 'id-ID', {
			sensitivity: 'base',
		});

		if (nameCompare !== 0) {
			return nameCompare;
		}

		return left.group_id - right.group_id;
	});
}

function normalizeTagGroups(data: TagGroup[]): TagGroup[] {
	return [...data].sort((left, right) => {
		if (left.group_id === right.group_id) {
			if (left.tag_id === right.tag_id) {
				return left.tag_groups_id - right.tag_groups_id;
			}

			return left.tag_id - right.tag_id;
		}

		return left.group_id - right.group_id;
	});
}

function normalizeTemplates(data: Template[]): Template[] {
	return [...data].sort((left, right) => {
		const nameCompare = left.template_name.localeCompare(right.template_name, 'id-ID', {
			sensitivity: 'base',
		});

		if (nameCompare !== 0) {
			return nameCompare;
		}

		return left.template_id - right.template_id;
	});
}

function createEmptyTagRelation(): ActivityTagFormState {
	return {
		activityTagId: null,
		groupId: 'all',
		tagId: '',
		tagValue: '',
	};
}

function createEmptyTemplateTagDraft(): TemplateTagDraftState {
	return {
		tagId: '',
		points: '',
	};
}

function parseOptionalNumberInput(rawValue: string): number | undefined | null {
	const trimmed = rawValue.trim();
	if (!trimmed) {
		return undefined;
	}

	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed)) {
		return null;
	}

	return parsed;
}

function getTagsForGroup(
	groupId: string,
	tags: Tag[],
	tagIdsByGroupId: Map<number, Set<number>>,
): Tag[] {
	if (groupId === 'all') {
		return tags;
	}

	const parsedGroupId = Number(groupId);
	if (!Number.isInteger(parsedGroupId) || parsedGroupId < 1) {
		return tags;
	}

	const allowedTagIds = tagIdsByGroupId.get(parsedGroupId);
	if (!allowedTagIds) {
		return [];
	}

	return tags.filter((tag) => allowedTagIds.has(tag.tag_id));
}

function prepareTemplateTagPayload(
	rows: TemplateTagDraftState[],
): { data: TemplateTagInputPayload[]; error: string | null } {
	const prepared: TemplateTagInputPayload[] = [];
	const usedTagIds = new Set<number>();

	for (const row of rows) {
		const rawTagId = row.tagId.trim();
		const rawPoints = row.points.trim();

		if (!rawTagId && !rawPoints) {
			continue;
		}

		if (!rawTagId) {
			return {
				data: [],
				error: 'Tag wajib dipilih saat mengisi points template.',
			};
		}

		if (!rawPoints) {
			return {
				data: [],
				error: 'Points template wajib diisi saat tag dipilih.',
			};
		}

		const tagId = Number(rawTagId);
		if (!Number.isInteger(tagId) || tagId < 1) {
			return {
				data: [],
				error: 'Tag template tidak valid.',
			};
		}

		if (usedTagIds.has(tagId)) {
			return {
				data: [],
				error: 'Tag template tidak boleh duplikat.',
			};
		}

		const points = Number(rawPoints);
		if (!Number.isFinite(points)) {
			return {
				data: [],
				error: 'Points template harus berupa angka valid.',
			};
		}

		usedTagIds.add(tagId);
		prepared.push({
			tag_id: tagId,
			points,
		});
	}

	return {
		data: prepared,
		error: null,
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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
			<div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-900 p-3.5 shadow-[0_20px_45px_-15px_rgba(0,0,0,0.85)] sm:p-4">
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
				<div className="mt-4">{children}</div>
			</div>
		</div>
	);
}

type TagRelationEditorProps = {
	rows: ActivityTagFormState[];
	groups: Group[];
	tags: Tag[];
	tagIdsByGroupId: Map<number, Set<number>>;
	tagsError: string | null;
	tagRelationError: string | null;
	isTagsLoading: boolean;
	isTagRelationsLoading: boolean;
	isSubmitting: boolean;
	activePicker: TagPickerContext;
	pickerSearchQuery: string;
	onPickerSearchQueryChange: (value: string) => void;
	onPickerOpen: (rowIndex: number, target: TagPickerTarget) => void;
	onPickerClose: () => void;
	onAddRow: () => void;
	onUpdateRow: (index: number, patch: Partial<ActivityTagFormState>) => void;
	onUpdateGroup: (index: number, groupId: string) => void;
	onRemoveRow: (index: number) => void;
};

function TagRelationEditor({
	rows,
	groups,
	tags,
	tagIdsByGroupId,
	tagsError,
	tagRelationError,
	isTagsLoading,
	isTagRelationsLoading,
	isSubmitting,
	activePicker,
	pickerSearchQuery,
	onPickerSearchQueryChange,
	onPickerOpen,
	onPickerClose,
	onAddRow,
	onUpdateRow,
	onUpdateGroup,
	onRemoveRow,
}: TagRelationEditorProps) {
	const normalizedPickerSearchQuery = pickerSearchQuery.trim().toLowerCase();

	return (
		<div className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-3">
			<div className="flex items-center justify-between gap-2">
				<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Tag Aktivitas</p>
				<button
					type="button"
					onClick={onAddRow}
					disabled={isSubmitting || isTagsLoading || isTagRelationsLoading}
					className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
				>
					+ Tag
				</button>
			</div>

			{tagsError ? <p className="mt-2 text-xs text-amber-300">{tagsError}</p> : null}

			{isTagsLoading ? <p className="mt-2 text-xs text-zinc-400">Memuat daftar tag...</p> : null}

			{isTagRelationsLoading ? <p className="mt-2 text-xs text-zinc-400">Memuat relasi tag...</p> : null}

			{!isTagsLoading && tags.length === 0 ? (
				<p className="mt-2 text-xs text-zinc-400">Belum ada tag. Tambahkan dulu lewat tombol kelola tag.</p>
			) : null}

			{!isTagRelationsLoading
				? rows.map((relation, index) => {
					const isPickerActive = activePicker?.rowIndex === index;
					const isGroupPickerActive = isPickerActive && activePicker?.target === 'group';
					const isTagPickerActive = isPickerActive && activePicker?.target === 'tag';

					const baseGroups = groups;
					const filteredGroups =
						isGroupPickerActive && normalizedPickerSearchQuery
							? baseGroups.filter((group) =>
									group.group_name.toLowerCase().includes(normalizedPickerSearchQuery),
							)
							: baseGroups;

					const baseTags = getTagsForGroup(relation.groupId, tags, tagIdsByGroupId);
					const filteredTags =
						isTagPickerActive && normalizedPickerSearchQuery
							? baseTags.filter((tag) =>
									tag.tag_name.toLowerCase().includes(normalizedPickerSearchQuery),
							)
							: baseTags;

					const searchResultCount = isGroupPickerActive
						? filteredGroups.length
						: isTagPickerActive
							? filteredTags.length
							: 0;

					const searchTotalCount = isGroupPickerActive
						? baseGroups.length
						: isTagPickerActive
							? baseTags.length
							: 0;

					return (
						<div key={`tag-relation-row-${index}`} className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/45 p-2">
							<div className="grid grid-cols-[1fr_1fr_6.5rem_auto] gap-2">
								<select
									value={relation.groupId}
									onChange={(event) => onUpdateGroup(index, event.target.value)}
									onFocus={() => onPickerOpen(index, 'group')}
									onMouseDown={() => onPickerOpen(index, 'group')}
									disabled={isSubmitting || isTagsLoading}
									className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
									title="Group tag"
								>
									<option value="all">All Tag</option>
									{filteredGroups.map((group) => (
										<option key={group.group_id} value={group.group_id}>
											{group.group_name}
										</option>
									))}
								</select>

								<select
									value={relation.tagId}
									onChange={(event) =>
										onUpdateRow(index, {
											tagId: event.target.value,
										})
									}
									onFocus={() => onPickerOpen(index, 'tag')}
									onMouseDown={() => onPickerOpen(index, 'tag')}
									disabled={isSubmitting || isTagsLoading || tags.length === 0}
									className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
									title="Tag"
								>
									<option value="">Pilih tag</option>
									{filteredTags.map((tag) => (
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
										onUpdateRow(index, {
											tagValue: event.target.value,
										})
									}
									disabled={isSubmitting}
									placeholder="Value"
									className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-xs text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
								/>

								<button
									type="button"
									onClick={() => onRemoveRow(index)}
									disabled={isSubmitting || isTagRelationsLoading}
									className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-200 transition hover:border-rose-500 hover:bg-rose-900/45 disabled:cursor-not-allowed disabled:opacity-60"
									aria-label="Hapus baris relasi tag"
								>
									x
								</button>
							</div>

							{isPickerActive ? (
								<div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-950/70 p-2">
									<div className="flex items-center justify-between gap-2">
										<p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
											Cari {isGroupPickerActive ? 'Group Tag' : 'Tag'}
										</p>
										<button
											type="button"
											onClick={onPickerClose}
											className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800"
										>
											Tutup Search
										</button>
									</div>

									<input
										type="text"
										value={pickerSearchQuery}
										onChange={(event) => onPickerSearchQueryChange(event.target.value)}
										placeholder={isGroupPickerActive ? 'Cari group...' : 'Cari tag...'}
										className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 outline-none transition focus:border-cyan-500"
									/>

									{normalizedPickerSearchQuery ? (
										<p className="mt-2 text-xs text-zinc-400">
											Menampilkan {searchResultCount} dari {searchTotalCount} pilihan.
										</p>
									) : null}
								</div>
							) : null}
						</div>
					);
				})
				: null}

			{tagRelationError ? <p className="mt-2 text-xs text-rose-300">{tagRelationError}</p> : null}
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
	const [addMode, setAddMode] = useState<ActivityCreateMode>('custom');
	const [selectedTemplateId, setSelectedTemplateId] = useState('');
	const [templateOverrideDescription, setTemplateOverrideDescription] = useState('');
	const [templateOverridePoint, setTemplateOverridePoint] = useState('');
	const [templates, setTemplates] = useState<Template[]>([]);
	const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
	const [templatesError, setTemplatesError] = useState<string | null>(null);
	const [templateFormName, setTemplateFormName] = useState('');
	const [templateSearchQuery, setTemplateSearchQuery] = useState('');
	const [templateFormError, setTemplateFormError] = useState<string | null>(null);
	const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
	const [editingTemplateName, setEditingTemplateName] = useState('');
	const [isTemplateSubmitting, setIsTemplateSubmitting] = useState(false);
	const [activityTemplateName, setActivityTemplateName] = useState('');
	const [activityTemplateRows, setActivityTemplateRows] = useState<TemplateTagDraftState[]>([]);
	const [activityTemplateError, setActivityTemplateError] = useState<string | null>(null);
	const [isActivityTemplateLoading, setIsActivityTemplateLoading] = useState(false);
	const [isActivityTemplateSubmitting, setIsActivityTemplateSubmitting] = useState(false);
	const [tags, setTags] = useState<Tag[]>([]);
	const [isTagsLoading, setIsTagsLoading] = useState(false);
	const [tagsError, setTagsError] = useState<string | null>(null);
	const [groups, setGroups] = useState<Group[]>([]);
	const [isGroupsLoading, setIsGroupsLoading] = useState(false);
	const [groupsError, setGroupsError] = useState<string | null>(null);
	const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
	const [isTagGroupsLoading, setIsTagGroupsLoading] = useState(false);
	const [tagGroupsError, setTagGroupsError] = useState<string | null>(null);
	const [groupFormName, setGroupFormName] = useState('');
	const [groupFormError, setGroupFormError] = useState<string | null>(null);
	const [groupSearchQuery, setGroupSearchQuery] = useState('');
	const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
	const [editingGroupName, setEditingGroupName] = useState('');
	const [isGroupSubmitting, setIsGroupSubmitting] = useState(false);
	const [tagGroupFormTagId, setTagGroupFormTagId] = useState('');
	const [tagGroupFormGroupId, setTagGroupFormGroupId] = useState('');
	const [tagGroupFormError, setTagGroupFormError] = useState<string | null>(null);
	const [tagGroupSearchQuery, setTagGroupSearchQuery] = useState('');
	const [editingTagGroupId, setEditingTagGroupId] = useState<number | null>(null);
	const [editingTagGroupTagId, setEditingTagGroupTagId] = useState('');
	const [editingTagGroupGroupId, setEditingTagGroupGroupId] = useState('');
	const [isTagGroupSubmitting, setIsTagGroupSubmitting] = useState(false);
	const [tagFormName, setTagFormName] = useState('');
	const [tagFormError, setTagFormError] = useState<string | null>(null);
	const [editingTagId, setEditingTagId] = useState<number | null>(null);
	const [editingTagName, setEditingTagName] = useState('');
	const [isTagSubmitting, setIsTagSubmitting] = useState(false);
	const [tagRelations, setTagRelations] = useState<ActivityTagFormState[]>([
		createEmptyTagRelation(),
	]);
	const [isTagRelationsLoading, setIsTagRelationsLoading] = useState(false);
	const [tagRelationError, setTagRelationError] = useState<string | null>(null);
	const [activeTagPicker, setActiveTagPicker] = useState<TagPickerContext>(null);
	const [activitySearchQuery, setActivitySearchQuery] = useState('');
	const [tagCrudSearchQuery, setTagCrudSearchQuery] = useState('');
	const [tagPickerSearchQuery, setTagPickerSearchQuery] = useState('');

	const groupNameById = useMemo(() => {
		const map = new Map<number, string>();
		for (const group of groups) {
			map.set(group.group_id, group.group_name);
		}

		return map;
	}, [groups]);

	const tagNameById = useMemo(() => {
		const map = new Map<number, string>();
		for (const tag of tags) {
			map.set(tag.tag_id, tag.tag_name);
		}

		return map;
	}, [tags]);

	const tagIdsByGroupId = useMemo(() => {
		const map = new Map<number, Set<number>>();

		for (const relation of tagGroups) {
			const current = map.get(relation.group_id);
			if (current) {
				current.add(relation.tag_id);
			} else {
				map.set(relation.group_id, new Set([relation.tag_id]));
			}
		}

		return map;
	}, [tagGroups]);

	const firstGroupIdByTagId = useMemo(() => {
		const map = new Map<number, string>();

		for (const relation of tagGroups) {
			if (!map.has(relation.tag_id)) {
				map.set(relation.tag_id, String(relation.group_id));
			}
		}

		return map;
	}, [tagGroups]);

	const effectiveSelectedTemplateId =
		selectedTemplateId || (templates.length > 0 ? String(templates[0].template_id) : '');

	async function refreshTags(): Promise<void> {
		setIsTagsLoading(true);
		setTagsError(null);

		try {
			const response = await tagsService.list({
				fields: ['tag_id', 'tag_name'],
			});
			setTags(normalizeTags(response.data));
		} catch (error) {
			setTagsError(getErrorMessage(error));
		} finally {
			setIsTagsLoading(false);
		}
	}

	async function refreshGroups(): Promise<void> {
		setIsGroupsLoading(true);
		setGroupsError(null);

		try {
			const response = await groupsService.list({
				fields: ['group_id', 'group_name'],
				per_page: 200,
			});
			setGroups(normalizeGroups(response.data));
		} catch (error) {
			setGroupsError(getErrorMessage(error));
		} finally {
			setIsGroupsLoading(false);
		}
	}

	async function refreshTagGroups(): Promise<void> {
		setIsTagGroupsLoading(true);
		setTagGroupsError(null);

		try {
			const response = await tagGroupsService.list({
				per_page: 200,
			});
			setTagGroups(normalizeTagGroups(response.data));
		} catch (error) {
			setTagGroupsError(getErrorMessage(error));
		} finally {
			setIsTagGroupsLoading(false);
		}
	}

	async function refreshTemplates(): Promise<void> {
		setIsTemplatesLoading(true);
		setTemplatesError(null);

		try {
			const response = await templatesService.list({
				include: ['template_tags', 'template_tags.tag'],
				per_page: 200,
			});
			setTemplates(normalizeTemplates(response.data));
		} catch (error) {
			setTemplatesError(getErrorMessage(error));
		} finally {
			setIsTemplatesLoading(false);
		}
	}

	async function loadActivityTagRelations(activityId: number): Promise<void> {
		setIsTagRelationsLoading(true);
		setTagRelationError(null);

		try {
			const response = await activityTagsService.list({
				activity_id: activityId,
				activity_tag_date: selectedDateKey,
				include: ['tag'],
				per_page: 200,
			});
			const relationRows = response.data
				.sort((left, right) => left.activity_tag_id - right.activity_tag_id);

			setTagRelations(
				relationRows.length > 0
					? relationRows.map((relation) => ({
							activityTagId: relation.activity_tag_id,
							groupId: firstGroupIdByTagId.get(relation.tag_id) ?? 'all',
							tagId: String(relation.tag_id),
							tagValue:
								relation.tag_value === null ? '' : String(relation.tag_value),
						}))
					: [createEmptyTagRelation()],
			);
		} catch (error) {
			setTagRelationError(getErrorMessage(error));
			setTagRelations([createEmptyTagRelation()]);
		} finally {
			setIsTagRelationsLoading(false);
		}
	}

	async function loadTemplateTagsFromActivity(activity: Activity): Promise<void> {
		setIsActivityTemplateLoading(true);
		setActivityTemplateError(null);

		try {
			const response = await activityTagsService.list({
				activity_id: activity.activity_id,
				per_page: 200,
			});

			const relationRows = response.data.sort((left, right) => left.activity_tag_id - right.activity_tag_id);

			setActivityTemplateRows(
				relationRows.length > 0
					? relationRows.map((relation) => ({
							tagId: String(relation.tag_id),
							points: String(
								relation.tag_value === null ? activity.activity_point : relation.tag_value,
							),
						}))
					: [createEmptyTemplateTagDraft()],
			);
		} catch (error) {
			setActivityTemplateRows([createEmptyTemplateTagDraft()]);
			setActivityTemplateError(getErrorMessage(error));
		} finally {
			setIsActivityTemplateLoading(false);
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

	function updateTagRelationGroup(index: number, groupId: string): void {
		setTagRelations((current) =>
			current.map((row, rowIndex) => {
				if (rowIndex !== index) {
					return row;
				}

				const nextRow: ActivityTagFormState = {
					...row,
					groupId,
				};

				const availableTags = getTagsForGroup(groupId, tags, tagIdsByGroupId);
				const selectedTagExists = availableTags.some((tag) => String(tag.tag_id) === nextRow.tagId);
				if (!selectedTagExists) {
					nextRow.tagId = '';
				}

				return nextRow;
			}),
		);
	}

	function removeTagRelationRow(index: number): void {
		setTagRelations((current) => {
			const next = current.filter((_, rowIndex) => rowIndex !== index);
			return next.length > 0 ? next : [createEmptyTagRelation()];
		});
	}

	function addActivityTemplateRow(): void {
		setActivityTemplateRows((current) => [...current, createEmptyTemplateTagDraft()]);
	}

	function updateActivityTemplateRow(
		index: number,
		patch: Partial<TemplateTagDraftState>,
	): void {
		setActivityTemplateRows((current) =>
			current.map((row, rowIndex) =>
				rowIndex === index ? { ...row, ...patch } : row,
			),
		);
	}

	function removeActivityTemplateRow(index: number): void {
		setActivityTemplateRows((current) => {
			const next = current.filter((_, rowIndex) => rowIndex !== index);
			return next.length > 0 ? next : [createEmptyTemplateTagDraft()];
		});
	}

	function openTagPickerSearch(index: number, target: TagPickerTarget): void {
		setActiveTagPicker({
			rowIndex: index,
			target,
		});
		setTagPickerSearchQuery('');
	}

	function closeTagPickerSearch(): void {
		setActiveTagPicker(null);
		setTagPickerSearchQuery('');
	}

	useEffect(() => {
		if (!rawDateParam || parsedDate) {
			return;
		}

		router.replace(`/me/win/${dateKey(today)}`);
	}, [parsedDate, rawDateParam, router, today]);

	useEffect(() => {
		void refreshTags();
		void refreshGroups();
		void refreshTagGroups();
		void refreshTemplates();
	}, []);

	useEffect(() => {
		setTagRelations((current) => {
			let changed = false;

			const next = current.map((row) => {
				let nextGroupId = row.groupId;
				if (
					nextGroupId !== 'all' &&
					!groups.some((group) => String(group.group_id) === nextGroupId)
				) {
					nextGroupId = 'all';
				}

				let nextTagId = row.tagId;
				if (nextTagId) {
					const availableTags = getTagsForGroup(nextGroupId, tags, tagIdsByGroupId);
					const selectedTagExists = availableTags.some((tag) => String(tag.tag_id) === nextTagId);
					if (!selectedTagExists) {
						nextTagId = '';
					}
				}

				if (nextGroupId !== row.groupId || nextTagId !== row.tagId) {
					changed = true;
					return {
						...row,
						groupId: nextGroupId,
						tagId: nextTagId,
					};
				}

				return row;
			});

			return changed ? next : current;
		});
	}, [groups, tagIdsByGroupId, tags]);

	useEffect(() => {
		let isCurrent = true;

		async function loadActivitiesForDate(): Promise<void> {
			setIsLoading(true);
			setLoadError(null);

			try {
				const response = await activitiesService.listByDate(selectedDateKey);
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
		setAddMode('custom');
		setSelectedTemplateId('');
		setTemplateOverrideDescription('');
		setTemplateOverridePoint('');
		setTemplateFormName('');
		setTemplateFormError(null);
		setTemplateSearchQuery('');
		setEditingTemplateId(null);
		setEditingTemplateName('');
		setIsTemplateSubmitting(false);
		setActivityTemplateName('');
		setActivityTemplateRows([createEmptyTemplateTagDraft()]);
		setActivityTemplateError(null);
		setIsActivityTemplateLoading(false);
		setIsActivityTemplateSubmitting(false);
		setGroupFormName('');
		setGroupFormError(null);
		setGroupSearchQuery('');
		setEditingGroupId(null);
		setEditingGroupName('');
		setIsGroupSubmitting(false);
		setTagGroupFormTagId('');
		setTagGroupFormGroupId('');
		setTagGroupFormError(null);
		setTagGroupSearchQuery('');
		setEditingTagGroupId(null);
		setEditingTagGroupTagId('');
		setEditingTagGroupGroupId('');
		setIsTagGroupSubmitting(false);
		setFormState({ point: '1', description: '' });
		setTagFormName('');
		setTagFormError(null);
		setEditingTagId(null);
		setEditingTagName('');
		setIsTagRelationsLoading(false);
		setTagRelationError(null);
		setTagRelations([createEmptyTagRelation()]);
		setActiveTagPicker(null);
		setActivitySearchQuery('');
		setTagCrudSearchQuery('');
		setTagPickerSearchQuery('');
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

	const normalizedActivitySearchQuery = activitySearchQuery.trim().toLowerCase();

	const filteredActivities = useMemo(() => {
		if (!normalizedActivitySearchQuery) {
			return activities;
		}

		return activities.filter((activity) =>
			activity.activity_description.toLowerCase().includes(normalizedActivitySearchQuery),
		);
	}, [activities, normalizedActivitySearchQuery]);

	const normalizedTagCrudSearchQuery = tagCrudSearchQuery.trim().toLowerCase();

	const filteredTagsForCrud = useMemo(() => {
		if (!normalizedTagCrudSearchQuery) {
			return tags;
		}

		return tags.filter((tag) =>
			tag.tag_name.toLowerCase().includes(normalizedTagCrudSearchQuery),
		);
	}, [normalizedTagCrudSearchQuery, tags]);

	const normalizedTemplateSearchQuery = templateSearchQuery.trim().toLowerCase();

	const filteredTemplates = useMemo(() => {
		if (!normalizedTemplateSearchQuery) {
			return templates;
		}

		return templates.filter((template) =>
			template.template_name.toLowerCase().includes(normalizedTemplateSearchQuery),
		);
	}, [normalizedTemplateSearchQuery, templates]);

	const normalizedGroupSearchQuery = groupSearchQuery.trim().toLowerCase();

	const filteredGroups = useMemo(() => {
		if (!normalizedGroupSearchQuery) {
			return groups;
		}

		return groups.filter((group) =>
			group.group_name.toLowerCase().includes(normalizedGroupSearchQuery),
		);
	}, [groups, normalizedGroupSearchQuery]);

	const normalizedTagGroupSearchQuery = tagGroupSearchQuery.trim().toLowerCase();

	const filteredTagGroups = useMemo(() => {
		if (!normalizedTagGroupSearchQuery) {
			return tagGroups;
		}

		return tagGroups.filter((relation) => {
			const groupName = groupNameById.get(relation.group_id) ?? `Group #${relation.group_id}`;
			const tagName = tagNameById.get(relation.tag_id) ?? `Tag #${relation.tag_id}`;
			return `${groupName} ${tagName}`.toLowerCase().includes(normalizedTagGroupSearchQuery);
		});
	}, [groupNameById, normalizedTagGroupSearchQuery, tagGroups, tagNameById]);

	const selectedTemplateForAdd = useMemo(() => {
		const templateId = Number(effectiveSelectedTemplateId);
		if (!Number.isInteger(templateId) || templateId < 1) {
			return null;
		}

		return templates.find((template) => template.template_id === templateId) ?? null;
	}, [effectiveSelectedTemplateId, templates]);

	const pointDiff = totalPoint - TARGET_POINT;
	const pointDiffTextClass = pointDiff < 0 ? 'text-rose-300' : 'text-emerald-300';

	async function refreshActivities(): Promise<void> {
		const response = await activitiesService.listByDate(selectedDateKey);
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
		setActiveTagPicker(null);
		setTagPickerSearchQuery('');
		setActiveActivity(null);
		setAddMode('custom');
		setSelectedTemplateId('');
		setTemplateOverrideDescription('');
		setTemplateOverridePoint('');
		setFormState({ point: '1', description: '' });
		setTagRelations([createEmptyTagRelation()]);
		setModalState('add');

		if (tags.length === 0 && !isTagsLoading) {
			void refreshTags();
		}

		if (groups.length === 0 && !isGroupsLoading) {
			void refreshGroups();
		}

		if (tagGroups.length === 0 && !isTagGroupsLoading) {
			void refreshTagGroups();
		}

		if (templates.length === 0 && !isTemplatesLoading) {
			void refreshTemplates();
		}
	}

	function openTagModal(): void {
		setStatusMessage(null);
		setTagFormError(null);
		setTagRelationError(null);
		setTagCrudSearchQuery('');
		setFormError(null);
		setEditingTagId(null);
		setEditingTagName('');
		setTagFormName('');
		setModalState('tags');

		if (tags.length === 0 && !isTagsLoading) {
			void refreshTags();
		}
	}

	function openTemplateModal(): void {
		setStatusMessage(null);
		setFormError(null);
		setTemplateFormError(null);
		setTemplateSearchQuery('');
		setTemplateFormName('');
		setEditingTemplateId(null);
		setEditingTemplateName('');
		setModalState('templates');

		if (templates.length === 0 && !isTemplatesLoading) {
			void refreshTemplates();
		}
	}

	function openTagGroupModal(): void {
		setStatusMessage(null);
		setFormError(null);
		setGroupFormError(null);
		setTagGroupFormError(null);
		setGroupSearchQuery('');
		setTagGroupSearchQuery('');
		setGroupFormName('');
		setTagGroupFormTagId('');
		setTagGroupFormGroupId('');
		setEditingGroupId(null);
		setEditingGroupName('');
		setEditingTagGroupId(null);
		setEditingTagGroupTagId('');
		setEditingTagGroupGroupId('');
		setModalState('tag-groups');

		if (groups.length === 0 && !isGroupsLoading) {
			void refreshGroups();
		}

		if (tags.length === 0 && !isTagsLoading) {
			void refreshTags();
		}

		if (tagGroups.length === 0 && !isTagGroupsLoading) {
			void refreshTagGroups();
		}
	}

	function openActivityToTemplateModal(activity: Activity): void {
		setStatusMessage(null);
		setFormError(null);
		setActivityTemplateError(null);
		setActiveActivity(activity);
		setActivityTemplateName(activity.activity_description.trim());
		setActivityTemplateRows([createEmptyTemplateTagDraft()]);
		setModalState('activity-to-template');

		if (tags.length === 0 && !isTagsLoading) {
			void refreshTags();
		}

		void loadTemplateTagsFromActivity(activity);
	}

	function openEditModal(activity: Activity): void {
		setStatusMessage(null);
		setFormError(null);
		setTagRelationError(null);
		setActiveTagPicker(null);
		setTagPickerSearchQuery('');
		setActiveActivity(activity);
		setFormState({
			point: String(activity.activity_point),
			description: activity.activity_description,
		});
		setTagRelations([createEmptyTagRelation()]);
		setModalState('edit');

		if (tags.length === 0 && !isTagsLoading) {
			void refreshTags();
		}

		if (groups.length === 0 && !isGroupsLoading) {
			void refreshGroups();
		}

		if (tagGroups.length === 0 && !isTagGroupsLoading) {
			void refreshTagGroups();
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
			const response = await tagsService.create({ tag_name: tagName });
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
			const response = await tagsService.update(tagId, { tag_name: tagName });
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
			const response = await tagsService.remove(tagId);
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
		const isBusy =
			isSubmitting ||
			isTagSubmitting ||
			isTemplateSubmitting ||
			isGroupSubmitting ||
			isTagGroupSubmitting ||
			isActivityTemplateLoading ||
			isActivityTemplateSubmitting;

		if (isBusy) {
			return;
		}

		setModalState(null);
		setFormError(null);
		setTagFormError(null);
		setTagRelationError(null);
		setTemplateFormError(null);
		setGroupFormError(null);
		setTagGroupFormError(null);
		setActivityTemplateError(null);
		setActiveTagPicker(null);
		setTagPickerSearchQuery('');
	}

	async function handleAddByTemplate(): Promise<void> {
		const templateId = Number(effectiveSelectedTemplateId);
		if (!Number.isInteger(templateId) || templateId < 1) {
			setFormError('Pilih template aktivitas yang valid.');
			return;
		}

		const parsedOverridePoint = parseOptionalNumberInput(templateOverridePoint);
		if (parsedOverridePoint === null) {
			setFormError('Point override template harus berupa angka valid.');
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await templatesService.createActivityFromTemplate(templateId, {
				activity_date: selectedDateKey,
				...(templateOverrideDescription.trim()
					? {
							activity_description: templateOverrideDescription.trim(),
						}
					: {}),
				...(parsedOverridePoint !== undefined
					? {
							activity_point: parsedOverridePoint,
						}
					: {}),
			});

			setActivities((current) => normalizeActivities([...current, response.data]));
			setStatusMessage(response.message);
			setModalState(null);
			setAddMode('custom');
			setSelectedTemplateId('');
			setTemplateOverrideDescription('');
			setTemplateOverridePoint('');
		} catch (error) {
			setFormError(getErrorMessage(error));
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleAddSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setFormError(null);

		if (addMode === 'template') {
			await handleAddByTemplate();
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

		const tagRelationsPayload = preparedRelations.data.map((relation) => ({
			tag_id: relation.tagId,
			tag_value: relation.tagValue,
			activity_tag_date: selectedDateKey,
		}));

		setIsSubmitting(true);

		try {
			const response = await activitiesService.create({
				activity_date: selectedDateKey,
				activity_point: point,
				activity_description: description,
				tag_relations: tagRelationsPayload,
			});

			setActivities((current) => normalizeActivities([...current, response.data]));
			setStatusMessage(response.message);
			setModalState(null);
			setFormState({ point: '1', description: '' });
			setTagRelations([createEmptyTagRelation()]);
		} catch (error) {
			setFormError(getErrorMessage(error));
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleCreateTemplateSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setTemplateFormError(null);

		const templateName = templateFormName.trim();
		if (!templateName) {
			setTemplateFormError('Nama template wajib diisi.');
			return;
		}

		setIsTemplateSubmitting(true);

		try {
			const response = await templatesService.create({
				template_name: templateName,
			});

			setTemplates((current) => normalizeTemplates([...current, response.data]));
			setTemplateFormName('');
			setStatusMessage(response.message);
		} catch (error) {
			setTemplateFormError(getErrorMessage(error));
		} finally {
			setIsTemplateSubmitting(false);
		}
	}

	function beginEditTemplate(template: Template): void {
		setTemplateFormError(null);
		setEditingTemplateId(template.template_id);
		setEditingTemplateName(template.template_name);
	}

	function cancelEditTemplate(): void {
		setEditingTemplateId(null);
		setEditingTemplateName('');
	}

	async function handleSaveTemplateEdit(templateId: number): Promise<void> {
		const templateName = editingTemplateName.trim();
		if (!templateName) {
			setTemplateFormError('Nama template wajib diisi.');
			return;
		}

		setTemplateFormError(null);
		setIsTemplateSubmitting(true);

		try {
			const response = await templatesService.update(templateId, {
				template_name: templateName,
			});

			setTemplates((current) =>
				normalizeTemplates(
					current.map((item) =>
						item.template_id === response.data.template_id ? response.data : item,
					),
				),
			);

			cancelEditTemplate();
			setStatusMessage(response.message);
		} catch (error) {
			setTemplateFormError(getErrorMessage(error));
		} finally {
			setIsTemplateSubmitting(false);
		}
	}

	async function handleDeleteTemplate(templateId: number): Promise<void> {
		if (!window.confirm('Hapus template ini?')) {
			return;
		}

		setTemplateFormError(null);
		setIsTemplateSubmitting(true);

		try {
			const response = await templatesService.remove(templateId);
			setTemplates((current) => current.filter((item) => item.template_id !== templateId));

			if (editingTemplateId === templateId) {
				cancelEditTemplate();
			}

			if (selectedTemplateId === String(templateId)) {
				setSelectedTemplateId('');
			}

			setStatusMessage(response.message);
		} catch (error) {
			setTemplateFormError(getErrorMessage(error));
		} finally {
			setIsTemplateSubmitting(false);
		}
	}

	async function handleCreateGroupSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setGroupFormError(null);

		const groupName = groupFormName.trim();
		if (!groupName) {
			setGroupFormError('Nama group wajib diisi.');
			return;
		}

		setIsGroupSubmitting(true);

		try {
			const response = await groupsService.create({
				group_name: groupName,
			});

			setGroups((current) => normalizeGroups([...current, response.data]));
			setGroupFormName('');
			setStatusMessage(response.message);
		} catch (error) {
			setGroupFormError(getErrorMessage(error));
		} finally {
			setIsGroupSubmitting(false);
		}
	}

	function beginEditGroup(group: Group): void {
		setGroupFormError(null);
		setEditingGroupId(group.group_id);
		setEditingGroupName(group.group_name);
	}

	function cancelEditGroup(): void {
		setEditingGroupId(null);
		setEditingGroupName('');
	}

	async function handleSaveGroupEdit(groupId: number): Promise<void> {
		const groupName = editingGroupName.trim();
		if (!groupName) {
			setGroupFormError('Nama group wajib diisi.');
			return;
		}

		setGroupFormError(null);
		setIsGroupSubmitting(true);

		try {
			const response = await groupsService.update(groupId, {
				group_name: groupName,
			});

			setGroups((current) =>
				normalizeGroups(
					current.map((item) =>
						item.group_id === response.data.group_id ? response.data : item,
					),
				),
			);

			cancelEditGroup();
			setStatusMessage(response.message);
		} catch (error) {
			setGroupFormError(getErrorMessage(error));
		} finally {
			setIsGroupSubmitting(false);
		}
	}

	async function handleDeleteGroup(groupId: number): Promise<void> {
		if (!window.confirm('Hapus group ini?')) {
			return;
		}

		setGroupFormError(null);
		setIsGroupSubmitting(true);

		try {
			const response = await groupsService.remove(groupId);
			setGroups((current) => current.filter((group) => group.group_id !== groupId));
			setTagGroups((current) =>
				current.filter((relation) => relation.group_id !== groupId),
			);

			if (editingGroupId === groupId) {
				cancelEditGroup();
			}

			setStatusMessage(response.message);
		} catch (error) {
			setGroupFormError(getErrorMessage(error));
		} finally {
			setIsGroupSubmitting(false);
		}
	}

	function beginEditTagGroup(relation: TagGroup): void {
		setTagGroupFormError(null);
		setEditingTagGroupId(relation.tag_groups_id);
		setEditingTagGroupTagId(String(relation.tag_id));
		setEditingTagGroupGroupId(String(relation.group_id));
	}

	function cancelEditTagGroup(): void {
		setEditingTagGroupId(null);
		setEditingTagGroupTagId('');
		setEditingTagGroupGroupId('');
	}

	function hasDuplicateTagGroup(tagId: number, groupId: number, excludeId?: number): boolean {
		return tagGroups.some((relation) => {
			if (excludeId !== undefined && relation.tag_groups_id === excludeId) {
				return false;
			}

			return relation.tag_id === tagId && relation.group_id === groupId;
		});
	}

	async function handleCreateTagGroupSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setTagGroupFormError(null);

		const tagId = Number(tagGroupFormTagId);
		const groupId = Number(tagGroupFormGroupId);

		if (!Number.isInteger(tagId) || tagId < 1) {
			setTagGroupFormError('Pilih tag yang valid.');
			return;
		}

		if (!Number.isInteger(groupId) || groupId < 1) {
			setTagGroupFormError('Pilih group yang valid.');
			return;
		}

		if (hasDuplicateTagGroup(tagId, groupId)) {
			setTagGroupFormError('Relasi tag-group sudah ada.');
			return;
		}

		setIsTagGroupSubmitting(true);

		try {
			const response = await tagGroupsService.create({
				tag_id: tagId,
				group_id: groupId,
			});

			setTagGroups((current) => normalizeTagGroups([...current, response.data]));
			setTagGroupFormTagId('');
			setTagGroupFormGroupId('');
			setStatusMessage(response.message);
		} catch (error) {
			setTagGroupFormError(getErrorMessage(error));
		} finally {
			setIsTagGroupSubmitting(false);
		}
	}

	async function handleSaveTagGroupEdit(tagGroupsId: number): Promise<void> {
		const tagId = Number(editingTagGroupTagId);
		const groupId = Number(editingTagGroupGroupId);

		if (!Number.isInteger(tagId) || tagId < 1) {
			setTagGroupFormError('Tag relasi harus valid.');
			return;
		}

		if (!Number.isInteger(groupId) || groupId < 1) {
			setTagGroupFormError('Group relasi harus valid.');
			return;
		}

		if (hasDuplicateTagGroup(tagId, groupId, tagGroupsId)) {
			setTagGroupFormError('Relasi tag-group sudah ada.');
			return;
		}

		setTagGroupFormError(null);
		setIsTagGroupSubmitting(true);

		try {
			const response = await tagGroupsService.update(tagGroupsId, {
				tag_id: tagId,
				group_id: groupId,
			});

			setTagGroups((current) =>
				normalizeTagGroups(
					current.map((item) =>
						item.tag_groups_id === response.data.tag_groups_id ? response.data : item,
					),
				),
			);

			cancelEditTagGroup();
			setStatusMessage(response.message);
		} catch (error) {
			setTagGroupFormError(getErrorMessage(error));
		} finally {
			setIsTagGroupSubmitting(false);
		}
	}

	async function handleDeleteTagGroup(tagGroupsId: number): Promise<void> {
		if (!window.confirm('Hapus relasi tag-group ini?')) {
			return;
		}

		setTagGroupFormError(null);
		setIsTagGroupSubmitting(true);

		try {
			const response = await tagGroupsService.remove(tagGroupsId);
			setTagGroups((current) =>
				current.filter((relation) => relation.tag_groups_id !== tagGroupsId),
			);

			if (editingTagGroupId === tagGroupsId) {
				cancelEditTagGroup();
			}

			setStatusMessage(response.message);
		} catch (error) {
			setTagGroupFormError(getErrorMessage(error));
		} finally {
			setIsTagGroupSubmitting(false);
		}
	}

	async function handleCreateTemplateFromActivity(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setActivityTemplateError(null);

		if (!activeActivity) {
			setActivityTemplateError('Aktivitas sumber template tidak ditemukan.');
			return;
		}

		const templateName = activityTemplateName.trim();
		if (!templateName) {
			setActivityTemplateError('Nama template wajib diisi.');
			return;
		}

		const preparedTemplateTags = prepareTemplateTagPayload(activityTemplateRows);
		if (preparedTemplateTags.error) {
			setActivityTemplateError(preparedTemplateTags.error);
			return;
		}

		setIsActivityTemplateSubmitting(true);

		try {
			const response = await templatesService.create({
				template_name: templateName,
				...(preparedTemplateTags.data.length > 0
					? {
							template_tags: preparedTemplateTags.data,
						}
					: {}),
			});

			setTemplates((current) => normalizeTemplates([...current, response.data]));
			setStatusMessage(response.message);
			setModalState(null);
			setActivityTemplateName('');
			setActivityTemplateRows([createEmptyTemplateTagDraft()]);
			setActivityTemplateError(null);
		} catch (error) {
			setActivityTemplateError(getErrorMessage(error));
		} finally {
			setIsActivityTemplateSubmitting(false);
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

		const tagRelationsPayload = preparedRelations.data.map((relation) => ({
			tag_id: relation.tagId,
			tag_value: relation.tagValue,
			activity_tag_date: selectedDateKey,
		}));

		setIsSubmitting(true);

		try {
			const response = await activitiesService.update(activeActivity.activity_id, {
				activity_date: selectedDateKey,
				activity_point: point,
				activity_description: description,
				tag_relations: tagRelationsPayload,
			});

			setActivities((current) =>
				normalizeActivities(
					current.map((item) =>
						item.activity_id === response.data.activity_id ? response.data : item,
					),
				),
			);
			setStatusMessage(response.message);
			setModalState(null);
			setActiveActivity(null);
			setTagRelations([createEmptyTagRelation()]);
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
			const response = await activitiesService.remove(activeActivity.activity_id);
			setActivities((current) =>
				current.filter((item) => item.activity_id !== activeActivity.activity_id),
			);
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
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937_0%,_#0b0b0b_42%,_#040404_100%)] px-2.5 py-3 text-zinc-100 sm:px-5 sm:py-5">
			<section className="mx-auto flex w-full max-w-5xl flex-col gap-3 [font-family:var(--font-geist-sans)] sm:gap-4">
				<header className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
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

						<div className="w-full rounded-2xl border border-cyan-700/60 bg-cyan-950/50 px-3 py-2.5 text-left sm:w-auto sm:text-right">
							<p className="text-xs uppercase tracking-wide text-cyan-200/75">
								Tanggal aktif
							</p>
							<p className="text-base font-semibold text-cyan-100 sm:text-lg">
								{compactDateFormatter.format(selectedDate)}
							</p>
						</div>
					</div>

					<div className="mt-3 hidden flex-wrap items-center gap-2 text-xs text-zinc-400 sm:flex sm:text-sm">
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

				<section className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-3 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
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

					<div className="mt-3">
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
						<p className="mt-2.5 rounded-xl border border-emerald-700/60 bg-emerald-900/35 px-4 py-2 text-sm text-emerald-200">
							{statusMessage}
						</p>
					) : null}

					{loadError ? (
						<div className="mt-2.5 rounded-xl border border-amber-700/70 bg-amber-900/30 p-3 text-sm text-amber-200">
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

				<section className="rounded-3xl border border-zinc-700/70 bg-zinc-900/80 p-3 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.85)] backdrop-blur sm:p-4">
					<div className="mb-2.5 rounded-2xl border border-zinc-700 bg-zinc-950/60 p-2.5">
						<label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
							Cari aktivitas
							<input
								type="text"
								value={activitySearchQuery}
								onChange={(event) => setActivitySearchQuery(event.target.value)}
								placeholder="Ketik nama aktivitas..."
								className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-normal text-zinc-100 outline-none transition focus:border-cyan-500"
							/>
						</label>

						{activitySearchQuery.trim() ? (
							<p className="mt-2 text-xs text-zinc-400">
								Menampilkan {filteredActivities.length} dari {activities.length} aktivitas.
							</p>
						) : null}
					</div>

					<div className="max-h-[56vh] overflow-y-auto pr-1 [scrollbar-color:#52525b_transparent] sm:max-h-[62vh]">
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
							<div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-4 text-center text-sm text-zinc-400">
								Belum ada aktivitas untuk tanggal ini.
							</div>
						) : filteredActivities.length === 0 ? (
							<div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-4 text-center text-sm text-zinc-400">
								Aktivitas dengan kata kunci tersebut tidak ditemukan.
							</div>
						) : (
							filteredActivities.map((activity, index) => {
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
										className={`mb-2 rounded-2xl border p-2.5 transition hover:-translate-y-0.5 ${activityToneClass}`}
										style={{
											animation: 'fadeSlideIn 360ms ease-out both',
											animationDelay: `${index * 30}ms`,
										}}
									>
										<div className="grid grid-cols-[auto_1fr_auto] items-center gap-1.5 sm:gap-2.5">
											<span
												className={`rounded-xl border px-2 py-1.5 text-xs font-semibold sm:px-2.5 sm:py-1.5 sm:text-sm ${pointToneClass}`}
											>
												{formatSigned(activity.activity_point)}
											</span>

											<p className="truncate rounded-xl bg-zinc-700/70 px-3 py-2 text-sm font-medium text-zinc-100 sm:rounded-full sm:py-1 sm:text-base">
												{activity.activity_description}
											</p>

											<div className="flex items-center gap-1.5 sm:gap-2">
												<button
													type="button"
													onClick={() => openActivityToTemplateModal(activity)}
													className="grid h-9 min-w-9 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 px-2 text-[10px] font-semibold text-zinc-200 transition hover:border-cyan-500 hover:bg-cyan-900/40"
													aria-label="Jadikan template"
													title="Jadikan template"
												>
													Tpl
												</button>

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

					<div className="mt-3 flex items-center justify-end gap-2">
						<button
							type="button"
							onClick={openTagModal}
							className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-100 transition hover:border-cyan-500 hover:bg-cyan-900/40"
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
							onClick={openTagGroupModal}
							className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-100 transition hover:border-amber-500 hover:bg-amber-900/35"
							aria-label="Kelola tag group"
							title="Kelola tag group"
						>
							<svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
								<path
									d="M3.5 5.5h5v5h-5v-5Zm8 0h5v5h-5v-5Zm-8 8h5v3h-5v-3Zm8 0h5v3h-5v-3Zm-3-3h2m-1-5v8"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							<span className="sr-only">Kelola Tag Group</span>
						</button>

						<button
							type="button"
							onClick={openTemplateModal}
							className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-100 transition hover:border-indigo-500 hover:bg-indigo-900/35"
							aria-label="Kelola template"
							title="Kelola template"
						>
							<svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
								<path
									d="M5.25 3.25h7.5l2 2V16.5a1.25 1.25 0 0 1-1.25 1.25h-8A1.25 1.25 0 0 1 4.25 16.5v-12A1.25 1.25 0 0 1 5.5 3.25Zm1.5 5h6.5m-6.5 3h6.5m-6.5 3h4"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							<span className="sr-only">Kelola Template</span>
						</button>

						<button
							type="button"
							onClick={openAddModal}
							className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-100 transition hover:border-emerald-500 hover:bg-emerald-900/45"
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
						<div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-700 bg-zinc-950/65 p-1">
							<button
								type="button"
								onClick={() => setAddMode('custom')}
								className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
									addMode === 'custom'
										? 'border border-cyan-600/60 bg-cyan-900/35 text-cyan-100'
										: 'border border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500'
								}`}
							>
								Custom Activity
							</button>
							<button
								type="button"
								onClick={() => setAddMode('template')}
								className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
									addMode === 'template'
										? 'border border-cyan-600/60 bg-cyan-900/35 text-cyan-100'
										: 'border border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500'
								}`}
							>
								Pakai Template
							</button>
						</div>

						{addMode === 'custom' ? (
							<>
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

								<TagRelationEditor
									rows={tagRelations}
									groups={groups}
									tags={tags}
									tagIdsByGroupId={tagIdsByGroupId}
									tagsError={tagsError}
									tagRelationError={tagRelationError}
									isTagsLoading={isTagsLoading}
									isTagRelationsLoading={isTagRelationsLoading}
									isSubmitting={isSubmitting}
									activePicker={activeTagPicker}
									pickerSearchQuery={tagPickerSearchQuery}
									onPickerSearchQueryChange={setTagPickerSearchQuery}
									onPickerOpen={openTagPickerSearch}
									onPickerClose={closeTagPickerSearch}
									onAddRow={addTagRelationRow}
									onUpdateRow={updateTagRelationRow}
									onUpdateGroup={updateTagRelationGroup}
									onRemoveRow={removeTagRelationRow}
								/>

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
							</>
						) : (
							<>
								{templatesError ? (
									<p className="rounded-xl border border-amber-700/60 bg-amber-900/35 px-3 py-2 text-sm text-amber-200">
										{templatesError}
									</p>
								) : null}

								<label className="block text-sm text-zinc-300">
									<span className="mb-1 block">Pilih Template</span>
									<select
										value={effectiveSelectedTemplateId}
										onChange={(event) => setSelectedTemplateId(event.target.value)}
										disabled={isSubmitting || isTemplatesLoading}
										className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
									>
										<option value="">Pilih template...</option>
										{templates.map((template) => (
											<option key={template.template_id} value={template.template_id}>
												#{template.template_id} {template.template_name}
											</option>
										))}
									</select>
								</label>

								{selectedTemplateForAdd ? (
									<div className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3">
										<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
											Tag di template terpilih
										</p>
										{(selectedTemplateForAdd.template_tags?.length ?? 0) === 0 ? (
											<p className="mt-2 text-xs text-zinc-400">Template ini belum punya tag.</p>
										) : (
											<ul className="mt-2 space-y-1 text-xs text-zinc-300">
												{selectedTemplateForAdd.template_tags?.map((item) => (
													<li
														key={`template-tag-${selectedTemplateForAdd.template_id}-${item.template_tags_id}`}
														className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-2 py-1"
													>
														{item.tag?.tag_name ?? `Tag #${item.tag_id}`} - {item.points}
													</li>
												))}
											</ul>
										)}
									</div>
								) : null}

								<label className="block text-sm text-zinc-300">
									<span className="mb-1 block">Override Nama Aktivitas (opsional)</span>
									<input
										type="text"
										value={templateOverrideDescription}
										onChange={(event) => setTemplateOverrideDescription(event.target.value)}
										className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
										placeholder="Kosongkan untuk pakai nama dari template"
									/>
								</label>

								<label className="block text-sm text-zinc-300">
									<span className="mb-1 block">Override Point (opsional)</span>
									<input
										type="number"
										value={templateOverridePoint}
										onChange={(event) => setTemplateOverridePoint(event.target.value)}
										className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
										placeholder="Kosongkan untuk pakai default dari backend"
									/>
								</label>
							</>
						)}

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
							{isSubmitting
								? addMode === 'template'
									? 'Menerapkan Template...'
									: 'Menyimpan...'
								: addMode === 'template'
									? 'Buat dari Template'
									: 'Simpan Aktivitas'}
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

						<TagRelationEditor
							rows={tagRelations}
							groups={groups}
							tags={tags}
							tagIdsByGroupId={tagIdsByGroupId}
							tagsError={tagsError}
							tagRelationError={tagRelationError}
							isTagsLoading={isTagsLoading}
							isTagRelationsLoading={isTagRelationsLoading}
							isSubmitting={isSubmitting}
							activePicker={activeTagPicker}
							pickerSearchQuery={tagPickerSearchQuery}
							onPickerSearchQueryChange={setTagPickerSearchQuery}
							onPickerOpen={openTagPickerSearch}
							onPickerClose={closeTagPickerSearch}
							onAddRow={addTagRelationRow}
							onUpdateRow={updateTagRelationRow}
							onUpdateGroup={updateTagRelationGroup}
							onRemoveRow={removeTagRelationRow}
						/>

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

			{modalState === 'templates' ? (
				<ModalFrame
					title="Kelola Template"
					subtitle="CRUD template untuk pembuatan activity"
					onClose={closeModal}
					disableClose={isTemplateSubmitting}
				>
					<div className="space-y-4">
						<form className="flex items-center gap-2" onSubmit={handleCreateTemplateSubmit}>
							<input
								type="text"
								value={templateFormName}
								onChange={(event) => setTemplateFormName(event.target.value)}
								placeholder="Nama template"
								disabled={isTemplateSubmitting}
								className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
							/>
							<button
								type="submit"
								disabled={isTemplateSubmitting}
								className="rounded-xl border border-cyan-700/70 bg-cyan-900/40 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/50 disabled:cursor-not-allowed disabled:opacity-60"
							>
								Tambah
							</button>
						</form>

						<label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
							Cari template
							<input
								type="text"
								value={templateSearchQuery}
								onChange={(event) => setTemplateSearchQuery(event.target.value)}
								placeholder="Cari nama template..."
								disabled={isTemplateSubmitting || isTemplatesLoading}
								className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-normal text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
							/>
						</label>

						{templateSearchQuery.trim() ? (
							<p className="text-xs text-zinc-400">
								Menampilkan {filteredTemplates.length} dari {templates.length} template.
							</p>
						) : null}

						{templateFormError ? (
							<p className="rounded-xl border border-rose-700/60 bg-rose-900/35 px-3 py-2 text-sm text-rose-200">
								{templateFormError}
							</p>
						) : null}

						{templatesError ? (
							<p className="rounded-xl border border-amber-700/60 bg-amber-900/35 px-3 py-2 text-sm text-amber-200">
								{templatesError}
							</p>
						) : null}

						{isTemplatesLoading ? (
							<p className="text-sm text-zinc-400">Memuat daftar template...</p>
						) : templates.length === 0 ? (
							<div className="rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-4 text-center text-sm text-zinc-400">
								Belum ada template.
							</div>
						) : filteredTemplates.length === 0 ? (
							<div className="rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-4 text-center text-sm text-zinc-400">
								Template tidak ditemukan dengan kata kunci tersebut.
							</div>
						) : (
							<div className="max-h-72 space-y-2 overflow-y-auto pr-1">
								{filteredTemplates.map((template) => (
									<div
										key={template.template_id}
										className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-3"
									>
										{editingTemplateId === template.template_id ? (
											<div className="space-y-2">
												<input
													type="text"
													value={editingTemplateName}
													onChange={(event) => setEditingTemplateName(event.target.value)}
													disabled={isTemplateSubmitting}
													className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
												/>
												<div className="flex items-center justify-end gap-2">
													<button
														type="button"
														onClick={cancelEditTemplate}
														disabled={isTemplateSubmitting}
														className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
													>
														Batal
													</button>
													<button
														type="button"
														onClick={() => {
															void handleSaveTemplateEdit(template.template_id);
														}}
														disabled={isTemplateSubmitting}
														className="rounded-lg border border-cyan-700/70 bg-cyan-900/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/50 disabled:cursor-not-allowed disabled:opacity-60"
													>
														Simpan
													</button>
												</div>
											</div>
										) : (
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0">
													<p className="truncate text-sm font-medium text-zinc-100">
														{template.template_name}
													</p>
													<p className="mt-1 text-xs text-zinc-400">
														{template.template_tags?.length ?? 0} template tags
													</p>
												</div>
												<div className="flex items-center gap-2">
													<button
														type="button"
														onClick={() => beginEditTemplate(template)}
														disabled={isTemplateSubmitting}
														className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
													>
														Edit
													</button>
													<button
														type="button"
														onClick={() => {
															void handleDeleteTemplate(template.template_id);
														}}
														disabled={isTemplateSubmitting}
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

			{modalState === 'tag-groups' ? (
				<ModalFrame
					title="Kelola Tag Group"
					subtitle="CRUD group dan relasi tag-group"
					onClose={closeModal}
					disableClose={isGroupSubmitting || isTagGroupSubmitting}
				>
					<div className="space-y-5">
						<section className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-950/55 p-3">
							<div className="flex items-center justify-between gap-2">
								<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Group</p>
								<button
									type="button"
									onClick={() => {
										void refreshGroups();
									}}
									className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800"
								>
									Reload
								</button>
							</div>

							<form className="flex items-center gap-2" onSubmit={handleCreateGroupSubmit}>
								<input
									type="text"
									value={groupFormName}
									onChange={(event) => setGroupFormName(event.target.value)}
									placeholder="Nama group"
									disabled={isGroupSubmitting}
									className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
								/>
								<button
									type="submit"
									disabled={isGroupSubmitting}
									className="rounded-xl border border-cyan-700/70 bg-cyan-900/40 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/50 disabled:cursor-not-allowed disabled:opacity-60"
								>
									Tambah
								</button>
							</form>

							<label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
								Cari group
								<input
									type="text"
									value={groupSearchQuery}
									onChange={(event) => setGroupSearchQuery(event.target.value)}
									placeholder="Cari nama group..."
									disabled={isGroupSubmitting || isGroupsLoading}
									className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-normal text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
								/>
							</label>

							{groupFormError ? (
								<p className="rounded-xl border border-rose-700/60 bg-rose-900/35 px-3 py-2 text-sm text-rose-200">
									{groupFormError}
								</p>
							) : null}

							{groupsError ? (
								<p className="rounded-xl border border-amber-700/60 bg-amber-900/35 px-3 py-2 text-sm text-amber-200">
									{groupsError}
								</p>
							) : null}

							{isGroupsLoading ? (
								<p className="text-sm text-zinc-400">Memuat daftar group...</p>
							) : groups.length === 0 ? (
								<div className="rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-4 text-center text-sm text-zinc-400">
									Belum ada group.
								</div>
							) : filteredGroups.length === 0 ? (
								<div className="rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-4 text-center text-sm text-zinc-400">
									Group tidak ditemukan.
								</div>
							) : (
								<div className="max-h-52 space-y-2 overflow-y-auto pr-1">
									{filteredGroups.map((group) => (
										<div
											key={group.group_id}
											className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-2"
										>
											{editingGroupId === group.group_id ? (
												<div className="space-y-2">
													<input
														type="text"
														value={editingGroupName}
														onChange={(event) => setEditingGroupName(event.target.value)}
														disabled={isGroupSubmitting}
														className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
													/>
													<div className="flex items-center justify-end gap-2">
														<button
															type="button"
															onClick={cancelEditGroup}
															disabled={isGroupSubmitting}
															className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
														>
															Batal
														</button>
														<button
															type="button"
															onClick={() => {
																void handleSaveGroupEdit(group.group_id);
															}}
															disabled={isGroupSubmitting}
															className="rounded-lg border border-cyan-700/70 bg-cyan-900/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/50 disabled:cursor-not-allowed disabled:opacity-60"
														>
															Simpan
														</button>
													</div>
												</div>
											) : (
												<div className="flex items-center justify-between gap-2">
													<p className="text-sm font-medium text-zinc-100">{group.group_name}</p>
													<div className="flex items-center gap-2">
														<button
															type="button"
															onClick={() => beginEditGroup(group)}
															disabled={isGroupSubmitting}
															className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
														>
															Edit
														</button>
														<button
															type="button"
															onClick={() => {
																void handleDeleteGroup(group.group_id);
															}}
															disabled={isGroupSubmitting}
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
						</section>

						<section className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-950/55 p-3">
							<div className="flex items-center justify-between gap-2">
								<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Relasi Tag-Group</p>
								<button
									type="button"
									onClick={() => {
										void refreshTagGroups();
									}}
									className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800"
								>
									Reload
								</button>
							</div>

							<form className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={handleCreateTagGroupSubmit}>
								<select
									value={tagGroupFormTagId}
									onChange={(event) => setTagGroupFormTagId(event.target.value)}
									disabled={isTagGroupSubmitting || isTagsLoading}
									className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
								>
									<option value="">Pilih tag...</option>
									{tags.map((tag) => (
										<option key={tag.tag_id} value={tag.tag_id}>
											{tag.tag_name}
										</option>
									))}
								</select>

								<select
									value={tagGroupFormGroupId}
									onChange={(event) => setTagGroupFormGroupId(event.target.value)}
									disabled={isTagGroupSubmitting || isGroupsLoading}
									className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
								>
									<option value="">Pilih group...</option>
									{groups.map((group) => (
										<option key={group.group_id} value={group.group_id}>
											{group.group_name}
										</option>
									))}
								</select>

								<button
									type="submit"
									disabled={isTagGroupSubmitting}
									className="rounded-xl border border-cyan-700/70 bg-cyan-900/40 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/50 disabled:cursor-not-allowed disabled:opacity-60"
								>
									Tambah
								</button>
							</form>

							<label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
								Cari relasi
								<input
									type="text"
									value={tagGroupSearchQuery}
									onChange={(event) => setTagGroupSearchQuery(event.target.value)}
									placeholder="Cari group atau tag..."
									disabled={isTagGroupSubmitting || isTagGroupsLoading}
									className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-normal text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
								/>
							</label>

							{tagGroupFormError ? (
								<p className="rounded-xl border border-rose-700/60 bg-rose-900/35 px-3 py-2 text-sm text-rose-200">
									{tagGroupFormError}
								</p>
							) : null}

							{tagGroupsError ? (
								<p className="rounded-xl border border-amber-700/60 bg-amber-900/35 px-3 py-2 text-sm text-amber-200">
									{tagGroupsError}
								</p>
							) : null}

							{isTagGroupsLoading ? (
								<p className="text-sm text-zinc-400">Memuat daftar relasi...</p>
							) : tagGroups.length === 0 ? (
								<div className="rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-4 text-center text-sm text-zinc-400">
									Belum ada relasi tag-group.
								</div>
							) : filteredTagGroups.length === 0 ? (
								<div className="rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-4 text-center text-sm text-zinc-400">
									Relasi tidak ditemukan.
								</div>
							) : (
								<div className="max-h-52 space-y-2 overflow-y-auto pr-1">
									{filteredTagGroups.map((relation) => (
										<div
											key={relation.tag_groups_id}
											className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-2"
										>
											{editingTagGroupId === relation.tag_groups_id ? (
												<div className="space-y-2">
													<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
														<select
															value={editingTagGroupTagId}
															onChange={(event) => setEditingTagGroupTagId(event.target.value)}
															disabled={isTagGroupSubmitting}
															className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
														>
															<option value="">Pilih tag...</option>
															{tags.map((tag) => (
																<option key={tag.tag_id} value={tag.tag_id}>
																	{tag.tag_name}
																</option>
															))}
														</select>

														<select
															value={editingTagGroupGroupId}
															onChange={(event) => setEditingTagGroupGroupId(event.target.value)}
															disabled={isTagGroupSubmitting}
															className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
														>
															<option value="">Pilih group...</option>
															{groups.map((group) => (
																<option key={group.group_id} value={group.group_id}>
																	{group.group_name}
																</option>
															))}
														</select>
													</div>

													<div className="flex items-center justify-end gap-2">
														<button
															type="button"
															onClick={cancelEditTagGroup}
															disabled={isTagGroupSubmitting}
															className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
														>
															Batal
														</button>
														<button
															type="button"
															onClick={() => {
																void handleSaveTagGroupEdit(relation.tag_groups_id);
															}}
															disabled={isTagGroupSubmitting}
															className="rounded-lg border border-cyan-700/70 bg-cyan-900/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/50 disabled:cursor-not-allowed disabled:opacity-60"
														>
															Simpan
														</button>
													</div>
												</div>
											) : (
												<div className="flex items-center justify-between gap-2">
													<p className="text-sm text-zinc-100">
														{groupNameById.get(relation.group_id) ?? `Group #${relation.group_id}`}
														 <span className="text-zinc-500">-</span>{' '}
														{tagNameById.get(relation.tag_id) ?? `Tag #${relation.tag_id}`}
													</p>

													<div className="flex items-center gap-2">
														<button
															type="button"
															onClick={() => beginEditTagGroup(relation)}
															disabled={isTagGroupSubmitting}
															className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
														>
															Edit
														</button>
														<button
															type="button"
															onClick={() => {
																void handleDeleteTagGroup(relation.tag_groups_id);
															}}
															disabled={isTagGroupSubmitting}
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
						</section>
					</div>
				</ModalFrame>
			) : null}

			{modalState === 'activity-to-template' ? (
				<ModalFrame
					title="Jadikan Activity ke Template"
					subtitle="Simpan activity yang sudah ada sebagai template"
					onClose={closeModal}
					disableClose={isActivityTemplateLoading || isActivityTemplateSubmitting}
				>
					<form className="space-y-3" onSubmit={handleCreateTemplateFromActivity}>
						<p className="rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-200">
							Sumber: {activeActivity?.activity_description ?? '-'}
						</p>

						<label className="block text-sm text-zinc-300">
							<span className="mb-1 block">Nama Template</span>
							<input
								type="text"
								value={activityTemplateName}
								onChange={(event) => setActivityTemplateName(event.target.value)}
								disabled={isActivityTemplateLoading || isActivityTemplateSubmitting}
								className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
								required
							/>
						</label>

						<div className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-3">
							<div className="flex items-center justify-between gap-2">
								<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Template Tags</p>
								<button
									type="button"
									onClick={addActivityTemplateRow}
									disabled={isActivityTemplateLoading || isActivityTemplateSubmitting || isTagsLoading}
									className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
								>
									+ Tag
								</button>
							</div>

							{isActivityTemplateLoading ? (
								<p className="mt-2 text-xs text-zinc-400">Memuat relasi tag dari activity...</p>
							) : null}

							{tagsError ? <p className="mt-2 text-xs text-amber-300">{tagsError}</p> : null}

							<div className="mt-2 space-y-2">
								{activityTemplateRows.map((row, index) => (
									<div
										key={`activity-template-row-${index}`}
										className="grid grid-cols-[1fr_7.25rem_auto] gap-2"
									>
										<select
											value={row.tagId}
											onChange={(event) =>
												updateActivityTemplateRow(index, {
													tagId: event.target.value,
												})
											}
											disabled={isActivityTemplateLoading || isActivityTemplateSubmitting || isTagsLoading}
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
											value={row.points}
											onChange={(event) =>
												updateActivityTemplateRow(index, {
													points: event.target.value,
												})
											}
											disabled={isActivityTemplateLoading || isActivityTemplateSubmitting}
											placeholder="Points"
											className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-xs text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
										/>

										<button
											type="button"
											onClick={() => removeActivityTemplateRow(index)}
											disabled={isActivityTemplateLoading || isActivityTemplateSubmitting}
											className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-200 transition hover:border-rose-500 hover:bg-rose-900/45 disabled:cursor-not-allowed disabled:opacity-60"
											aria-label="Hapus baris template tag"
										>
											x
										</button>
									</div>
								))}
							</div>
						</div>

						{activityTemplateError ? (
							<p className="rounded-xl border border-rose-700/60 bg-rose-900/35 px-3 py-2 text-sm text-rose-200">
								{activityTemplateError}
							</p>
						) : null}

						<button
							type="submit"
							disabled={isActivityTemplateLoading || isActivityTemplateSubmitting}
							className="w-full rounded-xl border border-cyan-700/70 bg-cyan-900/40 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-800/50 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isActivityTemplateSubmitting ? 'Menyimpan Template...' : 'Simpan Jadi Template'}
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

						<label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
							Cari tag
							<input
								type="text"
								value={tagCrudSearchQuery}
								onChange={(event) => setTagCrudSearchQuery(event.target.value)}
								placeholder="Cari nama tag..."
								disabled={isTagSubmitting || isTagsLoading}
								className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-normal text-zinc-100 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
							/>
						</label>

						{tagCrudSearchQuery.trim() ? (
							<p className="text-xs text-zinc-400">
								Menampilkan {filteredTagsForCrud.length} dari {tags.length} tag.
							</p>
						) : null}

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
						) : filteredTagsForCrud.length === 0 ? (
							<div className="rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-4 text-center text-sm text-zinc-400">
								Tag tidak ditemukan dengan kata kunci tersebut.
							</div>
						) : (
							<div className="max-h-72 space-y-2 overflow-y-auto pr-1">
								{filteredTagsForCrud.map((tag) => (
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
