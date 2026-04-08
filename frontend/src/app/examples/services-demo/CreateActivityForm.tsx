'use client';

import { useActionState } from 'react';
import {
	createActivityAction,
	initialCreateActivityActionState,
} from './actions';

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

export function CreateActivityForm() {
	const [state, formAction, isPending] = useActionState(
		createActivityAction,
		initialCreateActivityActionState,
	);

	return (
		<form action={formAction} className="space-y-3 rounded-2xl border border-zinc-700 bg-zinc-950/60 p-4">
			<h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
				Create Activity (Server Action)
			</h2>

			<label className="block text-xs text-zinc-400">
				Tanggal
				<input
					type="date"
					name="activity_date"
					required
					className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500"
				/>
				<FieldErrors errors={state?.fieldErrors?.activity_date} />
			</label>

			<label className="block text-xs text-zinc-400">
				Point
				<input
					type="number"
					name="activity_point"
					required
					className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500"
				/>
				<FieldErrors errors={state?.fieldErrors?.activity_point} />
			</label>

			<label className="block text-xs text-zinc-400">
				Deskripsi
				<input
					type="text"
					name="activity_description"
					required
					className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500"
				/>
				<FieldErrors errors={state?.fieldErrors?.activity_description} />
			</label>

			{state?.message ? (
				<p
					className={`rounded-xl border px-3 py-2 text-sm ${
						state?.ok
							? 'border-emerald-700/70 bg-emerald-900/30 text-emerald-200'
							: 'border-rose-700/70 bg-rose-900/30 text-rose-200'
					}`}
				>
					{state?.message}
				</p>
			) : null}

			<button
				type="submit"
				disabled={isPending}
				className="rounded-xl border border-cyan-700/70 bg-cyan-900/40 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-800/50 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{isPending ? 'Menyimpan...' : 'Create Activity'}
			</button>
		</form>
	);
}
