import { describe, expect, it } from 'vitest';
import {
	createDocument,
	layout,
	normalizeWeights,
	sanitize,
	type LayoutDocument
} from '../src/lib/document';

describe('createDocument', () => {
	it('compiles specs into panels with registered view records', () => {
		const doc = createDocument(
			layout.split('x', [
				layout.panel(layout.view('notes', { id: 'a' }), layout.view('notes', { id: 'b' })),
				layout.stage(layout.view('editor', { id: 'main' }))
			])
		);
		expect(doc.root?.kind).toBe('split');
		expect(Object.keys(doc.views).sort()).toEqual(['a', 'b', 'main']);
		expect(doc.views.a).toEqual({ type: 'notes', params: undefined, title: undefined });
	});

	it('selects by index and clamps out-of-range selections', () => {
		const doc = createDocument(
			layout.panel({ selected: 9 }, layout.view('t', { id: 'a' }), layout.view('t', { id: 'b' }))
		);
		const root = doc.root as { selected: string };
		expect(root.selected).toBe('b');
	});

	it('builds floating panels from float specs', () => {
		const doc = createDocument(null, {
			floating: [{ panel: layout.view('tools', { id: 't' }), rect: { x: 0, y: 0, w: 0.3, h: 0.3 } }]
		});
		expect(doc.root).toBeNull();
		expect(doc.floating).toHaveLength(1);
		expect(doc.floating[0].panel.views).toEqual(['t']);
	});
});

describe('sanitize', () => {
	const dirty = {
		schema: 1,
		root: {
			kind: 'split',
			id: 's',
			axis: 'x',
			weights: [3, 1],
			children: [
				{ kind: 'panel', id: 'p1', views: ['a', 'gone'], selected: 'gone' },
				{ kind: 'panel', id: 'p2', views: ['gone'], selected: 'gone' },
				{ kind: 'panel', id: 'p3', views: ['a'], selected: 'a' }
			]
		},
		floating: [],
		hidden: [],
		views: { a: { type: 't' } }
	} as unknown as LayoutDocument;

	it('drops dangling views, empty panels, and duplicate claims', () => {
		const doc = sanitize(structuredClone(dirty));
		expect(doc.root?.kind).toBe('panel');
		expect((doc.root as { id: string }).id).toBe('p1');
		expect(doc.views).toEqual({ a: { type: 't', params: undefined, title: undefined } });
	});

	it('drops views of unknown types when a checker is given', () => {
		const doc = sanitize(structuredClone(dirty), (t) => t === 'other');
		expect(doc.root).toBeNull();
		expect(doc.views).toEqual({});
	});
});

describe('normalizeWeights', () => {
	it('fills missing weights with equal shares and sums to 1', () => {
		expect(normalizeWeights(undefined, 2)).toEqual([0.5, 0.5]);
		const w = normalizeWeights([3, 1, 0], 3);
		expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
		expect(w[0]).toBeGreaterThan(w[1]);
	});
	it('returns [] for no children', () => {
		expect(normalizeWeights([1], 0)).toEqual([]);
	});
});
