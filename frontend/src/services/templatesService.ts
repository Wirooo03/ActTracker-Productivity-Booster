import { httpClient } from '@/lib/api/httpClient';
import type {
	ApiDeleteResponse,
	ApiItemResponse,
	ApiListResponse,
	ApiMutationResponse,
	CreateActivityFromTemplateRequest,
	CreateActivityFromTemplateResponse,
	Template,
	TemplateCreatePayload,
	TemplateListQuery,
	TemplatePatchPayload,
	TemplatePutPayload,
} from '@/lib/api/types';

const TEMPLATES_ENDPOINT = '/api/templates';
const MAX_LIST_PER_PAGE = 200;

function assertPositiveInteger(name: string, value: number): void {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}
}

function assertDateString(name: string, value: string): void {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new Error(`${name} must use YYYY-MM-DD format.`);
	}
}

function normalizeListQuery(query?: TemplateListQuery): TemplateListQuery | undefined {
	if (!query) {
		return query;
	}

	const normalizedQuery: TemplateListQuery = { ...query };

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

function normalizeCreateActivityPayload(
	payload: CreateActivityFromTemplateRequest,
): CreateActivityFromTemplateRequest {
	assertDateString('activity_date', payload.activity_date);

	const normalizedPayload: CreateActivityFromTemplateRequest = {
		activity_date: payload.activity_date,
	};

	if (payload.activity_description !== undefined) {
		normalizedPayload.activity_description = payload.activity_description;
	}

	if (payload.activity_point !== undefined) {
		normalizedPayload.activity_point = payload.activity_point;
	}

	return normalizedPayload;
}

async function list(query?: TemplateListQuery): Promise<ApiListResponse<Template>> {
	return httpClient.get<ApiListResponse<Template>>(TEMPLATES_ENDPOINT, {
		query: normalizeListQuery(query),
	});
}

async function getById(templateId: number): Promise<ApiItemResponse<Template>> {
	assertPositiveInteger('templateId', templateId);
	return httpClient.get<ApiItemResponse<Template>>(`${TEMPLATES_ENDPOINT}/${templateId}`);
}

async function create(payload: TemplateCreatePayload): Promise<ApiMutationResponse<Template>> {
	return httpClient.post<ApiMutationResponse<Template>, TemplateCreatePayload>(
		TEMPLATES_ENDPOINT,
		payload,
	);
}

async function replace(
	templateId: number,
	payload: TemplatePutPayload,
): Promise<ApiMutationResponse<Template>> {
	assertPositiveInteger('templateId', templateId);
	return httpClient.put<ApiMutationResponse<Template>, TemplatePutPayload>(
		`${TEMPLATES_ENDPOINT}/${templateId}`,
		payload,
	);
}

async function update(
	templateId: number,
	payload: TemplatePatchPayload,
): Promise<ApiMutationResponse<Template>> {
	assertPositiveInteger('templateId', templateId);
	return httpClient.patch<ApiMutationResponse<Template>, TemplatePatchPayload>(
		`${TEMPLATES_ENDPOINT}/${templateId}`,
		payload,
	);
}

async function remove(templateId: number): Promise<ApiDeleteResponse> {
	assertPositiveInteger('templateId', templateId);
	return httpClient.delete<ApiDeleteResponse>(`${TEMPLATES_ENDPOINT}/${templateId}`);
}

async function createActivityFromTemplate(
	templateId: number,
	payload: CreateActivityFromTemplateRequest,
): Promise<CreateActivityFromTemplateResponse> {
	assertPositiveInteger('templateId', templateId);

	return httpClient.post<
		CreateActivityFromTemplateResponse,
		CreateActivityFromTemplateRequest
	>(
		`${TEMPLATES_ENDPOINT}/${templateId}/activities`,
		normalizeCreateActivityPayload(payload),
	);
}

export const templatesService = {
	list,
	getById,
	create,
	replace,
	update,
	remove,
	createActivityFromTemplate,
};
