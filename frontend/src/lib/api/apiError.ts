import type { ValidationErrorResponse, ValidationErrors } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function isValidationErrorResponse(payload: unknown): payload is ValidationErrorResponse {
	if (!isRecord(payload)) {
		return false;
	}

	if (typeof payload.message !== 'string') {
		return false;
	}

	if (!isRecord(payload.errors)) {
		return false;
	}

	return Object.values(payload.errors).every(
		(value) => Array.isArray(value) && value.every((item) => typeof item === 'string'),
	);
}

function extractMessage(status: number, payload: unknown): string {
	if (isRecord(payload) && typeof payload.message === 'string' && payload.message.trim()) {
		return payload.message;
	}

	if (typeof payload === 'string' && payload.trim()) {
		return payload;
	}

	return `Request failed with status ${status}.`;
}

export class ApiError extends Error {
	readonly status: number;
	readonly payload: unknown;
	readonly validationErrors?: ValidationErrors;

	constructor(options: {
		status: number;
		message: string;
		payload: unknown;
		validationErrors?: ValidationErrors;
	}) {
		super(options.message);
		this.name = 'ApiError';
		this.status = options.status;
		this.payload = options.payload;
		this.validationErrors = options.validationErrors;
	}

	static fromResponse(status: number, payload: unknown): ApiError {
		const message = extractMessage(status, payload);
		const validationErrors = isValidationErrorResponse(payload) ? payload.errors : undefined;

		return new ApiError({
			status,
			message,
			payload,
			validationErrors,
		});
	}

	get isValidationError(): boolean {
		return this.status === 422 && Boolean(this.validationErrors);
	}
}

export function isApiError(error: unknown): error is ApiError {
	return error instanceof ApiError;
}

export function getValidationErrors(error: unknown): ValidationErrors | null {
	if (!(error instanceof ApiError)) {
		return null;
	}

	if (!error.isValidationError || !error.validationErrors) {
		return null;
	}

	return error.validationErrors;
}

export function getFieldErrors(error: unknown, fieldName: string): string[] {
	const errors = getValidationErrors(error);
	if (!errors) {
		return [];
	}

	return errors[fieldName] ?? [];
}

export function getValidationErrorMap(error: unknown): ValidationErrors {
	const errors = getValidationErrors(error);
	return errors ?? {};
}

export function getNotFoundMessage(error: unknown): string | null {
	if (!(error instanceof ApiError)) {
		return null;
	}

	if (error.status !== 404) {
		return null;
	}

	return error.message;
}

export type ParsedFormApiError = {
	status: number | null;
	message: string;
	fieldErrors: ValidationErrors;
	notFoundMessage: string | null;
	isValidationError: boolean;
	isNotFound: boolean;
};

export function parseFormApiError(
	error: unknown,
	fallbackMessage = 'Terjadi kesalahan yang tidak terduga.',
): ParsedFormApiError {
	if (error instanceof ApiError) {
		const fieldErrors = getValidationErrorMap(error);
		const notFoundMessage = getNotFoundMessage(error);

		return {
			status: error.status,
			message: error.message,
			fieldErrors,
			notFoundMessage,
			isValidationError: error.status === 422,
			isNotFound: error.status === 404,
		};
	}

	if (error instanceof Error && error.message) {
		return {
			status: null,
			message: error.message,
			fieldErrors: {},
			notFoundMessage: null,
			isValidationError: false,
			isNotFound: false,
		};
	}

	return {
		status: null,
		message: fallbackMessage,
		fieldErrors: {},
		notFoundMessage: null,
		isValidationError: false,
		isNotFound: false,
	};
}
