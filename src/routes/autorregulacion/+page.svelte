<script lang="ts">
	import { ClientResponseError } from 'pocketbase';
	import { resolve } from '$app/paths';
	import { pb, getAuthUser } from '$lib/pocketbase';
	import type {
		AutorregulacionResponseRecord,
		DiagnosticQuestionRecord,
		DiagnosticResponseRecord
	} from '$lib/pocketbase/types';
	import { CATEGORY_LABELS, TIER_LABELS, computeCategoryScores } from '$lib/diagnostico/scoring';
	import { suggestedReviewDates } from '$lib/autorregulacion/spacedReview';

	type Status = 'loading' | 'intro' | 'prevision' | 'sesion' | 'autorreflexion' | 'resumen' | 'error';

	const RECONCILIACION_CATEGORIES = ['organizacion', 'motivacion'] as const;

	let status = $state<Status>('loading');
	let saving = $state(false);
	let errorMessage = $state('');
	let hasDiagnostic = $state(false);
	let diagnosticScores = $state<{ category: string; tier: string }[]>([]);
	let response = $state<AutorregulacionResponseRecord | null>(null);

	let subject = $state('');
	let topic = $state('');
	let studyGoal = $state('');
	let plannedDuration = $state(25);

	let elapsedSeconds = $state(0);
	let timerHandle: ReturnType<typeof setInterval> | null = null;

	let strategyUsed = $state('');
	let nextAdjustment = $state('');

	let reviewDates = $derived(response ? suggestedReviewDates(new Date(response.created)) : []);

	const dateFormatter = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

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

			let latest: AutorregulacionResponseRecord | null = null;
			try {
				latest = await pb
					.collection('autorregulacion_responses')
					.getFirstListItem<AutorregulacionResponseRecord>(
						`user = "${userId}" && status != "completed"`,
						{ sort: '-created' }
					);
			} catch (err) {
				if (!(err instanceof ClientResponseError && err.status === 404)) throw err;
			}

			if (!latest) {
				try {
					latest = await pb
						.collection('autorregulacion_responses')
						.getFirstListItem<AutorregulacionResponseRecord>(
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
				status = 'autorreflexion';
			} else {
				subject = latest.subject;
				topic = latest.topic;
				studyGoal = latest.study_goal;
				plannedDuration = latest.planned_duration_minutes;
				if (latest.started_at) {
					startTimerFrom(latest.started_at);
				}
				status = 'sesion';
			}
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos cargar el módulo. Intenta de nuevo.';
			status = 'error';
		}
	}

	async function savePrevision() {
		const userId = getAuthUser()?.id;
		if (!userId || !subject || !topic || !studyGoal) return;

		saving = true;
		errorMessage = '';
		try {
			const created = await pb
				.collection('autorregulacion_responses')
				.create<AutorregulacionResponseRecord>({
					user: userId,
					status: 'en_progreso',
					subject,
					topic,
					study_goal: studyGoal,
					planned_duration_minutes: plannedDuration
				});
			response = created;
			status = 'sesion';
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos guardar tu plan. Intenta de nuevo.';
		} finally {
			saving = false;
		}
	}

	async function startSession() {
		if (!response) return;
		const startedAt = new Date().toISOString();
		try {
			const updated = await pb
				.collection('autorregulacion_responses')
				.update<AutorregulacionResponseRecord>(response.id, { started_at: startedAt });
			response = updated;
			startTimerFrom(startedAt);
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos iniciar el cronómetro. Intenta de nuevo.';
		}
	}

	async function finishSession() {
		if (!response) return;
		stopTimer();
		saving = true;
		errorMessage = '';
		try {
			const updated = await pb
				.collection('autorregulacion_responses')
				.update<AutorregulacionResponseRecord>(response.id, {
					actual_duration_minutes: Math.max(1, Math.round(elapsedSeconds / 60)),
					status: 'evaluando'
				});
			response = updated;
			status = 'autorreflexion';
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos guardar tu tiempo. Intenta de nuevo.';
		} finally {
			saving = false;
		}
	}

	async function submitAutorreflexion() {
		if (!response || !strategyUsed || !nextAdjustment) return;

		saving = true;
		errorMessage = '';
		try {
			const updated = await pb
				.collection('autorregulacion_responses')
				.update<AutorregulacionResponseRecord>(response.id, {
					strategy_used: strategyUsed,
					next_adjustment: nextAdjustment,
					status: 'completed',
					completed_at: new Date().toISOString()
				});
			response = updated;
			status = 'resumen';
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos guardar tu autorreflexión. Intenta de nuevo.';
		} finally {
			saving = false;
		}
	}

	function repetirEjercicio() {
		response = null;
		subject = '';
		topic = '';
		studyGoal = '';
		plannedDuration = 25;
		elapsedSeconds = 0;
		strategyUsed = '';
		nextAdjustment = '';
		status = 'prevision';
	}

	loadModule();
</script>

<svelte:head>
	<title>Módulo 2 · Autorregulación del estudio — Ancla</title>
</svelte:head>

<main class="screen">
	<div class="card">
		{#if status === 'loading'}
			<p>Cargando…</p>
		{:else if status === 'error'}
			<p class="error" role="alert">{errorMessage}</p>
			<button class="secondary" onclick={loadModule}>Reintentar</button>
		{:else if status === 'intro'}
			<h1>Módulo 2 · Autorregulación del estudio</h1>
			<p class="intro">
				Placeholder: explicación breve del ciclo previsión → desempeño → autorreflexión aplicado
				a una sesión de estudio.
			</p>
			<p class="hint">
				Placeholder: en el módulo anterior practicaste comparar lo que predices con lo que pasa
				de verdad. Aquí aplicamos eso mismo a una sesión de estudio real, y de paso conocemos dos
				técnicas: repaso espaciado y seguimiento de progreso.
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
			{:else}
				<p class="hint">
					Placeholder: aún no tienes un diagnóstico. Puedes seguir de todas formas, pero te va a
					servir más si <a href={resolve('/diagnostico')}>lo completas primero</a>.
				</p>
			{/if}

			<div class="actions">
				<button class="primary" onclick={() => (status = 'prevision')}>Empezar</button>
			</div>
		{:else if status === 'prevision'}
			<p class="step-label">Previsión</p>
			<h1>Planea una sesión real</h1>
			<p class="intro">
				Placeholder: instrucciones para que el alumno elija una materia y tema reales, con una
				meta concreta para esta sesión.
			</p>

			<form
				class="form"
				onsubmit={(e) => {
					e.preventDefault();
					savePrevision();
				}}
			>
				<label class="field">
					<span>Materia</span>
					<input type="text" bind:value={subject} required />
				</label>

				<label class="field">
					<span>Tema</span>
					<input type="text" bind:value={topic} required />
				</label>

				<label class="field">
					<span>¿Qué quieres lograr en esta sesión?</span>
					<textarea rows="2" bind:value={studyGoal} required></textarea>
				</label>

				<label class="field">
					<span>Duración planeada (minutos)</span>
					<input type="number" min="1" bind:value={plannedDuration} required />
				</label>

				{#if errorMessage}
					<p class="error" role="alert">{errorMessage}</p>
				{/if}

				<div class="actions">
					<button
						type="submit"
						class="primary"
						disabled={!subject || !topic || !studyGoal || saving}
					>
						{saving ? 'Guardando…' : 'Guardar plan y continuar'}
					</button>
				</div>
			</form>
		{:else if status === 'sesion'}
			<p class="step-label">Desempeño</p>
			<h1>Manos a la obra</h1>
			<p class="intro">
				{topic} · {subject}
			</p>
			<p class="hint">{studyGoal}</p>

			{#if !response?.started_at}
				<p class="hint">
					Placeholder: instrucción para iniciar el cronómetro justo antes de empezar la sesión
					de verdad.
				</p>
				<div class="actions">
					<button class="primary" onclick={startSession}>Empezar sesión</button>
				</div>
			{:else}
				<p class="timer">{formatElapsed(elapsedSeconds)}</p>

				{#if errorMessage}
					<p class="error" role="alert">{errorMessage}</p>
				{/if}

				<div class="actions">
					<button class="primary" onclick={finishSession} disabled={saving}>
						{saving ? 'Guardando…' : 'Terminé'}
					</button>
				</div>
			{/if}
		{:else if status === 'autorreflexion'}
			<p class="step-label">Autorreflexión</p>
			<h1>¿Cómo te fue?</h1>

			<form
				class="form"
				onsubmit={(e) => {
					e.preventDefault();
					submitAutorreflexion();
				}}
			>
				<label class="field">
					<span>¿Qué estrategia de estudio usaste?</span>
					<textarea rows="2" bind:value={strategyUsed} required></textarea>
				</label>

				<label class="field">
					<span>¿Qué ajustarías para la próxima sesión de este tema?</span>
					<textarea rows="2" bind:value={nextAdjustment} required></textarea>
				</label>

				{#if errorMessage}
					<p class="error" role="alert">{errorMessage}</p>
				{/if}

				<div class="actions">
					<button type="submit" class="primary" disabled={!strategyUsed || !nextAdjustment || saving}>
						{saving ? 'Guardando…' : 'Guardar y ver resultado'}
					</button>
				</div>
			</form>
		{:else if status === 'resumen' && response}
			<h1>Previsión vs. desempeño</h1>
			<p class="intro">
				Placeholder: marco breve — esto es una lectura de calibración de tu sesión, no una
				calificación.
			</p>

			<div class="calibration-row">
				<div class="calibration-label">
					<span>Duración (min)</span>
				</div>
				<div class="calibration-track">
					{#if response.actual_duration_minutes != null}
						{@const max = Math.max(response.planned_duration_minutes, response.actual_duration_minutes) * 1.2 || 1}
						<span
							class="marker predicted"
							style="left: {(response.planned_duration_minutes / max) * 100}%"
							title="Planeado: {response.planned_duration_minutes}"
						></span>
						<span
							class="marker actual"
							style="left: {(response.actual_duration_minutes / max) * 100}%"
							title="Real: {response.actual_duration_minutes}"
						></span>
					{/if}
				</div>
				<div class="calibration-values">
					<span>Planeado: {response.planned_duration_minutes}</span>
					<span>Real: {response.actual_duration_minutes}</span>
				</div>
			</div>

			<div class="reflection-block">
				<p class="hint"><strong>Estrategia:</strong> {response.strategy_used}</p>
				<p class="hint"><strong>Próximo ajuste:</strong> {response.next_adjustment}</p>
			</div>

			<h2>Tu plantilla de repaso espaciado</h2>
			<p class="intro">
				Placeholder: explicación de que repasar "{response.topic}" en estas fechas ayuda a
				fijarlo mejor que un solo repaso.
			</p>
			<ul class="review-dates">
				{#each reviewDates as date, i (i)}
					<li>{dateFormatter.format(date)}</li>
				{/each}
			</ul>

			{#if hasDiagnostic}
				<p class="hint">
					Placeholder: cierre de reconciliación integradora conectando con tus categorías de
					organización y motivación del diagnóstico.
				</p>
			{/if}

			<p class="hint">
				Placeholder: esto es una muestra de "seguimiento de progreso" — si repites este ejercicio
				con tus sesiones reales a lo largo del semestre, así es como se vería tu avance.
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

	h2 {
		font-size: 1.1rem;
		margin: var(--space-3) 0 var(--space-1);
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

	.timer {
		font-family: var(--font-mono);
		font-size: 2.5rem;
		text-align: center;
		margin: var(--space-3) 0;
		color: var(--color-ink);
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

	.calibration-row {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: var(--space-3);
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

	.reflection-block {
		margin-bottom: var(--space-2);
	}

	.review-dates {
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.review-dates li {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		background: var(--color-paper);
		border-radius: var(--radius-sm);
		padding: 0.4rem 0.7rem;
		color: var(--color-ink);
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
</style>
