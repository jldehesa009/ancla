<script lang="ts">
	import '@xyflow/svelte/dist/style.css';
	import { ClientResponseError } from 'pocketbase';
	import {
		SvelteFlow,
		Background,
		BackgroundVariant,
		Controls,
		Panel,
		type Node,
		type Edge
	} from '@xyflow/svelte';
	import { resolve } from '$app/paths';
	import { pb, getAuthUser } from '$lib/pocketbase';
	import type { ConceptMapEdge, ConceptMapNode, ConceptMapRecord } from '$lib/pocketbase/types';
	import CanvasEdge from '$lib/mapaconceptual/CanvasEdge.svelte';
	import { layoutNodes } from '$lib/mapaconceptual/autoLayout';

	type Status = 'loading' | 'theory' | 'setup' | 'builder' | 'error';
	type SaveStatus = 'saved' | 'saving' | 'error';

	const edgeTypes = { labeled: CanvasEdge };

	const THEORY_STEPS = [
		{
			title: 'Aprendizaje significativo vs. memorístico',
			body: 'Placeholder: marco general sobre la diferencia entre aprender relacionando ideas nuevas con lo que ya sabes, y memorizar sin conexión.'
		},
		{
			title: 'Subsumidores',
			body: 'Placeholder: los subsumidores son el conocimiento previo al que enganchas lo nuevo. Tu diagnóstico del inicio (Módulo 0) fue justamente eso — un subsumidor.'
		},
		{
			title: 'Diferenciación progresiva y reconciliación integradora',
			body: 'Placeholder: ir de lo general a lo específico, y cruzar referencias entre ideas. De hecho, el recorrido mismo de esta app por sus módulos ya aplicó estos dos principios.'
		},
		{
			title: 'Qué es un mapa conceptual',
			body: 'Placeholder: conceptos unidos por frases de enlace que forman proposiciones con sentido (Novak & Gowin) — eso es lo que lo distingue de un mapa mental.'
		}
	];

	let status = $state<Status>('loading');
	let errorMessage = $state('');
	let saveStatus = $state<SaveStatus>('saved');

	let theoryStep = $state(0);
	let mapId = $state<string | null>(null);
	let subjectInput = $state('');
	let subject = $state('');

	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);

	let selectedNode = $derived(nodes.find((n) => n.selected) ?? null);

	function handleEdgeLabelChange(id: string, value: string) {
		edges = edges.map((e) => (e.id === id ? { ...e, label: value } : e));
		saveMap();
	}

	function toRuntimeEdges(raw: ConceptMapEdge[]): Edge[] {
		return raw.map((e) => ({
			...e,
			type: e.type ?? 'labeled',
			data: { onLabelChange: handleEdgeLabelChange }
		}));
	}

	function toPersistedNodes(list: Node[]): ConceptMapNode[] {
		return list.map((n) => ({
			id: n.id,
			position: n.position,
			data: { label: (n.data?.label as string) ?? '' }
		}));
	}

	function toPersistedEdges(list: Edge[]): ConceptMapEdge[] {
		return list.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type, label: e.label }));
	}

	async function loadModule() {
		status = 'loading';
		errorMessage = '';

		const userId = getAuthUser()?.id;
		if (!userId) return;

		try {
			const existing = await pb
				.collection('concept_maps')
				.getFirstListItem<ConceptMapRecord>(`user = "${userId}"`);
			mapId = existing.id;
			subject = existing.subject;
			nodes = existing.nodes ?? [];
			edges = toRuntimeEdges(existing.edges ?? []);
			status = 'builder';
		} catch (err) {
			if (err instanceof ClientResponseError && err.status === 404) {
				status = 'theory';
			} else {
				console.error(err);
				errorMessage = 'No pudimos cargar tu mapa. Intenta de nuevo.';
				status = 'error';
			}
		}
	}

	function nextTheory() {
		if (theoryStep < THEORY_STEPS.length - 1) {
			theoryStep += 1;
		} else {
			status = mapId ? 'builder' : 'setup';
		}
	}

	function prevTheory() {
		if (theoryStep > 0) theoryStep -= 1;
	}

	async function saveSetup() {
		const userId = getAuthUser()?.id;
		if (!userId || !subjectInput.trim()) return;

		errorMessage = '';
		try {
			const created = await pb.collection('concept_maps').create<ConceptMapRecord>({
				user: userId,
				subject: subjectInput.trim(),
				nodes: [],
				edges: []
			});
			mapId = created.id;
			subject = created.subject;
			nodes = [];
			edges = [];
			status = 'builder';
		} catch (err) {
			console.error(err);
			errorMessage = 'No pudimos crear tu mapa. Intenta de nuevo.';
		}
	}

	async function saveMap() {
		if (!mapId) return;
		saveStatus = 'saving';
		try {
			await pb.collection('concept_maps').update(mapId, {
				subject,
				nodes: toPersistedNodes(nodes),
				edges: toPersistedEdges(edges)
			});
			saveStatus = 'saved';
		} catch (err) {
			console.error(err);
			saveStatus = 'error';
		}
	}

	function addConcept() {
		const id = crypto.randomUUID();
		const index = nodes.length;
		const position = { x: 80 + (index % 4) * 220, y: 80 + Math.floor(index / 4) * 140 };
		nodes = [...nodes, { id, position, data: { label: 'Nuevo concepto' } }];
		saveMap();
	}

	function autoLayout() {
		const { nodes: laidOutNodes, edgeRoutes } = layoutNodes(nodes, edges);
		nodes = laidOutNodes;
		edges = edges.map((e) => ({ ...e, data: { ...e.data, routingPoints: edgeRoutes[e.id] } }));
		saveMap();
	}

	function renameSelectedNode(value: string) {
		if (!selectedNode) return;
		const id = selectedNode.id;
		nodes = nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: value } } : n));
	}

	function deleteSelectedNode() {
		if (!selectedNode) return;
		const id = selectedNode.id;
		nodes = nodes.filter((n) => n.id !== id);
		edges = edges.filter((e) => e.source !== id && e.target !== id);
		saveMap();
	}

	function handleConnect(connection: { source: string; target: string }) {
		const id = `e-${connection.source}-${connection.target}-${Date.now()}`;
		edges = [
			...edges,
			{
				id,
				source: connection.source,
				target: connection.target,
				type: 'labeled',
				label: '',
				data: { onLabelChange: handleEdgeLabelChange }
			}
		];
		saveMap();
	}

	loadModule();
</script>

<svelte:head>
	<title>Módulo 3 · Mapas conceptuales — Ancla</title>
</svelte:head>

{#if status === 'builder'}
	<div class="builder">
		<header class="builder-bar">
			<a class="back" href={resolve('/')}>← Ancla</a>
			<span class="title">{subject}</span>
			<span class="save-status save-status-{saveStatus}">
				{#if saveStatus === 'saving'}Guardando…{:else if saveStatus === 'error'}Sin guardar{:else}Guardado{/if}
			</span>
			<button
				class="link-button"
				onclick={() => {
					theoryStep = 0;
					status = 'theory';
				}}
			>
				Ver teoría de nuevo
			</button>
		</header>

		<div class="canvas">
			<SvelteFlow
				bind:nodes
				bind:edges
				{edgeTypes}
				onconnect={handleConnect}
				onnodedragstop={({ targetNode }) => {
					if (targetNode) {
						edges = edges.map((e) =>
							e.source === targetNode.id || e.target === targetNode.id
								? { ...e, data: { ...e.data, routingPoints: undefined } }
								: e
						);
					}
					saveMap();
				}}
				ondelete={() => saveMap()}
				fitView
			>
				<Background variant={BackgroundVariant.Dots} bgColor="var(--color-paper)" patternColor="var(--color-border)" />
				<Controls />
				<Panel position="top-left">
					<div class="toolbar">
						<button class="primary" onclick={addConcept}>+ Concepto</button>
						<button class="secondary" onclick={autoLayout} disabled={nodes.length < 2}>
							Organizar automáticamente
						</button>
					</div>
				</Panel>
				{#if selectedNode}
					<Panel position="top-right">
						<div class="node-editor">
							<label class="field">
								<span>Concepto</span>
								<input
									type="text"
									value={selectedNode.data.label}
									oninput={(e) => renameSelectedNode(e.currentTarget.value)}
									onblur={saveMap}
								/>
							</label>
							<button class="secondary" onclick={deleteSelectedNode}>Eliminar concepto</button>
						</div>
					</Panel>
				{/if}
				{#if nodes.length === 0}
					<Panel position="bottom-center">
						<p class="empty-hint">
							Placeholder: instrucción para crear tu primer concepto real de "{subject}".
						</p>
					</Panel>
				{/if}
			</SvelteFlow>
		</div>
	</div>
{:else}
	<main class="screen">
		<div class="card">
			{#if status === 'loading'}
				<p>Cargando…</p>
			{:else if status === 'error'}
				<p class="error" role="alert">{errorMessage}</p>
				<button class="secondary" onclick={loadModule}>Reintentar</button>
			{:else if status === 'theory'}
				<p class="step-label">Teoría {theoryStep + 1} de {THEORY_STEPS.length}</p>
				<h1>{THEORY_STEPS[theoryStep].title}</h1>
				<p class="intro">{THEORY_STEPS[theoryStep].body}</p>

				<div class="actions">
					<button class="secondary" onclick={prevTheory} disabled={theoryStep === 0}>
						Anterior
					</button>
					<button class="primary" onclick={nextTheory}>
						{#if theoryStep < THEORY_STEPS.length - 1}
							Siguiente
						{:else if mapId}
							Volver al mapa
						{:else}
							Continuar
						{/if}
					</button>
				</div>
			{:else if status === 'setup'}
				<h1>Módulo 3 · Mapas conceptuales</h1>
				<p class="intro">
					Placeholder: instrucción para elegir una materia o tema real sobre el que construir el
					mapa.
				</p>

				<form
					class="form"
					onsubmit={(e) => {
						e.preventDefault();
						saveSetup();
					}}
				>
					<label class="field">
						<span>¿Sobre qué materia o tema vas a construir tu mapa?</span>
						<input type="text" bind:value={subjectInput} required />
					</label>

					{#if errorMessage}
						<p class="error" role="alert">{errorMessage}</p>
					{/if}

					<div class="actions">
						<button type="submit" class="primary" disabled={!subjectInput.trim()}>
							Crear mi mapa
						</button>
					</div>
				</form>
			{/if}
		</div>
	</main>
{/if}

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

	.intro {
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

	.field input {
		font-family: inherit;
		font-size: 1rem;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-paper);
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

	.builder {
		height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	.builder-bar {
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

	.save-status {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-muted);
	}

	.save-status-error {
		color: var(--color-accent);
	}

	.link-button {
		background: none;
		border: none;
		color: var(--color-ink-soft);
		font-size: 0.8rem;
		cursor: pointer;
		text-decoration: underline;
	}

	.canvas {
		flex: 1;
		min-height: 0;
	}

	.toolbar {
		display: flex;
		gap: 0.5rem;
	}

	.toolbar .primary,
	.toolbar .secondary {
		flex: none;
		white-space: nowrap;
	}

	.node-editor {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-card);
		padding: var(--space-2);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 14rem;
	}

	.node-editor input {
		font-family: inherit;
		font-size: 0.95rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.empty-hint {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 0.6rem 1rem;
		font-size: 0.85rem;
		color: var(--color-ink-soft);
		box-shadow: var(--shadow-card);
	}

	:global(.svelte-flow__node) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-ink);
		font-family: var(--font-body);
		font-size: 0.85rem;
		padding: 0.5rem 0.75rem;
	}

	:global(.svelte-flow__node.selected) {
		border-color: var(--color-accent);
	}

	:global(.svelte-flow__handle) {
		width: 7px;
		height: 7px;
		background: var(--color-muted);
		border: 1.5px solid var(--color-surface);
	}

	:global(.svelte-flow__edge-label) {
		background: transparent;
		padding: 0;
		font-size: inherit;
	}

	:global(.svelte-flow__handle:hover),
	:global(.svelte-flow__handle.connectingfrom) {
		background: var(--color-accent);
	}

	:global(.svelte-flow__edge-path) {
		stroke: var(--color-ink-soft);
	}
</style>
