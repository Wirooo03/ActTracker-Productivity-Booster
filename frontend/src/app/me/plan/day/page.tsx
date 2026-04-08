'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function dateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export default function LegacyPlanDayRedirectPage() {
	const router = useRouter();

	useEffect(() => {
		router.replace(`/me/plan/${dateKey(new Date())}`);
	}, [router]);

	return (
		<main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
			<p className="mx-auto max-w-xl text-sm text-zinc-300">Mengalihkan ke plan harian terbaru...</p>
		</main>
	);
}
