migrate(
	(app) => {
		const usersCollection = app.findCollectionByNameOrId('users');
		const collection = new Collection({
			type: 'base',
			name: 'study_sessions',
			listRule: '@request.auth.id != "" && user = @request.auth.id',
			viewRule: '@request.auth.id != "" && user = @request.auth.id',
			createRule: '@request.auth.id != "" && user = @request.auth.id',
			updateRule: '@request.auth.id != "" && user = @request.auth.id',
			deleteRule: '@request.auth.id != "" && user = @request.auth.id',
			fields: [
				{
					type: 'relation',
					name: 'user',
					required: true,
					maxSelect: 1,
					collectionId: usersCollection.id,
					cascadeDelete: true
				},
				{ type: 'text', name: 'topic', required: true },
				{ type: 'date', name: 'planned_date', required: true },
				{
					type: 'select',
					name: 'status',
					required: true,
					maxSelect: 1,
					values: ['planeada', 'completada']
				},
				{ type: 'date', name: 'completed_at' },
				{ type: 'autodate', name: 'created', onCreate: true },
				{ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
			]
		});
		app.save(collection);
	},
	(app) => app.delete(app.findCollectionByNameOrId('study_sessions'))
);
