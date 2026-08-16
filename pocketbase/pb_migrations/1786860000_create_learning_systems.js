migrate(
	(app) => {
		const usersCollection = app.findCollectionByNameOrId('users');
		const collection = new Collection({
			type: 'base',
			name: 'learning_systems',
			listRule: '@request.auth.id != "" && user = @request.auth.id',
			viewRule: '@request.auth.id != "" && user = @request.auth.id',
			createRule: '@request.auth.id != "" && user = @request.auth.id',
			updateRule: '@request.auth.id != "" && user = @request.auth.id',
			deleteRule: null,
			fields: [
				{
					type: 'relation',
					name: 'user',
					required: true,
					maxSelect: 1,
					collectionId: usersCollection.id,
					cascadeDelete: true
				},
				{ type: 'text', name: 'subject', required: true },
				{ type: 'text', name: 'personal_summary' },
				{ type: 'autodate', name: 'created', onCreate: true },
				{ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
			],
			indexes: ['CREATE UNIQUE INDEX idx_learning_systems_user ON learning_systems (user)']
		});
		app.save(collection);
	},
	(app) => app.delete(app.findCollectionByNameOrId('learning_systems'))
);
