import type { MetacognitionResponseRecord } from '$lib/pocketbase/types';

export type CalibrationTier = 'sobrestimado' | 'calibrado' | 'subestimado';

export interface CalibrationResult {
	metric: 'duration' | 'difficulty' | 'success';
	predicted: number;
	actual: number;
	gap: number;
	tier: CalibrationTier;
}

const TIER_THRESHOLD = 0.2;

function tierFor(predicted: number, actual: number, gap: number): CalibrationTier {
	const reference = Math.max(Math.abs(predicted), 1);
	const relativeGap = Math.abs(gap) / reference;
	if (relativeGap <= TIER_THRESHOLD) return 'calibrado';
	return gap > 0 ? 'subestimado' : 'sobrestimado';
}

function compare(
	metric: CalibrationResult['metric'],
	predicted: number,
	actual: number
): CalibrationResult {
	const gap = actual - predicted;
	return { metric, predicted, actual, gap, tier: tierFor(predicted, actual, gap) };
}

export function computeCalibration(response: MetacognitionResponseRecord): CalibrationResult[] {
	const results: CalibrationResult[] = [];

	if (response.actual_duration_minutes != null) {
		results.push(
			compare('duration', response.predicted_duration_minutes, response.actual_duration_minutes)
		);
	}
	if (response.actual_difficulty != null) {
		results.push(compare('difficulty', response.predicted_difficulty, response.actual_difficulty));
	}
	if (response.actual_success != null) {
		results.push(compare('success', response.predicted_success, response.actual_success));
	}

	return results;
}
