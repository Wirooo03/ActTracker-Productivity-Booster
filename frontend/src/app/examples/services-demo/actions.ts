'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api/apiError';
import type { ValidationErrors } from '@/lib/api/types';
import { activitiesService } from '@/services/activitiesService';

export type CreateActivityActionState = {
	ok: boolean;
	message: string;
	fieldErrors: ValidationErrors;
};

export const initialCreateActivityActionState: CreateActivityActionState = {
	ok: false,
	message: '',
	fieldErrors: {},
};

export async function createActivityAction(
	_prevState: CreateActivityActionState,
	formData: FormData,
): Promise<CreateActivityActionState> {
	const activity_date = String(formData.get('activity_date') ?? '');
	const activity_point = Number(formData.get('activity_point') ?? '');
	const activity_description = String(formData.get('activity_description') ?? '').trim();

	try {
		const response = await activitiesService.create({
			activity_date,
			activity_point,
			activity_description,
		});

		revalidatePath('/examples/services-demo');

		return {
			ok: true,
			message: response.message,
			fieldErrors: {},
		};
	} catch (error) {
		if (error instanceof ApiError && error.status === 422) {
			return {
				ok: false,
				message: error.message,
				fieldErrors: error.validationErrors ?? {},
			};
		}

		return {
			ok: false,
			message:
				error instanceof Error
					? error.message
					: 'Terjadi kesalahan yang tidak terduga.',
			fieldErrors: {},
		};
	}
}
