// Marks the two negatively-worded seed items so category averages invert them correctly.
migrate(
	(app) => {
		const reverseTexts = [
			'Cuando algo no me interesa, me cuesta mucho obligarme a estudiarlo igual.',
			'Prefiero memorizar textualmente antes que explicar un tema con mis propias palabras.'
		];

		for (const text of reverseTexts) {
			const record = app.findFirstRecordByFilter('diagnostic_questions', 'text = {:text}', {
				text
			});
			record.set('reverse_scored', true);
			app.save(record);
		}
	},
	(app) => {
		const records = app.findRecordsByFilter('diagnostic_questions', 'reverse_scored = true');
		for (const record of records) {
			record.set('reverse_scored', false);
			app.save(record);
		}
	}
);
