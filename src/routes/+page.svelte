<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getAuthUser, logout } from '$lib/pocketbase';

	let user = $derived(getAuthUser());

	function handleLogout() {
		logout();
		goto(resolve('/login'));
	}
</script>

<main class="screen">
	{#if user}
		<h1>Hola, {user.name || user.email}</h1>
		<p>Sesión iniciada como <strong>{user.role}</strong>.</p>
		<a href={resolve('/diagnostico')}>Ir al diagnóstico</a>
		{#if user.role === 'editor_contenido'}
			<a href={resolve('/admin')}>Panel de contenido</a>
		{/if}
		<button onclick={handleLogout}>Cerrar sesión</button>
	{:else}
		<h1>Ancla</h1>
		<p>Aún no has iniciado sesión.</p>
		<a href={resolve('/login')}>Iniciar sesión / Crear cuenta</a>
	{/if}
</main>

<style>
	.screen {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-3);
		text-align: center;
	}

	button {
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-ink);
		color: var(--color-surface);
		font-weight: 600;
		padding: 0.7rem 1.2rem;
		cursor: pointer;
	}
</style>
