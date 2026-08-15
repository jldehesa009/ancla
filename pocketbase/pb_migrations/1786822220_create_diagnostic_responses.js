migrate(
	(app) => {
		const usersCollection = app.findCollectionByNameOrId('users');

		const collection = new Collection({
			type: 'base',
			name: 'diagnostic_responses',
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
				// { question_id: answer_value } for every diagnostic_questions record answered
				{ type: 'json', name: 'answers', required: true },
				{ type: 'autodate', name: 'completed_at', onCreate: true }
			],
			indexes: ['CREATE UNIQUE INDEX idx_diagnostic_responses_user ON diagnostic_responses (user)']
		});

		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('diagnostic_responses');
		app.delete(collection);
	}
);
