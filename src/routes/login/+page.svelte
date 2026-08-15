<script lang="ts">
	import { ClientResponseError } from 'pocketbase';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { login, signup } from '$lib/pocketbase';

	type Mode = 'login' | 'signup';

	let mode = $state<Mode>('login');
	let email = $state('');
	let password = $state('');
	let name = $state('');
	let error = $state('');
	let submitting = $state(false);

	function switchMode(next: Mode) {
		mode = next;
		error = '';
	}

	function describeError(err: unknown, mode: Mode): string {
		if (err instanceof ClientResponseError) {
			const fieldMessage = Object.values(err.response?.data ?? {})[0] as
				{ message?: string } | undefined;
			if (fieldMessage?.message) return fieldMessage.message;
			if (err.response?.message) return err.response.message;
		}
		return mode === 'login'
			? 'No pudimos iniciar sesión. Revisa tu correo y contraseña.'
			: 'No pudimos crear tu cuenta. Verifica los datos e intenta de nuevo.';
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		submitting = true;
		try {
			if (mode === 'login') {
				await login(email, password);
			} else {
				await signup(email, password, name);
			}
			await goto(resolve('/'));
		} catch (err) {
			error = describeError(err, mode);
			console.error(err);
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} — Ancla</title>
</svelte:head>

<main class="screen">
	<div class="card">
		<svg class="thread" viewBox="0 0 120 24" aria-hidden="true">
			<path
				d="M2 12 Q 20 2, 40 12 T 78 12 T 118 12"
				fill="none"
				stroke="var(--color-accent)"
				stroke-width="2"
				stroke-linecap="round"
				stroke-dasharray="1 9"
			/>
		</svg>

		<h1 class="wordmark">Ancla</h1>
		<p class="tagline">Tu punto de partida como estudiante universitario.</p>

		<div class="tabs" role="tablist" aria-label="Modo de acceso">
			<button
				type="button"
				role="tab"
				aria-selected={mode === 'login'}
				class="tab"
				class:active={mode === 'login'}
				onclick={() => switchMode('login')}
			>
				Iniciar sesión
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={mode === 'signup'}
				class="tab"
				class:active={mode === 'signup'}
				onclick={() => switchMode('signup')}
			>
				Crear cuenta
			</button>
		</div>

		<form onsubmit={handleSubmit}>
			{#if mode === 'signup'}
				<label class="field">
					<span>Nombre</span>
					<input type="text" name="name" autocomplete="name" required bind:value={name} />
				</label>
			{/if}

			<label class="field">
				<span>Correo</span>
				<input type="email" name="email" autocomplete="email" required bind:value={email} />
			</label>

			<label class="field">
				<span>Contraseña</span>
				<input
					type="password"
					name="password"
					autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
					required
					minlength="8"
					bind:value={password}
				/>
			</label>

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<button type="submit" class="submit" disabled={submitting}>
				{#if submitting}
					Un momento…
				{:else if mode === 'login'}
					Entrar
				{:else}
					Crear mi cuenta
				{/if}
			</button>
		</form>
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
		max-width: 26rem;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		padding: var(--space-4) var(--space-3) var(--space-3);
	}

	.thread {
		display: block;
		width: 6rem;
		height: 1.2rem;
		margin-bottom: var(--space-2);
	}

	.wordmark {
		font-size: 2rem;
		margin-bottom: var(--space-1);
	}

	.tagline {
		color: var(--color-ink-soft);
		margin-bottom: var(--space-3);
	}

	.tabs {
		display: flex;
		gap: var(--space-1);
		background: var(--color-paper);
		padding: 0.25rem;
		border-radius: var(--radius-pill);
		margin-bottom: var(--space-3);
	}

	.tab {
		flex: 1;
		border: none;
		background: transparent;
		padding: 0.6rem 1rem;
		border-radius: var(--radius-pill);
		font-weight: 500;
		color: var(--color-ink-soft);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.tab.active {
		background: var(--color-surface);
		color: var(--color-ink);
		box-shadow: var(--shadow-card);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-ink-soft);
	}

	.field input {
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.field input:focus-visible {
		background: var(--color-surface);
	}

	.error {
		color: var(--color-accent);
		font-size: 0.9rem;
		margin: 0;
	}

	.submit {
		margin-top: var(--space-1);
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-accent);
		color: var(--color-surface);
		font-weight: 600;
		padding: 0.8rem 1rem;
		cursor: pointer;
		transition:
			transform 0.1s ease,
			opacity 0.15s ease;
	}

	.submit:hover:not(:disabled) {
		transform: translateY(-1px);
	}

	.submit:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
