// Pure layout mechanics on the document tree: where a view goes, how a panel
// is inserted, and which region a panel lives in. No reactivity, no state.

import {
	findNode,
	insertChildAt,
	stageOf,
	uid,
	type Edge,
	type FloatingLayer,
	type LayoutDocument,
	type LayoutNode,
	type PanelNode,
	type PlacementRegion,
	type Rect,
	type RestoreTarget
} from './document';
import type { Placement, ViewTypeProps } from './types';

export interface ViewIndexEntry {
	panelId: string;
	placement: 'docked' | 'stage' | 'floating' | 'hidden';
	selected: boolean;
}

export interface ViewIndex {
	views: Map<string, ViewIndexEntry>;
	regions: Map<string, PlacementRegion>;
}

export function newPanel(viewId: string): PanelNode {
	return { kind: 'panel', id: uid('panel'), views: [viewId], selected: viewId };
}

/** Indexes every view by panel, so lookups do not walk the tree. */
export function buildViewIndex(doc: LayoutDocument): ViewIndex {
	const views = new Map<string, ViewIndexEntry>();
	const regions = new Map<string, PlacementRegion>();

	const visit = (node: LayoutNode | null, region: PlacementRegion): void => {
		if (!node) return;
		if (node.kind === 'panel') {
			regions.set(node.id, region);
			for (const id of node.views) {
				views.set(id, {
					panelId: node.id,
					placement: region === 'stage' ? 'stage' : 'docked',
					selected: node.selected === id
				});
			}
			return;
		}
		if (node.kind === 'stage') {
			visit(node.child ?? null, 'stage');
			return;
		}
		for (const child of node.children) visit(child, region);
	};

	visit(doc.root, 'side');

	for (const f of doc.floating) {
		regions.set(f.panel.id, 'floating');
		for (const id of f.panel.views) {
			views.set(id, {
				panelId: f.panel.id,
				placement: 'floating',
				selected: f.panel.selected === id
			});
		}
	}

	for (const h of doc.hidden) {
		regions.set(h.panel.id, 'side');
		for (const id of h.panel.views) {
			views.set(id, {
				panelId: h.panel.id,
				placement: 'hidden',
				selected: h.panel.selected === id
			});
		}
	}

	return { views, regions };
}

export function allowsRegion(def: ViewTypeProps | undefined, region: PlacementRegion): boolean {
	const allow = def?.allow;
	if (!allow) return true;
	return allow[region] !== false;
}

export function regionForPlacement(
	placement: Placement,
	regionOfPanel: (id: string) => PlacementRegion
): PlacementRegion {
	if (placement === 'stage') return 'stage';
	if (placement === 'float') return 'floating';
	if (placement === 'side') return 'side';
	if (typeof placement === 'object') {
		if ('float' in placement) return 'floating';
		if ('into' in placement) return regionOfPanel(placement.into);
		if ('beside' in placement) return regionOfPanel(placement.beside);
	}
	return 'side';
}

/** Falls back to a region the view type allows when the request does not. */
export function resolvePlacement(
	def: ViewTypeProps | undefined,
	requested: Placement,
	regionOfPanel: (id: string) => PlacementRegion
): Placement {
	if (allowsRegion(def, regionForPlacement(requested, regionOfPanel))) return requested;
	const fallback = (['side', 'floating', 'stage'] as const).find((region) =>
		allowsRegion(def, region)
	);
	if (fallback === 'floating') return 'float';
	return fallback ?? 'stage';
}

/** Puts a panel next to another node, replacing it with a split. */
export function insertBeside(
	doc: LayoutDocument,
	panel: PanelNode,
	besideId: string,
	edge: Edge,
	share: number
): void {
	const root = doc.root;
	if (!root) {
		doc.root = panel;
		return;
	}
	const targetId = besideId === 'stage' ? (stageOf(root)?.id ?? root.id) : besideId;
	const axis = edge === 'left' || edge === 'right' ? 'x' : 'y';
	const before = edge === 'left' || edge === 'top';
	const replace = (node: LayoutNode): LayoutNode => {
		if (node.id === targetId) {
			return {
				kind: 'split',
				id: uid('split'),
				axis,
				weights: before ? [share, 1 - share] : [1 - share, share],
				children: before ? [panel, node] : [node, panel]
			};
		}
		if (node.kind === 'split') node.children = node.children.map(replace);
		else if (node.kind === 'stage' && node.child) {
			const child = replace(node.child);
			if (child.kind === 'panel' || child.kind === 'split') node.child = child;
		}
		return node;
	};
	doc.root = replace(root);
}

/** Inserts a panel inside the stage, next to whatever the stage holds. */
export function insertBesideStage(
	doc: LayoutDocument,
	panel: PanelNode,
	edge: Edge,
	share: number
): void {
	const stage = stageOf(doc.root);
	if (!stage) {
		if (!doc.root) doc.root = panel;
		else insertBeside(doc, panel, doc.root.id, 'right', share);
		return;
	}
	if (!stage.child) {
		stage.child = panel;
		return;
	}
	const axis = edge === 'left' || edge === 'right' ? 'x' : 'y';
	const before = edge === 'left' || edge === 'top';
	stage.child = {
		kind: 'split',
		id: uid('split'),
		axis,
		weights: before ? [share, 1 - share] : [1 - share, share],
		children: before ? [panel, stage.child] : [stage.child, panel]
	};
}

/** Inserts a panel next to the stage, outside of it. */
export function insertBesideStageNode(
	doc: LayoutDocument,
	panel: PanelNode,
	edge: Edge,
	share: number
): void {
	const stage = stageOf(doc.root);
	if (!stage) {
		if (!doc.root) doc.root = panel;
		else insertBeside(doc, panel, doc.root.id, edge, share);
		return;
	}
	insertBeside(doc, panel, stage.id, edge, share);
}

export interface PlaceOptions {
	floatingLayer: FloatingLayer;
	resolvePanel: (id: string) => PanelNode | null;
}

/** Puts a new view into the document and returns the panel that holds it. */
export function placeNewView(
	doc: LayoutDocument,
	viewId: string,
	placement: Placement,
	options: PlaceOptions
): PanelNode {
	if (placement === 'stage') {
		const stage = stageOf(doc.root);
		if (!stage) {
			const panel = newPanel(viewId);
			doc.root = { kind: 'stage', id: uid('stage'), child: panel };
			return panel;
		}
		if (stage.child?.kind === 'panel') {
			stage.child.views.push(viewId);
			return stage.child;
		}
		const panel = newPanel(viewId);
		insertBesideStage(doc, panel, 'right', 0.5);
		return panel;
	}

	if (placement === 'side') {
		const panel = newPanel(viewId);
		insertBesideStageNode(doc, panel, 'right', 0.3);
		return panel;
	}

	if (typeof placement === 'object' && 'into' in placement) {
		const target = options.resolvePanel(placement.into);
		if (target) {
			const idx = placement.index ?? target.views.length;
			target.views.splice(idx, 0, viewId);
			return target;
		}
	}

	if (typeof placement === 'object' && 'beside' in placement) {
		const panel = newPanel(viewId);
		insertBeside(doc, panel, placement.beside, placement.edge, placement.share ?? 0.3);
		return panel;
	}

	if (placement === 'float' || (typeof placement === 'object' && 'float' in placement)) {
		const rect =
			typeof placement === 'object' && 'float' in placement ? placement.float : undefined;
		const layer =
			typeof placement === 'object' && 'float' in placement ? placement.layer : undefined;
		const panel = newPanel(viewId);
		doc.floating.push({
			panel,
			rect: rect ?? { x: 0.2, y: 0.2, w: 0.4, h: 0.4 },
			z: doc.floating.length + 1,
			layer: layer ?? options.floatingLayer
		});
		return panel;
	}

	const panel = newPanel(viewId);
	if (!doc.root) {
		doc.root = panel;
	} else {
		insertBesideStage(doc, panel, 'right', 0.3);
	}
	return panel;
}

/** Puts a hidden panel back where it came from. */
export function restoreDocked(doc: LayoutDocument, panel: PanelNode, target: RestoreTarget): void {
	if (target.kind === 'stage') {
		const parent = target.parent ? findNode(doc.root, target.parent) : null;
		if (parent && parent.kind === 'split') {
			insertChildAt(parent, panel, target.index ?? parent.children.length);
			return;
		}
		insertBesideStage(doc, panel, 'right', 0.3);
		return;
	}
	if (target.kind !== 'docked') return;
	const parent = target.parent ? findNode(doc.root, target.parent) : null;
	if (parent && parent.kind === 'split') {
		insertChildAt(parent, panel, target.index ?? parent.children.length);
		return;
	}
	if (target.beside && findNode(doc.root, target.beside)) {
		insertBeside(doc, panel, target.beside, target.edge, target.share);
		return;
	}
	insertBesideStageNode(doc, panel, 'right', 0.3);
}

/* ------------------------------------------------------------------ floating panels */

export function floatingRectOf(doc: LayoutDocument, panelId: string): Rect | null {
	const floating = doc.floating.find((f) => f.panel.id === panelId);
	return floating ? { ...floating.rect } : null;
}

/** Moves or resizes a floating panel. Returns false when there is no such panel. */
export function setFloatingRectOf(
	doc: LayoutDocument,
	panelId: string,
	rect: Partial<Rect>
): boolean {
	const floating = doc.floating.find((f) => f.panel.id === panelId);
	if (!floating) return false;
	const next = { ...floating.rect, ...rect };
	next.w = clamp(next.w, 0.08, 1);
	next.h = clamp(next.h, 0.08, 1);
	next.x = clamp(next.x, 0, 1 - next.w);
	next.y = clamp(next.y, 0, 1 - next.h);
	floating.rect = next;
	return true;
}

/** Brings a floating panel to the front. Returns false when it was already on top. */
export function raiseFloatingIn(doc: LayoutDocument, panelId: string): boolean {
	const floating = doc.floating.find((f) => f.panel.id === panelId);
	if (!floating) return false;
	const maxZ = Math.max(0, ...doc.floating.map((f) => f.z));
	if (floating.z >= maxZ) return false;
	floating.z = maxZ + 1;
	return true;
}

function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, value));
}
