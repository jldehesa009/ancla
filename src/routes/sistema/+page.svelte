<script lang="ts">
	import { ClientResponseError } from 'pocketbase';
	import { resolve } from '$app/paths';
	import { pb, getAuthUser } from '$lib/pocketbase';
	import type {
		AutorregulacionResponseRecord,
		ConceptMapRecord,
		DiagnosticQuestionRecord,
		DiagnosticResponseRecord,
		LearningSystemRecord,
		MetacognitionResponseRecord,
		StudySessionRecord
	} from '$lib/pocketbase/types';
	import { CATEGORY_LABELS, TIER_LABELS, computeCategoryScores, type CategoryScore } from '$lib/diagnostico/scoring';
	import { computeCalibration } from '$lib/metacognicion/calibration';
	import { computeUpcomingReviews } from '$lib/sistema/reviewSchedule';

	type Status = 'loading' | 'setup' | 'dashboard' | 'error';

	let status = $state<Status>('loading');
	let errorMessage = $state('');

	let system = $state<LearningSystemRecord | null>(null);
	let subjectInput = $state('');
	let personalSummary = $state('');

	let hasDiagnostic = $state(false);
	let diagnosticScores = $state<CategoryScore[]>([]);
	let metacognitionSummary = $state<MetacognitionResponseRecord | null>(null);
	let autorregulacionSummary = $state<AutorregulacionResponseRecord | null>(null);
	let conceptMap = $state<ConceptMapRecord | null>(null);

	let sessions = $state<StudySessionRecord[]>([]);
	let newTopic = $state('');
	let newPlannedDate = $state('');

	let upcomingReviews = $derived(computeUpcomingReviews(sessions));
	let sortedSessions = $derived(
		[...sessions].sort((a, b) => a.planned_date.localeCompare(b.planned_date))
	);

	const dateFormatter = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

	async function loadSummaries(userId: string) {
		try {
			const questions = await pb
				.collection('diagnostic_questions')
				.getFullList<DiagnosticQuestionRecord>({ filter: 'active = true', sort: 'order' });
			const diagnostic = await pb
				.collection('diagnostic_responses')
				.getFirstListItem<DiagnosticResponseRecord>(`user = "${userId}"`);
			diagnosticScores = computeCategoryScores(questions, diagnostic.answers);
			hasDiagnostic = true;
		} catch (err) {
			if (err instanceof ClientResponseError && err.status === 404) {
				hasDiagnostic = false;
			} else {
				throw err;
			}
		}

		try {
			metacognitionSummary = await pb
				.collection('metacognition_responses')
				.getFirstListItem<MetacognitionResponseRecord>(`user = "${userId}" && status = "completed"`, {
					sort: '-created'
				});
		} catch (err) {
			if (!(err instanceof ClientResponseError && err.status === 404)) throw err;
		}

		try {
			autorregulacionSummary = await pb
				.collection('autorregulacion_responses')
				.getFirstListItem<AutorregulacionResponseRecord>(
					`user = "${userId}" && status = "completed"`,
					{ sort: '-created' }
				);
		} catch (err) {
			if (!(err instanceof ClientResponseError && err.status === 404)) throw err;
		}

		try {
			conceptMap = await pb
				.collection('concept_maps')
				.getFirstListItem<ConceptMapRecord>(`user = "${userId}"`);
		} catch (err) {
			if (!(err instanceof ClientResponseError && err.status === 404)) throw err;
		}
	}

	async function loadAll() {
		status = 'loading';
		errorMessage = '';

		const userId = getAuthUser()?.id;
		if (!userId) return;

		try {
			try {
				const existing = await pb
					.collection('learning_systems')
					.getFirstListItem<LearningSystemRecord>(`user = "${userId}"`);
				system = existing;
				personalSummary = existing.personal_summary;
			} catch (err) {
				if (err instanceof ClientResponseError && err.status === 404) {
					status = 'setup';
					return;
				}
				throw err;
			}

			await loadSummaries(userId);
			sessions = await pb
				.collection('study_sessions')
				.getFullList<StudySessionRecord>({ filter: `user = "${userId}"`, sort: '-planned_date' });
			status = 'dashboard';
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos cargar tu sistema de aprendizaje. Intenta de nuevo.';
			status = 'error';
		}
	}

	async function saveSetup() {
		const userId = getAuthUser()?.id;
		if (!userId || !subjectInput.trim()) return;

		errorMessage = '';
		try {
			const created = await pb.collection('learning_systems').create<LearningSystemRecord>({
				user: userId,
				subject: subjectInput.trim(),
				personal_summary: ''
			});
			system = created;
			personalSummary = '';
			await loadSummaries(userId);
			sessions = await pb
				.collection('study_sessions')
				.getFullList<StudySessionRecord>({ filter: `user = "${userId}"`, sort: '-planned_date' });
			status = 'dashboard';
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos crear tu sistema. Intenta de nuevo.';
		}
	}

	async function savePersonalSummary() {
		if (!system) return;
		try {
			const updated = await pb
				.collection('learning_systems')
				.update<LearningSystemRecord>(system.id, { personal_summary: personalSummary });
			system = updated;
		} catch (err) {
			console.error(err);
		}
	}

	async function createSession(e: SubmitEvent) {
		e.preventDefault();
		const userId = getAuthUser()?.id;
		if (!userId || !newTopic.trim() || !newPlannedDate) return;

		errorMessage = '';
		try {
			const created = await pb.collection('study_sessions').create<StudySessionRecord>({
				user: userId,
				topic: newTopic.trim(),
				planned_date: new Date(newPlannedDate).toISOString(),
				status: 'planeada'
			});
			sessions = [created, ...sessions];
			newTopic = '';
			newPlannedDate = '';
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos crear la sesión. Intenta de nuevo.';
		}
	}

	async function completeSession(session: StudySessionRecord) {
		try {
			const updated = await pb.collection('study_sessions').update<StudySessionRecord>(session.id, {
				status: 'completada',
				completed_at: new Date().toISOString()
			});
			sessions = sessions.map((s) => (s.id === updated.id ? updated : s));
		} catch (err) {
			console.error(err);
		}
	}

	async function deleteSession(session: StudySessionRecord) {
		if (!confirm(`¿Borrar la sesión "${session.topic}"?`)) return;
		try {
			await pb.collection('study_sessions').delete(session.id);
			sessions = sessions.filter((s) => s.id !== session.id);
		} catch (err) {
			console.error(err);
		}
	}

	loadAll();
</script>

<svelte:head>
	<title>Módulo 4 · Tu sistema de aprendizaje — Ancla</title>
</svelte:head>

<main class="screen">
	<div class="card">
		{#if status === 'loading'}
			<p>Cargando…</p>
		{:else if status === 'error'}
			<p class="error" role="alert">{errorMessage}</p>
			<button class="secondary" onclick={loadAll}>Reintentar</button>
		{:else if status === 'setup'}
			<h1>Módulo 4 · Tu sistema de aprendizaje</h1>
			<p class="intro">
				Placeholder: instrucción para elegir una materia real en la que aplicar todo lo aprendido
				en los módulos anteriores.
			</p>

			<form
				class="form"
				onsubmit={(e) => {
					e.preventDefault();
					saveSetup();
				}}
			>
				<label class="field">
					<span>¿En qué materia real quieres aplicar tu sistema de aprendizaje?</span>
					<input type="text" bind:value={subjectInput} required />
				</label>

				{#if errorMessage}
					<p class="error" role="alert">{errorMessage}</p>
				{/if}

				<div class="actions">
					<button type="submit" class="primary" disabled={!subjectInput.trim()}>
						Crear mi sistema
					</button>
				</div>
			</form>
		{:else if status === 'dashboard' && system}
			<h1>Tu sistema de aprendizaje</h1>
			<p class="intro">{system.subject}</p>

			<section class="block">
				<h2>Tu recorrido</h2>

				<div class="summary-row">
					<span class="summary-label">Diagnóstico</span>
					{#if hasDiagnostic}
						<div class="summary-tags">
							{#each diagnosticScores as score (score.category)}
								<span class="tag">
									{CATEGORY_LABELS[score.category]}: {TIER_LABELS[score.tier]}
								</span>
							{/each}
						</div>
					{:else}
						<p class="hint">
							Placeholder: aún no tienes diagnóstico —
							<a href={resolve('/diagnostico')}>complétalo aquí</a>.
						</p>
					{/if}
				</div>

				<div class="summary-row">
					<span class="summary-label">Metacognición</span>
					{#if metacognitionSummary}
						{@const calibration = computeCalibration(metacognitionSummary)}
						{@const durationTier = calibration.find((c) => c.metric === 'duration')?.tier}
						<p class="hint">
							{metacognitionSummary.task_description}
							{#if durationTier}<span class="tag">{durationTier}</span>{/if}
						</p>
					{:else}
						<p class="hint">
							Placeholder: aún no completas Módulo 1 —
							<a href={resolve('/metacognicion')}>hazlo aquí</a>.
						</p>
					{/if}
				</div>

				<div class="summary-row">
					<span class="summary-label">Autorregulación</span>
					{#if autorregulacionSummary}
						<p class="hint">
							{autorregulacionSummary.subject} · {autorregulacionSummary.topic} —
							{autorregulacionSummary.strategy_used}
						</p>
					{:else}
						<p class="hint">
							Placeholder: aún no completas Módulo 2 —
							<a href={resolve('/autorregulacion')}>hazlo aquí</a>.
						</p>
					{/if}
				</div>

				<div class="summary-row">
					<span class="summary-label">Mapa conceptual</span>
					{#if conceptMap}
						<p class="hint">
							{conceptMap.subject} · {conceptMap.nodes.length} conceptos, {conceptMap.edges.length}
							relaciones —
							<a href={resolve('/mapaconceptual')}>verlo</a>
						</p>
					{:else}
						<p class="hint">
							Placeholder: aún no tienes mapa —
							<a href={resolve('/mapaconceptual')}>créalo aquí</a>.
						</p>
					{/if}
				</div>
			</section>

			<section class="block">
				<h2>Tu sistema, en tus palabras</h2>
				<p class="intro">
					Placeholder: explica cómo piensas usar lo que aprendiste en los módulos anteriores para
					estudiar {system.subject}.
				</p>
				<textarea
					rows="4"
					bind:value={personalSummary}
					onblur={savePersonalSummary}
					placeholder="Escribe aquí tu propio sistema de aprendizaje…"
				></textarea>
			</section>

			<section class="block">
				<h2>Sesiones de estudio</h2>
				<form class="session-form" onsubmit={createSession}>
					<input type="text" placeholder="Tema" bind:value={newTopic} required />
					<input type="date" bind:value={newPlannedDate} required />
					<button type="submit" class="secondary" disabled={!newTopic.trim() || !newPlannedDate}>
						Agregar
					</button>
				</form>

				{#if errorMessage}
					<p class="error" role="alert">{errorMessage}</p>
				{/if}

				{#if sortedSessions.length === 0}
					<p class="hint">Placeholder: aún no tienes sesiones planeadas.</p>
				{:else}
					<ul class="session-list">
						{#each sortedSessions as session (session.id)}
							<li class="session-row" class:done={session.status === 'completada'}>
								<div class="session-info">
									<span class="session-topic">{session.topic}</span>
									<span class="session-date">{dateFormatter.format(new Date(session.planned_date))}</span>
								</div>
								<div class="session-actions">
									{#if session.status === 'planeada'}
										<button class="icon-btn" onclick={() => completeSession(session)}>
											Marcar como hecha
										</button>
									{:else}
										<span class="tag">Completada</span>
									{/if}
									<button class="icon-btn danger" onclick={() => deleteSession(session)}>
										Borrar
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="block">
				<h2>Próximos repasos</h2>
				{#if upcomingReviews.length === 0}
					<p class="hint">
						Placeholder: completa sesiones de estudio para ver aquí tus fechas de repaso
						sugeridas.
					</p>
				{:else}
					<ul class="review-list">
						{#each upcomingReviews as review, i (i)}
							<li class="review-row" class:overdue={review.overdue}>
								<span>{review.topic}</span>
								<span class="review-date">{dateFormatter.format(review.date)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<div class="actions">
				<a class="primary" href={resolve('/')}>Volver al inicio</a>
			</div>
		{/if}
	</div>
</main>

<style>
	.screen {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-3);
	}

	.card {
		width: 100%;
		max-width: 42rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		padding: var(--space-4) var(--space-3) var(--space-3);
	}

	.intro,
	.hint {
		color: var(--color-ink-soft);
		margin-bottom: var(--space-2);
	}

	.block {
		margin-bottom: var(--space-4);
	}

	.block h2 {
		font-size: 1.1rem;
		margin-bottom: var(--space-2);
	}

	.summary-row {
		margin-bottom: var(--space-2);
	}

	.summary-label {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-muted);
		display: block;
		margin-bottom: 0.3rem;
	}

	.summary-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.tag {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-muted);
		background: var(--color-paper);
		border-radius: var(--radius-pill);
		padding: 0.15rem 0.6rem;
		white-space: nowrap;
	}

	.form,
	.session-form {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.form {
		flex-direction: column;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field input,
	.session-form input,
	textarea {
		font-family: inherit;
		font-size: 1rem;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.session-form input[type='text'] {
		flex: 1;
	}

	textarea {
		width: 100%;
		box-sizing: border-box;
		resize: vertical;
	}

	.session-list,
	.review-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.session-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
		background: var(--color-paper);
		border-radius: var(--radius-sm);
		padding: 0.6rem 0.8rem;
	}

	.session-row.done {
		opacity: 0.6;
	}

	.session-info {
		display: flex;
		flex-direction: column;
	}

	.session-topic {
		font-weight: 500;
	}

	.session-date {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-muted);
	}

	.session-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.icon-btn {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 0.35rem 0.6rem;
		font-size: 0.8rem;
		cursor: pointer;
		color: var(--color-ink);
	}

	.icon-btn.danger {
		color: var(--color-accent);
		border-color: transparent;
	}

	.review-row {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--color-ink-soft);
		padding: 0.4rem 0.2rem;
		border-bottom: 1px solid var(--color-border);
	}

	.review-row.overdue {
		color: var(--color-accent);
	}

	.review-date {
		font-weight: 600;
	}

	.actions {
		display: flex;
		gap: var(--space-2);
	}

	.primary,
	.secondary {
		text-align: center;
		border-radius: var(--radius-pill);
		padding: 0.8rem 1rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
		text-decoration: none;
	}

	.primary {
		background: var(--color-accent);
		color: var(--color-surface);
		flex: 1;
	}

	.primary:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.secondary {
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.secondary:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.error {
		color: var(--color-accent);
		font-size: 0.9rem;
	}
</style>
