migrate(
	(app) => {
		const collection = new Collection({
			type: 'base',
			name: 'diagnostic_questions',
			listRule: "@request.auth.id != ''",
			viewRule: "@request.auth.id != ''",
			createRule: "@request.auth.role = 'editor_contenido'",
			updateRule: "@request.auth.role = 'editor_contenido'",
			deleteRule: "@request.auth.role = 'editor_contenido'",
			fields: [
				{ type: 'text', name: 'text', required: true },
				{
					type: 'select',
					name: 'category',
					required: true,
					maxSelect: 1,
					values: ['organizacion', 'motivacion', 'estrategias_estudio', 'autorregulacion']
				},
				{ type: 'number', name: 'order', required: true },
				{ type: 'bool', name: 'active' },
				{ type: 'autodate', name: 'created', onCreate: true },
				{ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
			]
		});

		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('diagnostic_questions');
		app.delete(collection);
	}
);
