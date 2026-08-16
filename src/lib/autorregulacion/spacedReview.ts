const REVIEW_INTERVALS_DAYS = [1, 3, 7, 16] as const;

export function suggestedReviewDates(startDate: Date): Date[] {
	return REVIEW_INTERVALS_DAYS.map((days) => {
		const date = new Date(startDate);
		date.setDate(date.getDate() + days);
		return date;
	});
}
