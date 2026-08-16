migrate(
	(app) => {
		const usersCollection = app.findCollectionByNameOrId('users');

		const collection = new Collection({
			type: 'base',
			name: 'concept_maps',
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
				// not required: PocketBase's json required-validator rejects "[]" as blank,
				// but an empty map (no concepts yet) is a valid starting state.
				{ type: 'json', name: 'nodes' },
				{ type: 'json', name: 'edges' },
				{ type: 'autodate', name: 'created', onCreate: true },
				{ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
			],
			indexes: ['CREATE UNIQUE INDEX idx_concept_maps_user ON concept_maps (user)']
		});

		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('concept_maps');
		app.delete(collection);
	}
);
