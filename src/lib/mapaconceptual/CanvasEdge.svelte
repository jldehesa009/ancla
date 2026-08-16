<script lang="ts">
	import { BaseEdge, EdgeLabel, getBezierPath, type EdgeProps } from '@xyflow/svelte';

	type Point = { x: number; y: number };

	let {
		id,
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		label,
		data
	}: EdgeProps & {
		data?: { onLabelChange?: (id: string, value: string) => void; routingPoints?: Point[] };
	} = $props();

	// After "Organizar automáticamente" we have a dagre-computed route that avoids
	// other nodes; freshly hand-connected edges fall back to a plain bezier curve.
	let routedPath = $derived.by(() => {
		const waypoints = data?.routingPoints;
		if (!waypoints?.length) return null;

		const points: Point[] = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
		const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
		const mid = points[Math.floor(points.length / 2)];
		return { path: d, labelX: mid.x, labelY: mid.y };
	});

	let bezierData = $derived(
		getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
	);

	let path = $derived(routedPath?.path ?? bezierData[0]);
	let labelX = $derived(routedPath?.labelX ?? bezierData[1]);
	let labelY = $derived(routedPath?.labelY ?? bezierData[2]);

	function handleBlur(event: FocusEvent & { currentTarget: HTMLInputElement }) {
		data?.onLabelChange?.(id, event.currentTarget.value);
	}
</script>

<BaseEdge {id} {path} />

<EdgeLabel x={labelX} y={labelY}>
	<input
		class="edge-label"
		style="width: {Math.max(10, (label ?? '').length + 4)}ch"
		value={label ?? ''}
		placeholder="relación…"
		onblur={handleBlur}
	/>
</EdgeLabel>

<style>
	.edge-label {
		box-sizing: border-box;
		pointer-events: all;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		white-space: nowrap;
		text-align: center;
		min-width: 6rem;
		max-width: 20rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-paper);
		color: var(--color-ink);
		padding: 0.25rem 0.5rem;
	}

	.edge-label:focus-visible {
		box-shadow: var(--focus-ring);
		outline: none;
	}
</style>
