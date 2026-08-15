import type { DiagnosticCategory, DiagnosticQuestionRecord } from '$lib/pocketbase/types';

export const CATEGORY_LABELS: Record<DiagnosticCategory, string> = {
	organizacion: 'Organización',
	motivacion: 'Motivación',
	estrategias_estudio: 'Estrategias de estudio',
	autorregulacion: 'Autorregulación'
};

export type ScoreTier = 'a_fortalecer' | 'en_desarrollo' | 'consolidado';

export const TIER_LABELS: Record<ScoreTier, string> = {
	a_fortalecer: 'A fortalecer',
	en_desarrollo: 'En desarrollo',
	consolidado: 'Consolidado'
};

export interface CategoryScore {
	category: DiagnosticCategory;
	average: number;
	tier: ScoreTier;
}

function scoreFor(question: DiagnosticQuestionRecord, rawValue: number): number {
	return question.reverse_scored ? 6 - rawValue : rawValue;
}

function tierFor(average: number): ScoreTier {
	if (average < 2.5) return 'a_fortalecer';
	if (average < 3.75) return 'en_desarrollo';
	return 'consolidado';
}

export function computeCategoryScores(
	questions: DiagnosticQuestionRecord[],
	answers: Record<string, number>
): CategoryScore[] {
	const rawScoresByCategory = new Map<DiagnosticCategory, number[]>();

	for (const question of questions) {
		const rawValue = answers[question.id];
		if (rawValue == null) continue;

		const scores = rawScoresByCategory.get(question.category) ?? [];
		scores.push(scoreFor(question, rawValue));
		rawScoresByCategory.set(question.category, scores);
	}

	return Array.from(rawScoresByCategory.entries()).map(([category, scores]) => {
		const average = scores.reduce((a, b) => a + b, 0) / scores.length;
		return { category, average, tier: tierFor(average) };
	});
}
