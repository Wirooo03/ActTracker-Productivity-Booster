import type { DurationHHMMSS, TimeHHMMSS } from './types';

const FLEX_DURATION_PATTERN = /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/;
const STRICT_HHMMSS_DURATION_PATTERN = /^(\d{2,3}):(\d{2}):(\d{2})$/;
const FLEX_TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const STRICT_HHMMSS_TIME_PATTERN = /^(\d{2}):(\d{2}):(\d{2})$/;

function parseIntStrict(value: string): number | null {
	const parsed = Number(value);
	return Number.isInteger(parsed) ? parsed : null;
}

export function isValidDurationHHMMSS(value: string): boolean {
	const matched = value.trim().match(STRICT_HHMMSS_DURATION_PATTERN);
	if (!matched) {
		return false;
	}

	const minutes = parseIntStrict(matched[2]);
	const seconds = parseIntStrict(matched[3]);

	return minutes !== null && seconds !== null && minutes <= 59 && seconds <= 59;
}

export function normalizeDurationHHMMSS(value: string): DurationHHMMSS | null {
	const matched = value.trim().match(FLEX_DURATION_PATTERN);
	if (!matched) {
		return null;
	}

	const hours = parseIntStrict(matched[1]);
	const minutes = parseIntStrict(matched[2]);
	const seconds = parseIntStrict(matched[3] ?? '0');

	if (hours === null || minutes === null || seconds === null) {
		return null;
	}

	if (hours < 0 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
		return null;
	}

	const hourText = String(hours).padStart(2, '0');
	const minuteText = String(minutes).padStart(2, '0');
	const secondText = String(seconds).padStart(2, '0');
	return `${hourText}:${minuteText}:${secondText}`;
}

export function durationHHMMSSToSeconds(value: string): number | null {
	const normalized = normalizeDurationHHMMSS(value);
	if (!normalized) {
		return null;
	}

	const [hoursText, minutesText, secondsText] = normalized.split(':');
	const hours = Number(hoursText);
	const minutes = Number(minutesText);
	const seconds = Number(secondsText);

	return hours * 3600 + minutes * 60 + seconds;
}

export function secondsToDurationHHMMSS(totalSeconds: number): DurationHHMMSS | null {
	if (!Number.isInteger(totalSeconds) || totalSeconds < 0) {
		return null;
	}

	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const hourText = String(hours).padStart(2, '0');
	const minuteText = String(minutes).padStart(2, '0');
	const secondText = String(seconds).padStart(2, '0');
	return `${hourText}:${minuteText}:${secondText}`;
}

export function isValidTimeHHMMSS(value: string): boolean {
	const matched = value.trim().match(STRICT_HHMMSS_TIME_PATTERN);
	if (!matched) {
		return false;
	}

	const hours = parseIntStrict(matched[1]);
	const minutes = parseIntStrict(matched[2]);
	const seconds = parseIntStrict(matched[3]);

	return (
		hours !== null &&
		minutes !== null &&
		seconds !== null &&
		hours >= 0 &&
		hours <= 23 &&
		minutes >= 0 &&
		minutes <= 59 &&
		seconds >= 0 &&
		seconds <= 59
	);
}

export function normalizeTimeHHMMSS(value: string): TimeHHMMSS | null {
	const matched = value.trim().match(FLEX_TIME_PATTERN);
	if (!matched) {
		return null;
	}

	const hours = parseIntStrict(matched[1]);
	const minutes = parseIntStrict(matched[2]);
	const seconds = parseIntStrict(matched[3] ?? '0');

	if (hours === null || minutes === null || seconds === null) {
		return null;
	}

	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
		return null;
	}

	const hourText = String(hours).padStart(2, '0');
	const minuteText = String(minutes).padStart(2, '0');
	const secondText = String(seconds).padStart(2, '0');
	return `${hourText}:${minuteText}:${secondText}`;
}

export function timeHHMMSSToSeconds(value: string): number | null {
	const normalized = normalizeTimeHHMMSS(value);
	if (!normalized) {
		return null;
	}

	const [hoursText, minutesText, secondsText] = normalized.split(':');
	const hours = Number(hoursText);
	const minutes = Number(minutesText);
	const seconds = Number(secondsText);

	return hours * 3600 + minutes * 60 + seconds;
}
