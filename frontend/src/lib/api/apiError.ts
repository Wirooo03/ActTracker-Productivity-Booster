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
