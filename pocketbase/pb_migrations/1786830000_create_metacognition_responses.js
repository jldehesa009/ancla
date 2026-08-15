migrate(
	(app) => {
		const usersCollection = app.findCollectionByNameOrId('users');

		const collection = new Collection({
			type: 'base',
			name: 'metacognition_responses',
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
				{ type: 'text', name: 'task_description', required: true },
				{ type: 'number', name: 'predicted_duration_minutes', required: true },
				{ type: 'number', name: 'predicted_difficulty', required: true },
				{ type: 'number', name: 'predicted_success', required: true },
				{ type: 'date', name: 'started_at' },
				{
					type: 'select',
					name: 'mid_check_response',
					maxSelect: 1,
					values: ['si', 'no']
				},
				{ type: 'number', name: 'actual_duration_minutes' },
				{ type: 'number', name: 'actual_difficulty' },
				{ type: 'number', name: 'actual_success' },
				{ type: 'text', name: 'reflection' },
				{ type: 'date', name: 'completed_at' },
				{ type: 'autodate', name: 'created', onCreate: true },
				{ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
			]
		});

		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('metacognition_responses');
		app.delete(collection);
	}
);
