migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('diagnostic_questions');
		collection.fields.add(new Field({ type: 'bool', name: 'reverse_scored' }));
		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('diagnostic_questions');
		collection.fields.remove('reverse_scored');
		app.save(collection);
	}
);
