import { httpClient } from '@/lib/api/httpClient';
import type {
	ApiDeleteResponse,
	ApiItemResponse,
	ApiListResponse,
	ApiMutationResponse,
	TemplateTag,
	TemplateTagCreatePayload,
	TemplateTagListQuery,
	TemplateTagPatchPayload,
	TemplateTagPutPayload,
} from '@/lib/api/types';

const TEMPLATE_TAGS_ENDPOINT = '/api/template-tags';
const MAX_LIST_PER_PAGE = 200;

function assertPositiveInteger(name: string, value: number): void {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}
}

function normalizeListQuery(query?: TemplateTagListQuery): TemplateTagListQuery | undefined {
	if (!query) {
		return query;
	}

	const normalizedQuery: TemplateTagListQuery = { ...query };

	if (
		typeof normalizedQuery.per_page === 'number' &&
		normalizedQuery.per_page > MAX_LIST_PER_PAGE
	) {
		normalizedQuery.per_page = MAX_LIST_PER_PAGE;
	}

	if (Array.isArray(normalizedQuery.fields)) {
		normalizedQuery.fields = normalizedQuery.fields
			.map((field) => field.trim())
			.filter((field) => field.length > 0)
			.join(',');
	}

	if (Array.isArray(normalizedQuery.include)) {
		normalizedQuery.include = normalizedQuery.include
			.map((relation) => relation.trim())
			.filter((relation) => relation.length > 0)
			.join(',');
	}

	return normalizedQuery;
}

async function list(query?: TemplateTagListQuery): Promise<ApiListResponse<TemplateTag>> {
	return httpClient.get<ApiListResponse<TemplateTag>>(TEMPLATE_TAGS_ENDPOINT, {
		query: normalizeListQuery(query),
	});
}

async function getById(templateTagsId: number): Promise<ApiItemResponse<TemplateTag>> {
	assertPositiveInteger('templateTagsId', templateTagsId);
	return httpClient.get<ApiItemResponse<TemplateTag>>(
		`${TEMPLATE_TAGS_ENDPOINT}/${templateTagsId}`,
	);
}

async function create(
	payload: TemplateTagCreatePayload,
): Promise<ApiMutationResponse<TemplateTag>> {
	return httpClient.post<ApiMutationResponse<TemplateTag>, TemplateTagCreatePayload>(
		TEMPLATE_TAGS_ENDPOINT,
		payload,
	);
}

async function replace(
	templateTagsId: number,
	payload: TemplateTagPutPayload,
): Promise<ApiMutationResponse<TemplateTag>> {
	assertPositiveInteger('templateTagsId', templateTagsId);
	return httpClient.put<ApiMutationResponse<TemplateTag>, TemplateTagPutPayload>(
		`${TEMPLATE_TAGS_ENDPOINT}/${templateTagsId}`,
		payload,
	);
}

async function update(
	templateTagsId: number,
	payload: TemplateTagPatchPayload,
): Promise<ApiMutationResponse<TemplateTag>> {
	assertPositiveInteger('templateTagsId', templateTagsId);
	return httpClient.patch<ApiMutationResponse<TemplateTag>, TemplateTagPatchPayload>(
		`${TEMPLATE_TAGS_ENDPOINT}/${templateTagsId}`,
		payload,
	);
}

async function remove(templateTagsId: number): Promise<ApiDeleteResponse> {
	assertPositiveInteger('templateTagsId', templateTagsId);
	return httpClient.delete<ApiDeleteResponse>(`${TEMPLATE_TAGS_ENDPOINT}/${templateTagsId}`);
}

export const templateTagsService = {
	list,
	getById,
	create,
	replace,
	update,
	remove,
};
