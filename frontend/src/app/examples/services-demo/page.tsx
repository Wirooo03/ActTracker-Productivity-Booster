import type { Action, Activity } from '@/lib/api/types';
import { actionsService } from '@/services/actionsService';
import { activitiesService } from '@/services/activitiesService';
import { CreateActivityForm } from './CreateActivityForm';
import { DurationServiceExamples } from './DurationServiceExamples';

function isRenderableActivity(value: Activity | null | undefined): value is Activity {
	if (!value || typeof value !== 'object') {
		return false;
	}

	return (
		typeof value.activity_id === 'number' &&
		typeof value.activity_date === 'string' &&
		typeof value.activity_point === 'number' &&
		typeof value.activity_description === 'string'
	);
}

function formatDateLabel(rawDate: string): string {
	const parsed = new Date(rawDate);
	if (Number.isNaN(parsed.getTime())) {
		return rawDate;
	}

	return new Intl.DateTimeFormat('id-ID', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	}).format(parsed);
}

export default async function ServicesDemoPage() {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;

	let activities: Activity[] = [];
	let loadError: string | null = null;
	let actions: Action[] = [];
	let actionsLoadError: string | null = null;

	try {
		const response = await activitiesService.listByMonth(year, month);
		activities = (response.data ?? []).filter(isRenderableActivity);
	} catch (error) {
		loadError =
			error instanceof Error
				? error.message
				: 'Gagal memuat data aktivitas.';
	}

	try {
		const response = await actionsService.list();
		actions = response.data ?? [];
	} catch (error) {
		actionsLoadError =
			error instanceof Error
				? error.message
				: 'Gagal memuat data action.';
	}

	return (
		<main className="min-h-screen bg-zinc-950 px-3 py-4 text-zinc-100 sm:px-6 sm:py-8">
			<section className="mx-auto flex w-full max-w-5xl flex-col gap-4">
				<header className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4">
					<h1 className="text-xl font-semibold">API Service Layer Demo</h1>
					<p className="mt-1 text-sm text-zinc-400">
						Contoh real pemakaian services di Next.js server component dan server action.
					</p>
				</header>

				<div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
					<section className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4">
						<h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
							List Activities Bulan Ini (Server Component)
						</h2>

						{loadError ? (
							<p className="mt-3 rounded-xl border border-rose-700/70 bg-rose-900/30 px-3 py-2 text-sm text-rose-200">
								{loadError}
							</p>
						) : activities.length === 0 ? (
							<p className="mt-3 text-sm text-zinc-400">Belum ada data aktivitas.</p>
						) : (
							<ul className="mt-3 space-y-2">
								{activities.map((activity) => (
									<li
										key={activity.activity_id}
										className="rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 py-2"
									>
										<p className="text-sm font-medium text-zinc-100">
											{activity.activity_description}
										</p>
										<p className="text-xs text-zinc-400">
											{formatDateLabel(activity.activity_date)} - point {activity.activity_point}
										</p>
									</li>
								))}
							</ul>
						)}
					</section>

					<CreateActivityForm />
				</div>

				<DurationServiceExamples actions={actions} actionsLoadError={actionsLoadError} />
			</section>
		</main>
	);
}
