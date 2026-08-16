import type { StudySessionRecord } from '$lib/pocketbase/types';
import { suggestedReviewDates } from '$lib/autorregulacion/spacedReview';

export interface UpcomingReview {
	topic: string;
	date: Date;
	overdue: boolean;
}

export function computeUpcomingReviews(sessions: StudySessionRecord[]): UpcomingReview[] {
	const latestByTopic = new Map<string, StudySessionRecord>();
	for (const s of sessions) {
		if (s.status !== 'completada' || !s.completed_at) continue;
		const existing = latestByTopic.get(s.topic);
		if (!existing || new Date(s.completed_at) > new Date(existing.completed_at as string)) {
			latestByTopic.set(s.topic, s);
		}
	}

	const now = new Date();
	const reviews: UpcomingReview[] = [];
	for (const [topic, session] of latestByTopic) {
		for (const date of suggestedReviewDates(new Date(session.completed_at as string))) {
			reviews.push({ topic, date, overdue: date < now });
		}
	}

	return reviews.sort((a, b) => a.date.getTime() - b.date.getTime());
}
