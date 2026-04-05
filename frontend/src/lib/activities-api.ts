export type Activity = {
	activity_id: number;
	activity_date: string;
	activity_point: number;
	activity_description: string;
};

export type ActivitiesListResponse = {
	data: Activity[];
};

export type ActivityMutationPayload = {
	activity_date: string;
	activity_point: number;
	activity_description: string;
};

export type ActivityMutationResponse = {
	message: string;
	data: Activity;
};

export type ActivityDeleteResponse = {
	message: string;
};

export type Tag = {
	tag_id: number;
	tag_name: string;
};

export type TagsListResponse = {
	data: Tag[];
};

export type TagMutationPayload = {
	tag_name: string;
};

export type TagMutationResponse = {
	message: string;
	data: Tag;
};

export type TagDeleteResponse = {
	message: string;
};

export type ActivityTag = {
	activity_tag_id: number;
	activity_tag_date: string;
	activity_id: number;
	tag_id: number;
	tag_value: number | null;
	activity?: Activity;
	tag?: Tag;
};

export type ActivityTagsListResponse = {
	data: ActivityTag[];
};

export type ActivityTagMutationPayload = {
	activity_tag_date: string | Date;
	activity_id: number;
	tag_id: number;
	tag_value: number | null;
};

export type ActivityTagMutationResponse = {
	message: string;
	data: ActivityTag;
};

export type ActivityTagDeleteResponse = {
	message: string;
};

function getApiBaseUrl(): string {
	const trimmed = (process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? '')
		.trim()
		.replace(/\/+$/, '');

	if (!trimmed) {
		throw new Error(
			'Missing API_BASE_URL. Set API_BASE_URL (server) or NEXT_PUBLIC_API_BASE_URL (client) in your env file.',
		);
	}

	return trimmed;
}

function normalizeDate(date: string | Date): string {
	if (date instanceof Date) {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		throw new Error('Invalid date format. Use YYYY-MM-DD.');
	}

	return date;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${getApiBaseUrl()}${path}`, {
		cache: 'no-store',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			...init?.headers,
		},
		...init,
	});

	const rawText = await response.text();
	let body: unknown = null;

	if (rawText) {
		try {
			body = JSON.parse(rawText) as unknown;
		} catch {
			body = { message: rawText };
		}
	}

	if (!response.ok) {
		const errorMessage =
			typeof body === 'object' &&
			body !== null &&
			'message' in body &&
			typeof body.message === 'string'
				? body.message
				: `Request failed with status ${response.status}`;

		throw new Error(errorMessage);
	}

	return body as T;
}

export async function getActivitiesByMonth(
	year: number,
	month: number,
): Promise<ActivitiesListResponse> {
	if (!Number.isInteger(year) || year < 1) {
		throw new Error('Invalid year. Use a positive integer year.');
	}

	if (!Number.isInteger(month) || month < 1 || month > 12) {
		throw new Error('Invalid month. Use 1 to 12.');
	}

	return requestJson<ActivitiesListResponse>(`/api/activities/month/${year}/${month}`);
}

export async function getActivitiesByDate(
	date: string | Date,
): Promise<ActivitiesListResponse> {
	return requestJson<ActivitiesListResponse>(
		`/api/activities/date/${normalizeDate(date)}`,
	);
}

export async function createActivity(
	payload: ActivityMutationPayload,
): Promise<ActivityMutationResponse> {
	return requestJson<ActivityMutationResponse>('/api/activities', {
		method: 'POST',
		body: JSON.stringify({
			activity_date: normalizeDate(payload.activity_date),
			activity_point: payload.activity_point,
			activity_description: payload.activity_description,
		}),
	});
}

export async function updateActivity(
	activityId: number,
	payload: ActivityMutationPayload,
): Promise<ActivityMutationResponse> {
	if (!Number.isInteger(activityId) || activityId < 1) {
		throw new Error('Invalid activity id. Use a positive integer id.');
	}

	return requestJson<ActivityMutationResponse>(`/api/activities/${activityId}`, {
		method: 'PATCH',
		body: JSON.stringify({
			activity_date: normalizeDate(payload.activity_date),
			activity_point: payload.activity_point,
			activity_description: payload.activity_description,
		}),
	});
}

export async function deleteActivity(
	activityId: number,
): Promise<ActivityDeleteResponse> {
	if (!Number.isInteger(activityId) || activityId < 1) {
		throw new Error('Invalid activity id. Use a positive integer id.');
	}

	return requestJson<ActivityDeleteResponse>(`/api/activities/${activityId}`, {
		method: 'DELETE',
	});
}

export async function getTags(): Promise<TagsListResponse> {
	return requestJson<TagsListResponse>('/api/tags');
}

export async function createTag(
	payload: TagMutationPayload,
): Promise<TagMutationResponse> {
	if (!payload.tag_name.trim()) {
		throw new Error('Tag name is required.');
	}

	return requestJson<TagMutationResponse>('/api/tags', {
		method: 'POST',
		body: JSON.stringify({
			tag_name: payload.tag_name,
		}),
	});
}

export async function updateTag(
	tagId: number,
	payload: TagMutationPayload,
): Promise<TagMutationResponse> {
	if (!Number.isInteger(tagId) || tagId < 1) {
		throw new Error('Invalid tag id. Use a positive integer id.');
	}

	if (!payload.tag_name.trim()) {
		throw new Error('Tag name is required.');
	}

	return requestJson<TagMutationResponse>(`/api/tags/${tagId}`, {
		method: 'PATCH',
		body: JSON.stringify({
			tag_name: payload.tag_name,
		}),
	});
}

export async function deleteTag(tagId: number): Promise<TagDeleteResponse> {
	if (!Number.isInteger(tagId) || tagId < 1) {
		throw new Error('Invalid tag id. Use a positive integer id.');
	}

	return requestJson<TagDeleteResponse>(`/api/tags/${tagId}`, {
		method: 'DELETE',
	});
}

export async function getActivityTags(): Promise<ActivityTagsListResponse> {
	return requestJson<ActivityTagsListResponse>('/api/activity-tags');
}

export async function createActivityTag(
	payload: ActivityTagMutationPayload,
): Promise<ActivityTagMutationResponse> {
	if (!Number.isInteger(payload.activity_id) || payload.activity_id < 1) {
		throw new Error('Invalid activity id. Use a positive integer id.');
	}

	if (!Number.isInteger(payload.tag_id) || payload.tag_id < 1) {
		throw new Error('Invalid tag id. Use a positive integer id.');
	}

	if (payload.tag_value !== null && !Number.isFinite(payload.tag_value)) {
		throw new Error('Invalid tag value. Use a number or null.');
	}

	return requestJson<ActivityTagMutationResponse>('/api/activity-tags', {
		method: 'POST',
		body: JSON.stringify({
			activity_tag_date: normalizeDate(payload.activity_tag_date),
			activity_id: payload.activity_id,
			tag_id: payload.tag_id,
			tag_value: payload.tag_value,
		}),
	});
}

export async function updateActivityTag(
	activityTagId: number,
	payload: ActivityTagMutationPayload,
): Promise<ActivityTagMutationResponse> {
	if (!Number.isInteger(activityTagId) || activityTagId < 1) {
		throw new Error('Invalid activity-tag id. Use a positive integer id.');
	}

	if (!Number.isInteger(payload.activity_id) || payload.activity_id < 1) {
		throw new Error('Invalid activity id. Use a positive integer id.');
	}

	if (!Number.isInteger(payload.tag_id) || payload.tag_id < 1) {
		throw new Error('Invalid tag id. Use a positive integer id.');
	}

	if (payload.tag_value !== null && !Number.isFinite(payload.tag_value)) {
		throw new Error('Invalid tag value. Use a number or null.');
	}

	return requestJson<ActivityTagMutationResponse>(`/api/activity-tags/${activityTagId}`, {
		method: 'PATCH',
		body: JSON.stringify({
			activity_tag_date: normalizeDate(payload.activity_tag_date),
			activity_id: payload.activity_id,
			tag_id: payload.tag_id,
			tag_value: payload.tag_value,
		}),
	});
}

export async function deleteActivityTag(
	activityTagId: number,
): Promise<ActivityTagDeleteResponse> {
	if (!Number.isInteger(activityTagId) || activityTagId < 1) {
		throw new Error('Invalid activity-tag id. Use a positive integer id.');
	}

	return requestJson<ActivityTagDeleteResponse>(`/api/activity-tags/${activityTagId}`, {
		method: 'DELETE',
	});
}
