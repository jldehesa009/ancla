// Seed data for local dev/testing. Placeholder wording only —
// final diagnostic copy is the team's content work, not this seed.
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('diagnostic_questions');

		const questions = [
			{
				text: 'Antes de empezar a estudiar, sé exactamente qué quiero lograr en esa sesión.',
				category: 'organizacion',
				order: 1,
				active: true
			},
			{
				text: 'Tengo un espacio y horario fijos para estudiar cada semana.',
				category: 'organizacion',
				order: 2,
				active: true
			},
			{
				text: 'Cuando algo no me interesa, me cuesta mucho obligarme a estudiarlo igual.',
				category: 'motivacion',
				order: 3,
				active: true
			},
			{
				text: 'Sigo estudiando aunque no vea resultados inmediatos.',
				category: 'motivacion',
				order: 4,
				active: true
			},
			{
				text: 'Cuando leo un tema nuevo, intento relacionarlo con algo que ya sé.',
				category: 'estrategias_estudio',
				order: 5,
				active: true
			},
			{
				text: 'Prefiero memorizar textualmente antes que explicar un tema con mis propias palabras.',
				category: 'estrategias_estudio',
				order: 6,
				active: true
			},
			{
				text: 'Al terminar de estudiar, reviso si de verdad entendí o solo "pasé la vista".',
				category: 'autorregulacion',
				order: 7,
				active: true
			},
			{
				text: 'Cuando repruebo o me va mal, identifico qué parte de mi forma de estudiar falló.',
				category: 'autorregulacion',
				order: 8,
				active: true
			}
		];

		for (const q of questions) {
			const record = new Record(collection, q);
			app.save(record);
		}
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('diagnostic_questions');
		const records = app.findRecordsByFilter(collection.id, '', '', 100, 0);
		for (const record of records) {
			app.delete(record);
		}
	}
);
