'use client';

import { useCallback, useEffect, useState } from 'react';
import { parseFormApiError } from '@/lib/api/apiError';
import type {
	Activity,
	CreateActivityFromTemplateRequest,
	Template,
	TemplateCreatePayload,
	ValidationErrors,
} from '@/lib/api/types';
import { templatesService } from '@/services/templatesService';

function normalizeTemplates(items: Template[]): Template[] {
	return [...items].sort((left, right) => {
		const nameCompare = left.template_name.localeCompare(right.template_name, 'id-ID', {
			sensitivity: 'base',
		});

		if (nameCompare !== 0) {
			return nameCompare;
		}

		return left.template_id - right.template_id;
	});
}

function upsertTemplate(items: Template[], nextItem: Template): Template[] {
	const filtered = items.filter((item) => item.template_id !== nextItem.template_id);
	return normalizeTemplates([nextItem, ...filtered]);
}

export function useTemplatesServiceExample() {
	const [templates, setTemplates] = useState<Template[]>([]);
	const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
	const [templatesLoadError, setTemplatesLoadError] = useState<string | null>(null);

	const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
	const [createTemplateMessage, setCreateTemplateMessage] = useState<string | null>(null);
	const [createTemplateError, setCreateTemplateError] = useState<string | null>(null);
	const [createTemplateFieldErrors, setCreateTemplateFieldErrors] = useState<ValidationErrors>({});

	const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
	const [applyTemplateMessage, setApplyTemplateMessage] = useState<string | null>(null);
	const [applyTemplateError, setApplyTemplateError] = useState<string | null>(null);
	const [applyTemplateNotFoundMessage, setApplyTemplateNotFoundMessage] = useState<string | null>(null);
	const [applyTemplateFieldErrors, setApplyTemplateFieldErrors] = useState<ValidationErrors>({});
	const [createdActivitiesFromTemplate, setCreatedActivitiesFromTemplate] = useState<Activity[]>([]);

	const loadTemplates = useCallback(async (): Promise<void> => {
		setIsLoadingTemplates(true);
		setTemplatesLoadError(null);

		try {
			const response = await templatesService.list({
				include: ['template_tags', 'template_tags.tag'],
			});
			setTemplates(normalizeTemplates(response.data));
		} catch (error) {
			const parsed = parseFormApiError(error, 'Gagal memuat list template.');
			setTemplates([]);
			setTemplatesLoadError(parsed.message);
		} finally {
			setIsLoadingTemplates(false);
		}
	}, []);

	useEffect(() => {
		void loadTemplates();
	}, [loadTemplates]);

	const createTemplate = useCallback(
		async (payload: TemplateCreatePayload): Promise<boolean> => {
			setIsCreatingTemplate(true);
			setCreateTemplateMessage(null);
			setCreateTemplateError(null);
			setCreateTemplateFieldErrors({});

			try {
				const response = await templatesService.create(payload);
				setTemplates((current) => upsertTemplate(current, response.data));
				setCreateTemplateMessage(response.message);
				return true;
			} catch (error) {
				const parsed = parseFormApiError(error, 'Gagal membuat template.');
				setCreateTemplateFieldErrors(parsed.fieldErrors);
				setCreateTemplateError(parsed.message);
				return false;
			} finally {
				setIsCreatingTemplate(false);
			}
		},
		[],
	);

	const applyTemplate = useCallback(
		async (
			templateId: number,
			payload: CreateActivityFromTemplateRequest,
		): Promise<boolean> => {
			setIsApplyingTemplate(true);
			setApplyTemplateMessage(null);
			setApplyTemplateError(null);
			setApplyTemplateNotFoundMessage(null);
			setApplyTemplateFieldErrors({});

			try {
				const response = await templatesService.createActivityFromTemplate(templateId, payload);
				setCreatedActivitiesFromTemplate((current) => [response.data, ...current]);
				setApplyTemplateMessage(response.message);
				return true;
			} catch (error) {
				const parsed = parseFormApiError(error, 'Gagal apply template menjadi activity.');
				setApplyTemplateFieldErrors(parsed.fieldErrors);
				setApplyTemplateError(parsed.message);
				setApplyTemplateNotFoundMessage(parsed.notFoundMessage);
				return false;
			} finally {
				setIsApplyingTemplate(false);
			}
		},
		[],
	);

	return {
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
	};
}
