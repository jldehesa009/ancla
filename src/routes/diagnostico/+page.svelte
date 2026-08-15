<script lang="ts">
	import { ClientResponseError } from 'pocketbase';
	import { resolve } from '$app/paths';
	import { pb, getAuthUser } from '$lib/pocketbase';
	import type { DiagnosticQuestionRecord, DiagnosticResponseRecord } from '$lib/pocketbase/types';
	import {
		CATEGORY_LABELS,
		TIER_LABELS,
		computeCategoryScores,
		type CategoryScore
	} from '$lib/diagnostico/scoring';

	type Status = 'loading' | 'in_progress' | 'saving' | 'summary' | 'error';

	const LIKERT_OPTIONS = [1, 2, 3, 4, 5] as const;

	let status = $state<Status>('loading');
	let errorMessage = $state('');
	let questions = $state<DiagnosticQuestionRecord[]>([]);
	let answers = $state<Record<string, number>>({});
	let currentIndex = $state(0);
	let existingResponseId = $state<string | null>(null);
	let scores = $state<CategoryScore[]>([]);

	let currentQuestion = $derived(questions[currentIndex]);
	let isLastQuestion = $derived(currentIndex === questions.length - 1);
	let hasAnsweredCurrent = $derived(currentQuestion ? answers[currentQuestion.id] != null : false);

	async function loadDiagnostic() {
		status = 'loading';
		errorMessage = '';
		try {
			questions = await pb.collection('diagnostic_questions').getFullList({
				filter: 'active = true',
				sort: 'order'
			});

			const userId = getAuthUser()?.id;
			try {
				const existing = await pb
					.collection('diagnostic_responses')
					.getFirstListItem<DiagnosticResponseRecord>(`user = "${userId}"`);
				existingResponseId = existing.id;
				answers = existing.answers;
				scores = computeCategoryScores(questions, answers);
				status = 'summary';
			} catch (err) {
				if (err instanceof ClientResponseError && err.status === 404) {
					status = 'in_progress';
				} else {
					throw err;
				}
			}
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos cargar el diagnóstico. Intenta de nuevo.';
			status = 'error';
		}
	}

	function selectAnswer(value: number) {
		if (!currentQuestion) return;
		answers = { ...answers, [currentQuestion.id]: value };
	}

	function goNext() {
		if (isLastQuestion) {
			submit();
		} else {
			currentIndex += 1;
		}
	}

	function goPrevious() {
		if (currentIndex > 0) currentIndex -= 1;
	}

	function retake() {
		currentIndex = 0;
		answers = {};
		status = 'in_progress';
	}

	async function submit() {
		const userId = getAuthUser()?.id;
		if (!userId) return;

		status = 'saving';
		errorMessage = '';
		try {
			if (existingResponseId) {
				await pb.collection('diagnostic_responses').update(existingResponseId, { answers });
			} else {
				const created = await pb
					.collection('diagnostic_responses')
					.create<DiagnosticResponseRecord>({ user: userId, answers });
				existingResponseId = created.id;
			}
			scores = computeCategoryScores(questions, answers);
			status = 'summary';
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos guardar tus respuestas. Intenta de nuevo.';
			status = 'in_progress';
		}
	}

	loadDiagnostic();
</script>

<svelte:head>
	<title>Diagnóstico — Ancla</title>
</svelte:head>

<main class="screen">
	<div class="card">
		{#if status === 'loading'}
			<p>Cargando diagnóstico…</p>
		{:else if status === 'error'}
			<p class="error" role="alert">{errorMessage}</p>
			<button class="secondary" onclick={loadDiagnostic}>Reintentar</button>
		{:else if status === 'summary'}
			<h1>Tu punto de partida</h1>
			<p class="intro">
				Así se ve tu forma de estudiar hoy. Esto no es una calificación — es el ancla desde donde
				vamos a construir el resto del recorrido.
			</p>

			<ul class="scores">
				{#each scores as score (score.category)}
					<li class="score-row">
						<div class="score-label">
							<span>{CATEGORY_LABELS[score.category]}</span>
							<span class="tier tier-{score.tier}">{TIER_LABELS[score.tier]}</span>
						</div>
						<div class="bar-track">
							<div
								class="bar-fill tier-{score.tier}"
								style="width: {(score.average / 5) * 100}%"
							></div>
						</div>
					</li>
				{/each}
			</ul>

			<div class="actions">
				<a class="primary" href={resolve('/')}>Continuar</a>
				<button class="secondary" onclick={retake}>Repetir diagnóstico</button>
			</div>
		{:else if currentQuestion}
			<div
				class="progress"
				role="progressbar"
				aria-valuenow={currentIndex + 1}
				aria-valuemin={1}
				aria-valuemax={questions.length}
			>
				{#each questions as question, i (question.id)}
					<span class="dot" class:filled={i <= currentIndex}></span>
				{/each}
			</div>
			<p class="step-label">Pregunta {currentIndex + 1} de {questions.length}</p>

			<h1 class="question">{currentQuestion.text}</h1>

			<fieldset class="likert">
				<legend class="sr-only">Qué tan de acuerdo estás</legend>
				<div class="likert-scale">
					{#each LIKERT_OPTIONS as value (value)}
						<button
							type="button"
							class="likert-option"
							class:selected={answers[currentQuestion.id] === value}
							aria-pressed={answers[currentQuestion.id] === value}
							onclick={() => selectAnswer(value)}
						>
							{value}
						</button>
					{/each}
				</div>
				<div class="likert-labels">
					<span>Muy en desacuerdo</span>
					<span>Muy de acuerdo</span>
				</div>
			</fieldset>

			{#if errorMessage}
				<p class="error" role="alert">{errorMessage}</p>
			{/if}

			<div class="actions">
				<button class="secondary" onclick={goPrevious} disabled={currentIndex === 0}>
					Anterior
				</button>
				<button
					class="primary"
					onclick={goNext}
					disabled={!hasAnsweredCurrent || status === 'saving'}
				>
					{#if status === 'saving'}
						Guardando…
					{:else if isLastQuestion}
						Terminar diagnóstico
					{:else}
						Siguiente
					{/if}
				</button>
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
		max-width: 32rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		padding: var(--space-4) var(--space-3) var(--space-3);
	}

	.progress {
		display: flex;
		gap: 0.35rem;
		margin-bottom: var(--space-1);
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: var(--radius-pill);
		background: var(--color-border);
	}

	.dot.filled {
		background: var(--color-accent);
	}

	.step-label {
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		margin-bottom: var(--space-2);
	}

	.question {
		font-size: 1.5rem;
		margin-bottom: var(--space-3);
	}

	.likert {
		border: none;
		padding: 0;
		margin: 0 0 var(--space-3);
	}

	.likert-scale {
		display: flex;
		gap: 0.5rem;
	}

	.likert-option {
		flex: 1;
		aspect-ratio: 1;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-paper);
		font-family: var(--font-mono);
		font-size: 1.1rem;
		color: var(--color-ink-soft);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease,
			transform 0.1s ease;
	}

	.likert-option.selected {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-surface);
		transform: translateY(-2px);
	}

	.likert-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: var(--color-muted);
	}

	.intro {
		color: var(--color-ink-soft);
		margin-bottom: var(--space-3);
	}

	.scores {
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.score-row {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.score-label {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-weight: 500;
	}

	.tier {
		font-size: 0.75rem;
		font-family: var(--font-mono);
		color: var(--color-muted);
	}

	.tier-consolidado {
		color: var(--color-learn);
	}

	.tier-a_fortalecer {
		color: var(--color-accent);
	}

	.bar-track {
		height: 0.5rem;
		border-radius: var(--radius-pill);
		background: var(--color-paper);
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: var(--radius-pill);
		background: var(--color-muted);
	}

	.bar-fill.tier-consolidado {
		background: var(--color-learn);
	}

	.bar-fill.tier-a_fortalecer {
		background: var(--color-accent);
	}

	.actions {
		display: flex;
		gap: var(--space-2);
	}

	.primary,
	.secondary {
		flex: 1;
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
	}

	.primary:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.secondary {
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.error {
		color: var(--color-accent);
		font-size: 0.9rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}
</style>
