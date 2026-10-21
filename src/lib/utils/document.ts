// The serializable workspace document and pure operations on it.
// Pure math and tree data structures. Unit-testable without DOM or Svelte.

export type Params = Record<string, unknown>;

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export type Axis = 'x' | 'y';
export type Edge = 'left' | 'right' | 'top' | 'bottom';

/** Where a panel lives: inside the stage, beside it, or floating above it. */
export type PlacementRegion = 'stage' | 'side' | 'floating';

export interface SplitNode {
	kind: 'split';
	id: string;
	axis: Axis;
	weights: number[];
	children: LayoutNode[];
}

export interface PanelNode {
	kind: 'panel';
	id: string;
	views: string[];
	selected: string;
}

export interface StageNode {
	kind: 'stage';
	id: string;
	child?: SplitNode | PanelNode;
}

export type LayoutNode = SplitNode | PanelNode | StageNode;

export type FloatingLayer = 'stage' | 'overlay';

export interface FloatingPanel {
	panel: PanelNode;
	rect: Rect;
	z: number;
	layer: FloatingLayer;
}

export type RestoreTarget =
	| { kind: 'floating'; rect: Rect; layer: FloatingLayer }
	| {
			kind: 'docked';
			/** Exact spot the panel came from: the parent node id and its child index. */
			parent?: string;
			index?: number;
			/** Fallback when the original parent is gone. */
			beside: string;
			edge: Edge;
			share: number;
	  }
	| { kind: 'stage'; parent?: string; index?: number }
	| { kind: 'tab'; panel: string };

export interface HiddenPanel {
	panel: PanelNode;
	restore: RestoreTarget;
}

export interface ViewRecord {
	type: string;
	params?: Params;
	title?: string;
}

export interface LayoutDocument {
	schema: 1;
	version?: string | number;
	root: LayoutNode | null;
	floating: FloatingPanel[];
	hidden: HiddenPanel[];
	views: Record<string, ViewRecord>;
	popouts?: string[];
}

// ------------------------------------------------------------------ authoring specs

export type LayoutSpec = ViewSpec | PanelSpec | SplitSpec | StageSpec;

export interface ViewSpec {
	kind: 'view';
	type: string;
	id?: string;
	params?: object;
	title?: string;
}

export interface PanelSpec {
	kind: 'panel';
	id?: string;
	views: ViewSpec[];
	selected?: number;
}

export interface SplitSpec {
	kind: 'split';
	id?: string;
	axis: Axis;
	children: LayoutSpec[];
	weights?: number[];
}

export interface StageSpec {
	kind: 'stage';
	id?: string;
	child?: LayoutSpec;
}

export interface FloatSpec {
	panel: PanelSpec | ViewSpec;
	rect: Rect;
	layer?: FloatingLayer;
}

let idSeq = 0;
export function uid(prefix: string): string {
	idSeq += 1;
	const rand =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID().slice(0, 8)
			: Math.random().toString(36).slice(2, 10);
	return `${prefix}-${rand}-${idSeq.toString(36)}`;
}

/**
 * Deep copy of plain data. Works on state proxies and in environments without
 * reactivity (SSR), unlike `$state.snapshot`.
 */
export function cloneDocument<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) => cloneDocument(item)) as unknown as T;
	}
	if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(value)) {
			out[key] = cloneDocument((value as Record<string, unknown>)[key]);
		}
		return out as T;
	}
	return value;
}

export function emptyDocument(version?: string | number): LayoutDocument {
	return { schema: 1, version, root: null, floating: [], hidden: [], views: {}, popouts: [] };
}

export function specToNode(
	spec: LayoutSpec,
	views: Record<string, ViewRecord>,
	ensureViewId: (spec: ViewSpec) => string
): LayoutNode | PanelNode {
	switch (spec.kind) {
		case 'view': {
			const id = ensureViewId(spec);
			const panel: PanelNode = { kind: 'panel', id: uid('panel'), views: [id], selected: id };
			return panel;
		}
		case 'panel': {
			const ids = spec.views.map((v) => ensureViewId(v));
			const selected =
				ids.length === 0 ? '' : ids[Math.min(Math.max(spec.selected ?? 0, 0), ids.length - 1)];
			return { kind: 'panel', id: spec.id ?? uid('panel'), views: ids, selected };
		}
		case 'split': {
			const children: LayoutNode[] = [];
			for (const child of spec.children) {
				const node = specToNode(child, views, ensureViewId);
				children.push(node);
			}
			const split: SplitNode = {
				kind: 'split',
				id: spec.id ?? uid('split'),
				axis: spec.axis,
				weights: normalizeWeights(spec.weights, children.length),
				children
			};
			return split;
		}
		case 'stage': {
			const stage: StageNode = { kind: 'stage', id: spec.id ?? uid('stage') };
			if (spec.child) {
				const child = specToNode(spec.child, views, ensureViewId);
				if (child.kind === 'panel' || child.kind === 'split') stage.child = child;
			}
			return stage;
		}
	}
}

export function createDocument(
	root: LayoutSpec | null,
	options?: { floating?: FloatSpec[]; version?: string | number }
): LayoutDocument {
	const doc = emptyDocument(options?.version);
	const ensureViewId = (spec: ViewSpec): string => {
		const id = spec.id ?? uid('view');
		doc.views[id] = {
			type: spec.type,
			params: spec.params as Params | undefined,
			title: spec.title
		};
		return id;
	};
	if (root) {
		const node = specToNode(root, doc.views, ensureViewId);
		doc.root = node;
	}
	for (const float of options?.floating ?? []) {
		const panelSpec: PanelSpec =
			float.panel.kind === 'view' ? { kind: 'panel', views: [float.panel] } : float.panel;
		const panel = specToNode(panelSpec, doc.views, ensureViewId) as PanelNode;
		doc.floating.push({
			panel,
			rect: { ...float.rect },
			z: doc.floating.length + 1,
			layer: float.layer ?? 'overlay'
		});
	}
	return normalize(doc);
}

// ------------------------------------------------------------------ traversal

export function walk(node: LayoutNode | null, visit: (node: LayoutNode) => void): void {
	if (!node) return;
	visit(node);
	if (node.kind === 'split') for (const child of node.children) walk(child, visit);
	else if (node.kind === 'stage' && node.child) walk(node.child, visit);
}

export function findNode(node: LayoutNode | null, id: string): LayoutNode | null {
	if (!node) return null;
	if (node.id === id) return node;
	if (node.kind === 'split') {
		for (const child of node.children) {
			const found = findNode(child, id);
			if (found) return found;
		}
	} else if (node.kind === 'stage' && node.child) {
		return findNode(node.child, id);
	}
	return null;
}

export function panelOf(doc: LayoutDocument, viewId: string): PanelNode | null {
	let found: PanelNode | null = null;
	walk(doc.root, (node) => {
		if (!found && node.kind === 'panel' && node.views.includes(viewId)) found = node;
	});
	if (found) return found;
	for (const f of doc.floating) if (f.panel.views.includes(viewId)) return f.panel;
	for (const h of doc.hidden) if (h.panel.views.includes(viewId)) return h.panel;
	return null;
}

export function dockedPanels(root: LayoutNode | null): PanelNode[] {
	const out: PanelNode[] = [];
	walk(root, (node) => {
		if (node.kind === 'panel') out.push(node);
	});
	return out;
}

export function parentOf(
	root: LayoutNode | null,
	id: string
): { parent: LayoutNode; index: number } | null {
	if (!root) return null;
	if (root.kind === 'split') {
		const index = root.children.findIndex((child) => child.id === id);
		if (index >= 0) return { parent: root, index };
		for (const child of root.children) {
			const found = parentOf(child, id);
			if (found) return found;
		}
		return null;
	}
	if (root.kind === 'stage' && root.child) {
		if (root.child.id === id) return { parent: root, index: 0 };
		return parentOf(root.child, id);
	}
	return null;
}

export function insertChildAt(parent: SplitNode, child: LayoutNode, index: number): void {
	const at = Math.max(0, Math.min(index, parent.children.length));
	const weights = parent.weights;
	let share = 0.25;
	if (weights.length === parent.children.length && at < weights.length) {
		share = weights[at] / 2;
		weights[at] -= share;
	} else if (weights.length > 0) {
		share = weights[weights.length - 1] / 2;
		weights[weights.length - 1] -= share;
	}
	parent.children.splice(at, 0, child);
	weights.splice(at, 0, share);
	parent.weights = normalizeWeights(weights, parent.children.length);
}

export function stageOf(root: LayoutNode | null): StageNode | null {
	let found: StageNode | null = null;
	walk(root, (node) => {
		if (!found && node.kind === 'stage') found = node;
	});
	return found;
}

export function referencedViewIds(doc: LayoutDocument): Set<string> {
	const ids = new Set<string>();
	walk(doc.root, (node) => {
		if (node.kind === 'panel') for (const id of node.views) ids.add(id);
	});
	for (const f of doc.floating) for (const id of f.panel.views) ids.add(id);
	for (const h of doc.hidden) for (const id of h.panel.views) ids.add(id);
	for (const p of doc.popouts ?? []) ids.add(p);
	return ids;
}

// ------------------------------------------------------------------ mutations

export function normalizeWeights(weights: readonly number[] | undefined, count: number): number[] {
	if (count <= 0) return [];
	const given = weights ?? [];
	const out: number[] = [];
	let sum = 0;
	for (let i = 0; i < count; i++) {
		const w = given[i];
		const value = typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 1;
		out.push(value);
		sum += value;
	}
	return out.map((w) => w / sum);
}

export function removeNode(root: LayoutNode | null, id: string): LayoutNode | null {
	if (!root) return null;
	if (root.id === id) return null;
	if (root.kind === 'split') {
		const index = root.children.findIndex((child) => child.id === id);
		if (index >= 0) {
			root.children.splice(index, 1);
			root.weights.splice(index, 1);
			root.weights = normalizeWeights(root.weights, root.children.length);
		} else {
			root.children = root.children.map((child) => removeNode(child, id) ?? child);
		}
		return collapse(root);
	}
	if (root.kind === 'stage') {
		if (root.child?.id === id) root.child = undefined;
		else if (root.child) {
			const next = removeNode(root.child, id);
			root.child = next?.kind === 'panel' || next?.kind === 'split' ? next : undefined;
		}
		return root;
	}
	return root;
}

export function collapse(split: SplitNode): LayoutNode | null {
	if (split.children.length === 0) return null;
	if (split.children.length === 1) return split.children[0];
	split.weights = normalizeWeights(split.weights, split.children.length);
	return split;
}

export function sanitize(
	input: LayoutDocument,
	isKnownType?: (type: string) => boolean
): LayoutDocument {
	const raw = (input ?? {}) as Partial<LayoutDocument>;
	const sourceViews = (raw.views ?? {}) as Record<string, ViewRecord>;
	const views: Record<string, ViewRecord> = {};
	for (const [id, record] of Object.entries(sourceViews)) {
		if (!record || typeof record.type !== 'string') continue;
		if (isKnownType && !isKnownType(record.type)) continue;
		views[id] = { type: record.type, params: record.params, title: record.title };
	}

	const cleanPanel = (panel: PanelNode): PanelNode | null => {
		const kept = (panel.views ?? []).filter((id) => id in views);
		if (kept.length === 0) return null;
		return {
			kind: 'panel',
			id: typeof panel.id === 'string' && panel.id ? panel.id : uid('panel'),
			views: kept,
			selected: kept.includes(panel.selected) ? panel.selected : kept[0]
		};
	};

	const cleanNode = (node: LayoutNode | null | undefined): LayoutNode | null => {
		if (!node || typeof node !== 'object') return null;
		if (node.kind === 'panel') return cleanPanel(node);
		if (node.kind === 'stage') {
			const child = node.child ? cleanNode(node.child) : null;
			const stage: StageNode = {
				kind: 'stage',
				id: typeof node.id === 'string' && node.id ? node.id : uid('stage')
			};
			if (child?.kind === 'panel' || child?.kind === 'split') stage.child = child;
			return stage;
		}
		if (node.kind === 'split') {
			const children: LayoutNode[] = [];
			for (const child of node.children ?? []) {
				const cleaned = cleanNode(child);
				if (cleaned) children.push(cleaned);
			}
			if (children.length === 0) return null;
			if (children.length === 1) return children[0];
			return {
				kind: 'split',
				id: typeof node.id === 'string' && node.id ? node.id : uid('split'),
				axis: node.axis === 'y' ? 'y' : 'x',
				weights: normalizeWeights(node.weights, children.length),
				children
			};
		}
		return null;
	};

	const floating: FloatingPanel[] = [];
	for (const f of raw.floating ?? []) {
		const panel = f?.panel ? cleanPanel(f.panel) : null;
		if (!panel) continue;
		const rect = f.rect ?? { x: 0.1, y: 0.1, w: 0.4, h: 0.4 };
		floating.push({
			panel,
			rect: {
				x: clamp01(rect.x),
				y: clamp01(rect.y),
				w: Math.max(0.02, clamp01(rect.w)),
				h: Math.max(0.02, clamp01(rect.h))
			},
			z: typeof f.z === 'number' ? f.z : floating.length + 1,
			layer: f.layer === 'stage' ? 'stage' : 'overlay'
		});
	}

	const hidden: HiddenPanel[] = [];
	for (const h of raw.hidden ?? []) {
		const panel = h?.panel ? cleanPanel(h.panel) : null;
		if (!panel) continue;
		hidden.push({ panel, restore: h.restore ?? { kind: 'tab', panel: panel.id } });
	}

	const popouts: string[] = (raw.popouts ?? []).filter((id) => id in views);

	const doc: LayoutDocument = {
		schema: 1,
		version: raw.version,
		root: cleanNode(raw.root ?? null),
		floating,
		hidden,
		views,
		popouts
	};

	const claimed = new Set<string>();
	const dedupe = (panel: PanelNode): PanelNode | null => {
		panel.views = panel.views.filter((id) => {
			if (claimed.has(id)) return false;
			claimed.add(id);
			return true;
		});
		if (panel.views.length === 0) return null;
		if (!panel.views.includes(panel.selected)) panel.selected = panel.views[0];
		return panel;
	};

	const dedupeNode = (node: LayoutNode | null): LayoutNode | null => {
		if (!node) return null;
		if (node.kind === 'panel') return dedupe(node);
		if (node.kind === 'stage') {
			const child = node.child ? dedupeNode(node.child) : null;
			node.child = child?.kind === 'panel' || child?.kind === 'split' ? child : undefined;
			return node;
		}
		node.children = node.children
			.map((child) => dedupeNode(child))
			.filter((child): child is LayoutNode => child !== null);
		if (node.children.length === 0) return null;
		if (node.children.length === 1) return node.children[0];
		node.weights = normalizeWeights(node.weights, node.children.length);
		return node;
	};

	doc.root = dedupeNode(doc.root);
	doc.floating = doc.floating.filter((f) => dedupe(f.panel) !== null);
	doc.hidden = doc.hidden.filter((h) => dedupe(h.panel) !== null);
	return pruneViews(doc);
}

export function pruneViews(doc: LayoutDocument): LayoutDocument {
	const referenced = referencedViewIds(doc);
	for (const id of Object.keys(doc.views)) {
		if (!referenced.has(id)) delete doc.views[id];
	}
	return doc;
}

export function normalize(doc: LayoutDocument): LayoutDocument {
	return sanitize(doc);
}

function clamp01(value: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export const layout = {
	view(type: string, options?: Omit<ViewSpec, 'kind' | 'type'>): ViewSpec {
		return { kind: 'view', type, ...options };
	},
	panel(...args: ViewSpec[] | [{ id?: string; selected?: number }, ...ViewSpec[]]): PanelSpec {
		const first = args[0] as { id?: string; selected?: number } | ViewSpec | undefined;
		const hasOptions = !!first && !('kind' in first);
		const views = (hasOptions ? args.slice(1) : args) as ViewSpec[];
		const options = hasOptions ? (first as { id?: string; selected?: number }) : {};
		return { kind: 'panel', ...options, views };
	},
	split(
		axis: Axis,
		children: LayoutSpec[],
		options?: { weights?: number[]; id?: string }
	): SplitSpec {
		return { kind: 'split', axis, children, ...options };
	},
	row(children: LayoutSpec[], weights?: number[]): SplitSpec {
		return { kind: 'split', axis: 'x', children, weights };
	},
	column(children: LayoutSpec[], weights?: number[]): SplitSpec {
		return { kind: 'split', axis: 'y', children, weights };
	},
	stage(child?: LayoutSpec, options?: { id?: string }): StageSpec {
		return { kind: 'stage', child, ...options };
	}
};
