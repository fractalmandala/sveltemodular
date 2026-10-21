import type {
	Axis,
	FloatSpec,
	FloatingLayer,
	LayoutSpec,
	PanelSpec,
	Rect,
	SplitSpec,
	StageSpec,
	ViewSpec
} from './document';

export interface ViewDecl {
	kind: 'view';
	type: string;
	id?: string;
	params?: object;
	title?: string;
}

export interface PanelDecl {
	kind: 'panel';
	id?: string;
	selected?: number;
	views: ViewDecl[];
}

export interface SplitDecl {
	kind: 'split';
	axis: Axis;
	id?: string;
	weights?: number[];
	children: LayoutDecl[];
}

export interface StageDecl {
	kind: 'stage';
	id?: string;
	children: LayoutDecl[];
}

export type LayoutDecl = ViewDecl | PanelDecl | SplitDecl | StageDecl;

export interface FloatingDecl {
	rect: Rect;
	layer?: FloatingLayer;
	child?: PanelDecl | ViewDecl;
}

export interface Collector {
	add(node: LayoutDecl): void;
}

export function toViewSpec(node: ViewDecl): ViewSpec {
	return { kind: 'view', type: node.type, id: node.id, params: node.params, title: node.title };
}

export function toPanelSpec(node: PanelDecl): PanelSpec {
	return { kind: 'panel', id: node.id, selected: node.selected, views: node.views.map(toViewSpec) };
}

export function toLayoutSpec(node: LayoutDecl): LayoutSpec {
	switch (node.kind) {
		case 'view':
			return toViewSpec(node);
		case 'panel':
			return toPanelSpec(node);
		case 'split': {
			const split: SplitSpec = {
				kind: 'split',
				axis: node.axis,
				id: node.id,
				weights: node.weights,
				children: node.children.map(toLayoutSpec)
			};
			return split;
		}
		case 'stage': {
			const kids = node.children.map(toLayoutSpec);
			const child: LayoutSpec | undefined =
				kids.length > 1 ? { kind: 'split', axis: 'x', children: kids } : kids[0];
			const stage: StageSpec = { kind: 'stage', id: node.id, child };
			return stage;
		}
	}
}

export interface InitialLayout {
	layout: LayoutSpec | null;
	floating: FloatSpec[];
}

export function buildInitialLayout(
	roots: readonly LayoutDecl[],
	floating: readonly FloatingDecl[]
): InitialLayout {
	const layouts = roots.map(toLayoutSpec);
	const layout =
		layouts.length > 1
			? { kind: 'split' as const, axis: 'x' as const, children: layouts }
			: (layouts[0] ?? null);
	const floats: FloatSpec[] = [];
	for (const f of floating) {
		if (!f.child) continue;
		const panel = f.child.kind === 'panel' ? toPanelSpec(f.child) : toViewSpec(f.child);
		floats.push({ panel, rect: f.rect, layer: f.layer });
	}
	return { layout, floating: floats };
}
