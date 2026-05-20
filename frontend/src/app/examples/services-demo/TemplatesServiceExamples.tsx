'use client';

import { type FormEvent, useState } from 'react';
import type { TemplateTagInputPayload } from '@/lib/api/types';
import { useTemplatesServiceExample } from './useTemplatesServiceExample';

function todayDateKey(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function parseTemplateTagsJson(raw: string): TemplateTagInputPayload[] {
	let parsed: unknown;

	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error('template_tags harus berupa JSON array yang valid.');
	}

	if (!Array.isArray(parsed)) {
		throw new Error('template_tags harus berupa array.');
	}

	const normalizedTags = parsed.map((item, index) => {
		if (typeof item !== 'object' || item === null) {
			throw new Error(`template_tags[${index}] harus object.`);
		}

		const tagId = Number((item as { tag_id?: unknown }).tag_id);
		const points = Number((item as { points?: unknown }).points);

		if (!Number.isInteger(tagId) || tagId <= 0) {
			throw new Error(`template_tags[${index}].tag_id harus integer positif.`);
		}

		if (!Number.isFinite(points)) {
			throw new Error(`template_tags[${index}].points harus angka.`);
		}

		return {
			tag_id: tagId,
			points,
		};
	});

	return normalizedTags;
}

function parseOptionalPoint(rawValue: string): number | undefined {
	const trimmed = rawValue.trim();
	if (!trimmed) {
		return undefined;
	}

	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed)) {
		throw new Error('activity_point harus berupa angka atau kosong.');
	}

	return parsed;
}

function FieldErrors({ errors }: { errors?: string[] }) {
	if (!errors || errors.length === 0) {
		return null;
	}

	return (
		<ul className="mt-1 space-y-0.5 text-xs text-rose-300">
			{errors.map((error) => (
				<li key={error}>- {error}</li>
			))}
		</ul>
	);
}

export function TemplatesServiceExamples() {
	const {
		templates,
		isLoadingTemplates,
		templatesLoadError,
		loadTemplates,
		createTemplate,
		isCreatingTemplate,
		createTemplateMessage,
		createTemplateError,
		createTemplateFieldErrors,
		applyTemplate,
		isApplyingTemplate,
		applyTemplateMessage,
		applyTemplateError,
		applyTemplateNotFoundMessage,
		applyTemplateFieldErrors,
		createdActivitiesFromTemplate,
	} = useTemplatesServiceExample();

	const [templateName, setTemplateName] = useState('Morning Routine');
	const [templateTagsRaw, setTemplateTagsRaw] = useState(
		JSON.stringify(
			[
				{ tag_id: 2, points: 10 },
				{ tag_id: 5, points: 5 },
			],
			null,
			2,
		),
	);
	const [createTemplateInputError, setCreateTemplateInputError] = useState<string | null>(null);

	const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
	const [activityDate, setActivityDate] = useState(todayDateKey());
	const [activityDescription, setActivityDescription] = useState('');
	const [activityPoint, setActivityPoint] = useState('');
	const [applyTemplateInputError, setApplyTemplateInputError] = useState<string | null>(null);

	const effectiveSelectedTemplateId =
		selectedTemplateId || (templates.length > 0 ? String(templates[0].template_id) : '');

	async function handleCreateTemplate(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setCreateTemplateInputError(null);

		const trimmedName = templateName.trim();
		if (!trimmedName) {
			setCreateTemplateInputError('template_name wajib diisi.');
			return;
		}

		let parsedTemplateTags: TemplateTagInputPayload[];

		try {
			parsedTemplateTags = parseTemplateTagsJson(templateTagsRaw);
		} catch (error) {
			setCreateTemplateInputError(
				error instanceof Error ? error.message : 'Format template_tags tidak valid.',
			);
			return;
		}

		const ok = await createTemplate({
			template_name: trimmedName,
			template_tags: parsedTemplateTags,
		});

		if (ok) {
			setTemplateName('');
		}
	}

	async function handleApplyTemplate(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setApplyTemplateInputError(null);

		const templateId = Number(effectiveSelectedTemplateId);
		if (!Number.isInteger(templateId) || templateId <= 0) {
			setApplyTemplateInputError('Pilih template yang valid.');
			return;
		}

		if (!/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) {
			setApplyTemplateInputError('activity_date wajib format YYYY-MM-DD.');
			return;
		}

		let parsedPoint: number | undefined;

		try {
			parsedPoint = parseOptionalPoint(activityPoint);
		} catch (error) {
			setApplyTemplateInputError(
				error instanceof Error ? error.message : 'Nilai activity_point tidak valid.',
			);
			return;
		}

		const payload = {
			activity_date: activityDate,
			...(activityDescription.trim()
				? { activity_description: activityDescription.trim() }
				: {}),
			...(parsedPoint !== undefined ? { activity_point: parsedPoint } : {}),
		};

		const ok = await applyTemplate(templateId, payload);

		if (ok) {
			setActivityDescription('');
			setActivityPoint('');
		}
	}

	return (
		<section className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
					Templates Service Examples
				</h2>
				<button
					type="button"
					onClick={() => {
						void loadTemplates();
					}}
					className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-700"
				>
					Reload Templates
				</button>
			</div>

			{templatesLoadError ? (
				<p className="mt-3 rounded-xl border border-rose-700/70 bg-rose-900/35 px-3 py-2 text-sm text-rose-200">
					{templatesLoadError}
				</p>
			) : null}

			<div className="mt-3 grid gap-3 lg:grid-cols-2">
				<form
					onSubmit={(event) => {
						void handleCreateTemplate(event);
					}}
					className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3"
				>
					<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
						Create Template (with template_tags)
					</p>

					<label className="mt-2 block text-xs text-zinc-400">
						template_name
						<input
							type="text"
							value={templateName}
							onChange={(event) => setTemplateName(event.target.value)}
							className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-100 outline-none"
							required
						/>
						<FieldErrors errors={createTemplateFieldErrors.template_name} />
					</label>

					<label className="mt-2 block text-xs text-zinc-400">
						template_tags (JSON array)
						<textarea
							value={templateTagsRaw}
							onChange={(event) => setTemplateTagsRaw(event.target.value)}
							rows={6}
							className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 font-mono text-xs text-zinc-100 outline-none"
						/>
						<FieldErrors errors={createTemplateFieldErrors.template_tags} />
					</label>

					{createTemplateInputError ? (
						<p className="mt-2 text-xs text-rose-300">{createTemplateInputError}</p>
					) : null}
					{createTemplateError ? (
						<p className="mt-2 text-xs text-rose-300">{createTemplateError}</p>
					) : null}
					{createTemplateMessage ? (
						<p className="mt-2 text-xs text-emerald-300">{createTemplateMessage}</p>
					) : null}

					<button
						type="submit"
						disabled={isCreatingTemplate}
						className="mt-3 rounded-lg border border-cyan-700/70 bg-cyan-900/35 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/45 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isCreatingTemplate ? 'Menyimpan...' : 'Create Template'}
					</button>
				</form>

				<form
					onSubmit={(event) => {
						void handleApplyTemplate(event);
					}}
					className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3"
				>
					<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
						Apply Template jadi Activity
					</p>

					<label className="mt-2 block text-xs text-zinc-400">
						template_id
						<select
							value={effectiveSelectedTemplateId}
							onChange={(event) => setSelectedTemplateId(event.target.value)}
							className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-100 outline-none"
						>
							<option value="">Pilih template...</option>
							{templates.map((template) => (
								<option key={template.template_id} value={template.template_id}>
									#{template.template_id} {template.template_name}
								</option>
							))}
						</select>
					</label>

					<label className="mt-2 block text-xs text-zinc-400">
						activity_date
						<input
							type="date"
							value={activityDate}
							onChange={(event) => setActivityDate(event.target.value)}
							className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-100 outline-none"
							required
						/>
						<FieldErrors errors={applyTemplateFieldErrors.activity_date} />
					</label>

					<label className="mt-2 block text-xs text-zinc-400">
						activity_description (optional)
						<input
							type="text"
							value={activityDescription}
							onChange={(event) => setActivityDescription(event.target.value)}
							className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-100 outline-none"
						/>
						<FieldErrors errors={applyTemplateFieldErrors.activity_description} />
					</label>

					<label className="mt-2 block text-xs text-zinc-400">
						activity_point (optional)
						<input
							type="number"
							value={activityPoint}
							onChange={(event) => setActivityPoint(event.target.value)}
							className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-100 outline-none"
						/>
						<FieldErrors errors={applyTemplateFieldErrors.activity_point} />
					</label>

					{applyTemplateInputError ? (
						<p className="mt-2 text-xs text-rose-300">{applyTemplateInputError}</p>
					) : null}
					{applyTemplateNotFoundMessage ? (
						<p className="mt-2 text-xs text-amber-300">{applyTemplateNotFoundMessage}</p>
					) : null}
					{applyTemplateError ? (
						<p className="mt-2 text-xs text-rose-300">{applyTemplateError}</p>
					) : null}
					{applyTemplateMessage ? (
						<p className="mt-2 text-xs text-emerald-300">{applyTemplateMessage}</p>
					) : null}

					<button
						type="submit"
						disabled={isApplyingTemplate || isLoadingTemplates}
						className="mt-3 rounded-lg border border-cyan-700/70 bg-cyan-900/35 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-800/45 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isApplyingTemplate ? 'Memproses...' : 'Apply Template'}
					</button>
				</form>
			</div>

			<div className="mt-4 grid gap-3 lg:grid-cols-2">
				<section className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3">
					<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
						Load List Templates
					</p>

					{isLoadingTemplates ? (
						<p className="mt-2 text-xs text-zinc-400">Memuat template...</p>
					) : templates.length === 0 ? (
						<p className="mt-2 text-xs text-zinc-400">Template belum tersedia.</p>
					) : (
						<ul className="mt-2 space-y-1.5 text-xs text-zinc-300">
							{templates.slice(0, 8).map((template) => (
								<li
									key={`template-list-${template.template_id}`}
									className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-2.5 py-1.5"
								>
									<p className="font-semibold text-zinc-100">
										#{template.template_id} {template.template_name}
									</p>
									<p className="text-zinc-400">
										{template.template_tags?.length ?? 0} template_tags
									</p>
								</li>
							))}
						</ul>
					)}
				</section>

				<section className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3">
					<p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
						Activity hasil apply template (append lokal)
					</p>

					{createdActivitiesFromTemplate.length === 0 ? (
						<p className="mt-2 text-xs text-zinc-400">Belum ada activity hasil apply template.</p>
					) : (
						<ul className="mt-2 space-y-1.5 text-xs text-zinc-300">
							{createdActivitiesFromTemplate.slice(0, 8).map((activity) => (
								<li
									key={`created-activity-${activity.activity_id}`}
									className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-2.5 py-1.5"
								>
									<p className="font-semibold text-zinc-100">
										#{activity.activity_id} {activity.activity_description}
									</p>
									<p className="text-zinc-400">
										{activity.activity_date} - point {activity.activity_point}
									</p>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</section>
	);
}
