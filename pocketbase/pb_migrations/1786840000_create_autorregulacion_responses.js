migrate(
	(app) => {
		const usersCollection = app.findCollectionByNameOrId('users');

		const collection = new Collection({
			type: 'base',
			name: 'autorregulacion_responses',
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
				{
					type: 'select',
					name: 'status',
					required: true,
					maxSelect: 1,
					values: ['en_progreso', 'evaluando', 'completed']
				},
				{ type: 'text', name: 'subject', required: true },
				{ type: 'text', name: 'topic', required: true },
				{ type: 'text', name: 'study_goal', required: true },
				{ type: 'number', name: 'planned_duration_minutes', required: true },
				{ type: 'date', name: 'started_at' },
				{ type: 'number', name: 'actual_duration_minutes' },
				{ type: 'text', name: 'strategy_used' },
				{ type: 'text', name: 'next_adjustment' },
				{ type: 'date', name: 'completed_at' },
				{ type: 'autodate', name: 'created', onCreate: true },
				{ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
			]
		});

		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('autorregulacion_responses');
		app.delete(collection);
	}
);
