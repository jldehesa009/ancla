<script lang="ts">
	import { pb } from '$lib/pocketbase';
	import type { DiagnosticCategory, DiagnosticQuestionRecord } from '$lib/pocketbase/types';
	import { CATEGORY_LABELS } from '$lib/diagnostico/scoring';

	const CATEGORIES = Object.keys(CATEGORY_LABELS) as DiagnosticCategory[];

	type Status = 'loading' | 'ready' | 'error';

	let status = $state<Status>('loading');
	let errorMessage = $state('');
	let questions = $state<DiagnosticQuestionRecord[]>([]);
	let editingId = $state<string | null>(null);
	let editDraft = $state({
		text: '',
		category: CATEGORIES[0],
		reverse_scored: false
	});
	let creating = $state(false);
	let createDraft = $state({
		text: '',
		category: CATEGORIES[0],
		reverse_scored: false
	});

	async function loadQuestions() {
		status = 'loading';
		errorMessage = '';
		try {
			questions = await pb.collection('diagnostic_questions').getFullList({ sort: 'order' });
			status = 'ready';
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos cargar las preguntas.';
			status = 'error';
		}
	}

	async function toggleActive(question: DiagnosticQuestionRecord) {
		try {
			await pb
				.collection('diagnostic_questions')
				.update(question.id, { active: !question.active });
			await loadQuestions();
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos actualizar la pregunta.';
		}
	}

	async function move(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= questions.length) return;

		const a = questions[index];
		const b = questions[target];
		try {
			await pb.collection('diagnostic_questions').update(a.id, { order: b.order });
			await pb.collection('diagnostic_questions').update(b.id, { order: a.order });
			await loadQuestions();
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos reordenar las preguntas.';
		}
	}

	function startEdit(question: DiagnosticQuestionRecord) {
		editingId = question.id;
		editDraft = {
			text: question.text,
			category: question.category,
			reverse_scored: question.reverse_scored
		};
	}

	function cancelEdit() {
		editingId = null;
	}

	async function saveEdit() {
		if (!editingId) return;
		try {
			await pb.collection('diagnostic_questions').update(editingId, editDraft);
			editingId = null;
			await loadQuestions();
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos guardar los cambios.';
		}
	}

	async function deleteQuestion(question: DiagnosticQuestionRecord) {
		if (!confirm(`¿Borrar la pregunta "${question.text}"?`)) return;
		try {
			await pb.collection('diagnostic_questions').delete(question.id);
			await loadQuestions();
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos borrar la pregunta.';
		}
	}

	async function submitCreate(e: SubmitEvent) {
		e.preventDefault();
		try {
			const nextOrder = questions.reduce((max, q) => Math.max(max, q.order), 0) + 1;
			await pb.collection('diagnostic_questions').create({
				...createDraft,
				order: nextOrder,
				active: true
			});
			createDraft = { text: '', category: CATEGORIES[0], reverse_scored: false };
			creating = false;
			await loadQuestions();
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos crear la pregunta.';
		}
	}

	loadQuestions();
</script>

<svelte:head>
	<title>Preguntas del diagnóstico — Panel</title>
</svelte:head>

<h1>Preguntas del diagnóstico</h1>
<p class="hint">
	Estas preguntas alimentan el Módulo 0. Los cambios se aplican de inmediato para cualquier
	alumno que tome el diagnóstico.
</p>

{#if errorMessage}
	<p class="error" role="alert">{errorMessage}</p>
{/if}

{#if status === 'loading'}
	<p>Cargando…</p>
{:else}
	<ul class="list">
		{#each questions as question, i (question.id)}
			<li class="row" class:inactive={!question.active}>
				{#if editingId === question.id}
					<form
						class="edit-form"
						onsubmit={(e) => {
							e.preventDefault();
							saveEdit();
						}}
					>
						<textarea rows="2" bind:value={editDraft.text} required></textarea>
						<div class="row-fields">
							<select bind:value={editDraft.category}>
								{#each CATEGORIES as category (category)}
									<option value={category}>{CATEGORY_LABELS[category]}</option>
								{/each}
							</select>
							<label class="checkbox">
								<input type="checkbox" bind:checked={editDraft.reverse_scored} />
								Invertida
							</label>
						</div>
						<div class="row-actions">
							<button type="submit" class="primary">Guardar</button>
							<button type="button" class="secondary" onclick={cancelEdit}>Cancelar</button>
						</div>
					</form>
				{:else}
					<div class="order-controls">
						<button
							type="button"
							class="icon-btn"
							onclick={() => move(i, -1)}
							disabled={i === 0}
							aria-label="Subir">▲</button
						>
						<button
							type="button"
							class="icon-btn"
							onclick={() => move(i, 1)}
							disabled={i === questions.length - 1}
							aria-label="Bajar">▼</button
						>
					</div>
					<div class="row-body">
						<p class="text">{question.text}</p>
						<div class="meta">
							<span class="tag">{CATEGORY_LABELS[question.category]}</span>
							{#if question.reverse_scored}
								<span class="tag">invertida</span>
							{/if}
						</div>
					</div>
					<div class="row-actions">
						<label class="checkbox">
							<input
								type="checkbox"
								checked={question.active}
								onchange={() => toggleActive(question)}
							/>
							Activa
						</label>
						<button type="button" class="secondary" onclick={() => startEdit(question)}
							>Editar</button
						>
						<button type="button" class="danger" onclick={() => deleteQuestion(question)}
							>Borrar</button
						>
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	{#if creating}
		<form class="create-form" onsubmit={submitCreate}>
			<h2>Nueva pregunta</h2>
			<textarea rows="2" bind:value={createDraft.text} placeholder="Texto de la pregunta" required
			></textarea>
			<div class="row-fields">
				<select bind:value={createDraft.category}>
					{#each CATEGORIES as category (category)}
						<option value={category}>{CATEGORY_LABELS[category]}</option>
					{/each}
				</select>
				<label class="checkbox">
					<input type="checkbox" bind:checked={createDraft.reverse_scored} />
					Invertida (redactada en negativo)
				</label>
			</div>
			<div class="row-actions">
				<button type="submit" class="primary">Crear pregunta</button>
				<button type="button" class="secondary" onclick={() => (creating = false)}
					>Cancelar</button
				>
			</div>
		</form>
	{:else}
		<button type="button" class="primary add-btn" onclick={() => (creating = true)}>
			+ Nueva pregunta
		</button>
	{/if}
{/if}

<style>
	h1 {
		margin-bottom: var(--space-1);
	}

	.hint {
		color: var(--color-ink-soft);
		margin-bottom: var(--space-3);
	}

	.error {
		color: var(--color-accent);
	}

	.list {
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.row {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		background: var(--color-surface);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-card);
		padding: var(--space-2);
	}

	.row.inactive {
		opacity: 0.55;
	}

	.order-controls {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.icon-btn {
		border: 1px solid var(--color-border);
		background: var(--color-paper);
		border-radius: var(--radius-sm);
		width: 1.75rem;
		height: 1.75rem;
		cursor: pointer;
	}

	.icon-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.row-body {
		flex: 1;
	}

	.text {
		margin: 0 0 0.4rem;
	}

	.meta {
		display: flex;
		gap: 0.4rem;
	}

	.tag {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--color-muted);
		background: var(--color-paper);
		border-radius: var(--radius-pill);
		padding: 0.15rem 0.6rem;
	}

	.row-actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.4rem;
	}

	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: var(--color-ink-soft);
		white-space: nowrap;
	}

	.edit-form,
	.create-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
	}

	.create-form {
		background: var(--color-surface);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-card);
		padding: var(--space-3);
	}

	textarea,
	select {
		font-family: inherit;
		font-size: 1rem;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.row-fields {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		flex-wrap: wrap;
	}

	button {
		border: none;
		border-radius: var(--radius-pill);
		padding: 0.5rem 1rem;
		font-weight: 600;
		cursor: pointer;
	}

	.primary {
		background: var(--color-accent);
		color: var(--color-surface);
	}

	.secondary {
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.danger {
		background: transparent;
		color: var(--color-accent);
	}

	.add-btn {
		width: 100%;
	}
</style>
