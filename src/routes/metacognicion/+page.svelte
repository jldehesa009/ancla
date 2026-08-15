<script lang="ts">
	import { ClientResponseError } from 'pocketbase';
	import { resolve } from '$app/paths';
	import { pb, getAuthUser } from '$lib/pocketbase';
	import type {
		DiagnosticQuestionRecord,
		DiagnosticResponseRecord,
		MetacognitionResponseRecord
	} from '$lib/pocketbase/types';
	import { CATEGORY_LABELS, TIER_LABELS, computeCategoryScores } from '$lib/diagnostico/scoring';
	import { computeCalibration, type CalibrationResult } from '$lib/metacognicion/calibration';

	type Status = 'loading' | 'intro' | 'planificar' | 'tarea' | 'evaluar' | 'resumen' | 'error';

	const LIKERT_OPTIONS = [1, 2, 3, 4, 5] as const;
	const RECONCILIACION_CATEGORIES = ['estrategias_estudio', 'autorregulacion'] as const;

	let status = $state<Status>('loading');
	let saving = $state(false);
	let errorMessage = $state('');
	let hasDiagnostic = $state(false);
	let diagnosticScores = $state<{ category: string; tier: string }[]>([]);
	let response = $state<MetacognitionResponseRecord | null>(null);

	let taskDescription = $state('');
	let predictedDuration = $state(20);
	let predictedDifficulty = $state<number | null>(null);
	let predictedSuccess = $state<number | null>(null);

	let elapsedSeconds = $state(0);
	let timerHandle: ReturnType<typeof setInterval> | null = null;
	let midCheckResponse = $state<'si' | 'no' | null>(null);

	let actualDifficulty = $state<number | null>(null);
	let actualSuccess = $state<number | null>(null);
	let reflection = $state('');

	let calibration = $derived(response ? computeCalibration(response) : []);

	function stopTimer() {
		if (timerHandle) {
			clearInterval(timerHandle);
			timerHandle = null;
		}
	}

	function startTimerFrom(startedAt: string) {
		stopTimer();
		const startMs = new Date(startedAt).getTime();
		elapsedSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
		timerHandle = setInterval(() => {
			elapsedSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
		}, 1000);
	}

	function formatElapsed(seconds: number): string {
		const mm = Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0');
		const ss = (seconds % 60).toString().padStart(2, '0');
		return `${mm}:${ss}`;
	}

	async function loadModule() {
		status = 'loading';
		errorMessage = '';
		stopTimer();

		const userId = getAuthUser()?.id;
		if (!userId) return;

		try {
			const questions = await pb
				.collection('diagnostic_questions')
				.getFullList<DiagnosticQuestionRecord>({ filter: 'active = true', sort: 'order' });

			try {
				const diagnostic = await pb
					.collection('diagnostic_responses')
					.getFirstListItem<DiagnosticResponseRecord>(`user = "${userId}"`);
				const allScores = computeCategoryScores(questions, diagnostic.answers);
				diagnosticScores = allScores.filter((s) =>
					(RECONCILIACION_CATEGORIES as readonly string[]).includes(s.category)
				);
				hasDiagnostic = true;
			} catch (err) {
				if (err instanceof ClientResponseError && err.status === 404) {
					hasDiagnostic = false;
				} else {
					throw err;
				}
			}

			let latest: MetacognitionResponseRecord | null = null;
			try {
				latest = await pb
					.collection('metacognition_responses')
					.getFirstListItem<MetacognitionResponseRecord>(
						`user = "${userId}" && status != "completed"`,
						{ sort: '-created' }
					);
			} catch (err) {
				if (!(err instanceof ClientResponseError && err.status === 404)) throw err;
			}

			if (!latest) {
				try {
					latest = await pb
						.collection('metacognition_responses')
						.getFirstListItem<MetacognitionResponseRecord>(
							`user = "${userId}" && status = "completed"`,
							{ sort: '-created' }
						);
				} catch (err) {
					if (!(err instanceof ClientResponseError && err.status === 404)) throw err;
				}
			}

			response = latest;

			if (!latest) {
				status = 'intro';
			} else if (latest.status === 'completed') {
				status = 'resumen';
			} else if (latest.status === 'evaluando') {
				status = 'evaluar';
			} else {
				taskDescription = latest.task_description;
				predictedDuration = latest.predicted_duration_minutes;
				predictedDifficulty = latest.predicted_difficulty;
				predictedSuccess = latest.predicted_success;
				midCheckResponse = latest.mid_check_response;
				if (latest.started_at) {
					startTimerFrom(latest.started_at);
				}
				status = 'tarea';
			}
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos cargar el módulo. Intenta de nuevo.';
			status = 'error';
		}
	}

	async function savePlanificar() {
		const userId = getAuthUser()?.id;
		if (!userId || predictedDifficulty == null || predictedSuccess == null) return;

		saving = true;
		errorMessage = '';
		try {
			const created = await pb
				.collection('metacognition_responses')
				.create<MetacognitionResponseRecord>({
					user: userId,
					status: 'en_progreso',
					task_description: taskDescription,
					predicted_duration_minutes: predictedDuration,
					predicted_difficulty: predictedDifficulty,
					predicted_success: predictedSuccess
				});
			response = created;
			status = 'tarea';
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos guardar tu predicción. Intenta de nuevo.';
		} finally {
			saving = false;
		}
	}

	async function startTask() {
		if (!response) return;
		const startedAt = new Date().toISOString();
		try {
			const updated = await pb
				.collection('metacognition_responses')
				.update<MetacognitionResponseRecord>(response.id, { started_at: startedAt });
			response = updated;
			startTimerFrom(startedAt);
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos iniciar el cronómetro. Intenta de nuevo.';
		}
	}

	async function setMidCheck(value: 'si' | 'no') {
		if (!response) return;
		midCheckResponse = value;
		try {
			const updated = await pb
				.collection('metacognition_responses')
				.update<MetacognitionResponseRecord>(response.id, { mid_check_response: value });
			response = updated;
		} catch (err) {
			console.error(err);
		}
	}

	async function finishTask() {
		if (!response) return;
		stopTimer();
		saving = true;
		errorMessage = '';
		try {
			const updated = await pb
				.collection('metacognition_responses')
				.update<MetacognitionResponseRecord>(response.id, {
					actual_duration_minutes: Math.max(1, Math.round(elapsedSeconds / 60)),
					status: 'evaluando'
				});
			response = updated;
			status = 'evaluar';
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos guardar tu tiempo. Intenta de nuevo.';
		} finally {
			saving = false;
		}
	}

	async function submitEvaluar() {
		if (!response || actualDifficulty == null || actualSuccess == null) return;

		saving = true;
		errorMessage = '';
		try {
			const updated = await pb
				.collection('metacognition_responses')
				.update<MetacognitionResponseRecord>(response.id, {
					actual_difficulty: actualDifficulty,
					actual_success: actualSuccess,
					reflection,
					status: 'completed',
					completed_at: new Date().toISOString()
				});
			response = updated;
			status = 'resumen';
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos guardar tu evaluación. Intenta de nuevo.';
		} finally {
			saving = false;
		}
	}

	function repetirEjercicio() {
		response = null;
		taskDescription = '';
		predictedDuration = 20;
		predictedDifficulty = null;
		predictedSuccess = null;
		elapsedSeconds = 0;
		midCheckResponse = null;
		actualDifficulty = null;
		actualSuccess = null;
		reflection = '';
		status = 'planificar';
	}

	function metricLabel(metric: CalibrationResult['metric']): string {
		if (metric === 'duration') return 'Duración (min)';
		if (metric === 'difficulty') return 'Dificultad';
		return 'Qué tan bien te salió';
	}

	function markerPercent(value: number, metric: CalibrationResult['metric'], max: number): number {
		return Math.min(100, Math.max(0, (value / max) * 100));
	}

	loadModule();
</script>

<svelte:head>
	<title>Módulo 1 · Metacognición — Ancla</title>
</svelte:head>

<main class="screen">
	<div class="card">
		{#if status === 'loading'}
			<p>Cargando…</p>
		{:else if status === 'error'}
			<p class="error" role="alert">{errorMessage}</p>
			<button class="secondary" onclick={loadModule}>Reintentar</button>
		{:else if status === 'intro'}
			<h1>Módulo 1 · Metacognición</h1>
			<p class="intro">
				Placeholder: aquí va la explicación breve del ciclo planificar → monitorear → evaluar,
				redactada por el equipo.
			</p>

			{#if hasDiagnostic}
				<ul class="ref-scores">
					{#each diagnosticScores as score (score.category)}
						<li>
							<span>{CATEGORY_LABELS[score.category as keyof typeof CATEGORY_LABELS]}</span>
							<span class="tag">{TIER_LABELS[score.tier as keyof typeof TIER_LABELS]}</span>
						</li>
					{/each}
				</ul>
				<p class="hint">
					Placeholder: así te viste en tu diagnóstico. Este módulo pone eso a prueba con una
					tarea real.
				</p>
			{:else}
				<p class="hint">
					Placeholder: aún no tienes un diagnóstico. Puedes seguir de todas formas, pero te va a
					servir más si <a href={resolve('/diagnostico')}>lo completas primero</a>.
				</p>
			{/if}

			<div class="actions">
				<button class="primary" onclick={() => (status = 'planificar')}>Empezar</button>
			</div>
		{:else if status === 'planificar'}
			<p class="step-label">Planificar</p>
			<h1>Elige una tarea real</h1>
			<p class="intro">
				Placeholder: instrucciones para que el alumno describa una tarea real que pueda terminar
				en esta misma sesión.
			</p>

			<form
				class="form"
				onsubmit={(e) => {
					e.preventDefault();
					savePlanificar();
				}}
			>
				<label class="field">
					<span>Tarea</span>
					<textarea rows="3" bind:value={taskDescription} required></textarea>
				</label>

				<label class="field">
					<span>¿Cuánto crees que te va a tomar? (minutos)</span>
					<input type="number" min="1" bind:value={predictedDuration} required />
				</label>

				<fieldset class="likert-field">
					<legend>¿Qué tan difícil crees que va a ser?</legend>
					<div class="likert-scale">
						{#each LIKERT_OPTIONS as value (value)}
							<button
								type="button"
								class="likert-option"
								class:selected={predictedDifficulty === value}
								aria-pressed={predictedDifficulty === value}
								onclick={() => (predictedDifficulty = value)}
							>
								{value}
							</button>
						{/each}
					</div>
				</fieldset>

				<fieldset class="likert-field">
					<legend>¿Qué tan bien crees que te va a salir?</legend>
					<div class="likert-scale">
						{#each LIKERT_OPTIONS as value (value)}
							<button
								type="button"
								class="likert-option"
								class:selected={predictedSuccess === value}
								aria-pressed={predictedSuccess === value}
								onclick={() => (predictedSuccess = value)}
							>
								{value}
							</button>
						{/each}
					</div>
				</fieldset>

				{#if errorMessage}
					<p class="error" role="alert">{errorMessage}</p>
				{/if}

				<div class="actions">
					<button
						type="submit"
						class="primary"
						disabled={!taskDescription ||
							predictedDifficulty == null ||
							predictedSuccess == null ||
							saving}
					>
						{saving ? 'Guardando…' : 'Guardar predicción y continuar'}
					</button>
				</div>
			</form>
		{:else if status === 'tarea'}
			<p class="step-label">Monitorear</p>
			<h1>Manos a la obra</h1>
			<p class="intro">{taskDescription}</p>

			{#if !response?.started_at}
				<p class="hint">
					Placeholder: instrucción para iniciar el cronómetro justo antes de empezar la tarea de
					verdad.
				</p>
				<div class="actions">
					<button class="primary" onclick={startTask}>Empezar tarea</button>
				</div>
			{:else}
				<p class="timer">{formatElapsed(elapsedSeconds)}</p>

				<div class="mid-check">
					<span>¿Vas como esperabas?</span>
					<div class="mid-check-options">
						<button
							type="button"
							class="secondary"
							class:selected={midCheckResponse === 'si'}
							onclick={() => setMidCheck('si')}
						>
							Sí
						</button>
						<button
							type="button"
							class="secondary"
							class:selected={midCheckResponse === 'no'}
							onclick={() => setMidCheck('no')}
						>
							No
						</button>
					</div>
				</div>

				{#if errorMessage}
					<p class="error" role="alert">{errorMessage}</p>
				{/if}

				<div class="actions">
					<button class="primary" onclick={finishTask} disabled={saving}>
						{saving ? 'Guardando…' : 'Terminé'}
					</button>
				</div>
			{/if}
		{:else if status === 'evaluar'}
			<p class="step-label">Evaluar</p>
			<h1>¿Cómo te fue?</h1>

			<form
				class="form"
				onsubmit={(e) => {
					e.preventDefault();
					submitEvaluar();
				}}
			>
				<fieldset class="likert-field">
					<legend>¿Qué tan difícil fue en realidad?</legend>
					<div class="likert-scale">
						{#each LIKERT_OPTIONS as value (value)}
							<button
								type="button"
								class="likert-option"
								class:selected={actualDifficulty === value}
								aria-pressed={actualDifficulty === value}
								onclick={() => (actualDifficulty = value)}
							>
								{value}
							</button>
						{/each}
					</div>
				</fieldset>

				<fieldset class="likert-field">
					<legend>¿Qué tan bien te salió en realidad?</legend>
					<div class="likert-scale">
						{#each LIKERT_OPTIONS as value (value)}
							<button
								type="button"
								class="likert-option"
								class:selected={actualSuccess === value}
								aria-pressed={actualSuccess === value}
								onclick={() => (actualSuccess = value)}
							>
								{value}
							</button>
						{/each}
					</div>
				</fieldset>

				<label class="field">
					<span>¿Qué harías distinto la próxima vez?</span>
					<textarea rows="3" bind:value={reflection}></textarea>
				</label>

				{#if errorMessage}
					<p class="error" role="alert">{errorMessage}</p>
				{/if}

				<div class="actions">
					<button
						type="submit"
						class="primary"
						disabled={actualDifficulty == null || actualSuccess == null || saving}
					>
						{saving ? 'Guardando…' : 'Guardar y ver resultado'}
					</button>
				</div>
			</form>
		{:else if status === 'resumen' && response}
			<h1>Predicho vs. real</h1>
			<p class="intro">
				Placeholder: marco breve explicando que esto es una lectura de calibración, no una
				calificación.
			</p>

			<ul class="calibration">
				{#each calibration as result (result.metric)}
					{@const max = result.metric === 'duration' ? Math.max(result.predicted, result.actual) * 1.2 || 1 : 5}
					<li class="calibration-row">
						<div class="calibration-label">
							<span>{metricLabel(result.metric)}</span>
							<span class="tag">{result.tier}</span>
						</div>
						<div class="calibration-track">
							<span
								class="marker predicted"
								style="left: {markerPercent(result.predicted, result.metric, max)}%"
								title="Predicho: {result.predicted}"
							></span>
							<span
								class="marker actual"
								style="left: {markerPercent(result.actual, result.metric, max)}%"
								title="Real: {result.actual}"
							></span>
						</div>
						<div class="calibration-values">
							<span>Predicho: {result.predicted}</span>
							<span>Real: {result.actual}</span>
						</div>
					</li>
				{/each}
			</ul>

			{#if hasDiagnostic}
				<p class="hint">
					Placeholder: cierre de reconciliación integradora conectando el resultado con el score
					de autorregulación del diagnóstico.
				</p>
			{/if}

			<p class="hint">
				Placeholder: gancho hacia el Módulo 2, donde esta misma habilidad se aplica a tus
				sesiones de estudio de toda la semana.
			</p>

			<div class="actions">
				<a class="primary" href={resolve('/')}>Continuar</a>
				<button class="secondary" onclick={repetirEjercicio}>Repetir ejercicio</button>
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

	.step-label {
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		margin-bottom: var(--space-1);
	}

	.intro,
	.hint {
		color: var(--color-ink-soft);
		margin-bottom: var(--space-3);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field textarea,
	.field input {
		font-family: inherit;
		font-size: 1rem;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.likert-field {
		border: none;
		padding: 0;
		margin: 0;
	}

	.likert-field legend {
		font-size: 0.9rem;
		margin-bottom: 0.5rem;
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

	.timer {
		font-family: var(--font-mono);
		font-size: 2.5rem;
		text-align: center;
		margin: var(--space-3) 0;
		color: var(--color-ink);
	}

	.mid-check {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-3);
		gap: var(--space-2);
	}

	.mid-check-options {
		display: flex;
		gap: 0.5rem;
	}

	.mid-check-options button {
		padding: 0.4rem 0.9rem;
	}

	.mid-check-options button.selected {
		background: var(--color-accent-soft);
		color: var(--color-accent);
	}

	.ref-scores {
		list-style: none;
		margin: 0 0 var(--space-2);
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ref-scores li {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.tag {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-muted);
		background: var(--color-paper);
		border-radius: var(--radius-pill);
		padding: 0.15rem 0.6rem;
	}

	.calibration {
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.calibration-row {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.calibration-label {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-weight: 500;
	}

	.calibration-track {
		position: relative;
		height: 0.5rem;
		border-radius: var(--radius-pill);
		background: var(--color-paper);
	}

	.marker {
		position: absolute;
		top: 50%;
		width: 0.9rem;
		height: 0.9rem;
		border-radius: var(--radius-pill);
		transform: translate(-50%, -50%);
	}

	.marker.predicted {
		background: var(--color-surface);
		border: 2px dashed var(--color-accent);
	}

	.marker.actual {
		background: var(--color-learn);
		border: 2px solid var(--color-learn);
	}

	.calibration-values {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		color: var(--color-muted);
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

	@media (prefers-reduced-motion: reduce) {
		.likert-option {
			transition: none;
		}

		.likert-option.selected {
			transform: none;
		}
	}
</style>
