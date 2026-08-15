<script lang="ts">
	import { resolve } from '$app/paths';
	import { getAuthUser } from '$lib/pocketbase';

	let { children } = $props();
	let user = $derived(getAuthUser());
</script>

<div class="admin">
	<header class="admin-bar">
		<a class="back" href={resolve('/')}>← Ancla</a>
		<span class="title">Panel de contenido</span>
		<span class="editor">{user?.name || user?.email}</span>
	</header>
	<div class="admin-body">
		{@render children()}
	</div>
</div>

<style>
	.admin {
		min-height: 100dvh;
	}

	.admin-bar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}

	.back {
		font-weight: 600;
	}

	.title {
		font-family: var(--font-display);
		font-weight: 600;
		flex: 1;
	}

	.editor {
		color: var(--color-muted);
		font-size: 0.85rem;
	}

	.admin-body {
		padding: var(--space-3);
		max-width: 48rem;
		margin: 0 auto;
	}
</style>
