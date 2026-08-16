import dagre from '@dagrejs/dagre';

interface LayoutNode {
	id: string;
	position: { x: number; y: number };
	data?: { label?: string };
}

interface LayoutEdge {
	id: string;
	source: string;
	target: string;
}

interface Point {
	x: number;
	y: number;
}

export interface LayoutResult<T> {
	nodes: T[];
	edgeRoutes: Record<string, Point[]>;
}

const NODE_HEIGHT = 44;
const MIN_NODE_WIDTH = 120;
const MAX_NODE_WIDTH = 260;

function estimateWidth(label: string | undefined): number {
	const length = (label ?? '').length;
	return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, length * 8 + 48));
}

export function layoutNodes<T extends LayoutNode>(nodes: T[], edges: LayoutEdge[]): LayoutResult<T> {
	const g = new dagre.graphlib.Graph();
	g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 70 });
	g.setDefaultEdgeLabel(() => ({}));

	for (const node of nodes) {
		g.setNode(node.id, { width: estimateWidth(node.data?.label), height: NODE_HEIGHT });
	}
	for (const edge of edges) {
		g.setEdge(edge.source, edge.target);
	}

	dagre.layout(g);

	const laidOutNodes = nodes.map((node) => {
		const layout = g.node(node.id);
		const width = estimateWidth(node.data?.label);
		return {
			...node,
			position: { x: layout.x - width / 2, y: layout.y - NODE_HEIGHT / 2 }
		};
	});

	const edgeRoutes: Record<string, Point[]> = {};
	for (const edge of edges) {
		const routed = g.edge(edge.source, edge.target);
		if (routed?.points?.length) {
			edgeRoutes[edge.id] = routed.points;
		}
	}

	return { nodes: laidOutNodes, edgeRoutes };
}
