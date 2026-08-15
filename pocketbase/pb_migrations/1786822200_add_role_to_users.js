migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('users');

		collection.fields.add(
			new Field({
				type: 'select',
				name: 'role',
				required: true,
				maxSelect: 1,
				values: ['estudiante', 'editor_contenido']
			})
		);

		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('users');
		collection.fields.remove('role');
		app.save(collection);
	}
);
