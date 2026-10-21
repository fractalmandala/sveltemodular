import { describe, expect, it } from 'vitest';
import { buildInitialLayout, type LayoutDecl } from '../src/lib/declare';

const view = (type: string, id?: string): LayoutDecl => ({ kind: 'view', type, id });

describe('buildInitialLayout', () => {
	it('wraps several declared roots in a row and keeps a single root as it is', () => {
		const one = buildInitialLayout([view('a')], []);
		expect(one.layout).toEqual({
			kind: 'view',
			type: 'a',
			id: undefined,
			params: undefined,
			title: undefined
		});

		const two = buildInitialLayout([view('a'), view('b')], []);
		expect(two.layout).toMatchObject({ kind: 'split', axis: 'x' });
		expect((two.layout as { children: unknown[] }).children).toHaveLength(2);
	});

	it('returns no layout for an empty workspace', () => {
		expect(buildInitialLayout([], [])).toEqual({ layout: null, floating: [] });
	});

	it('lays several stage children out as a row, and a single child directly', () => {
		const stage = (children: LayoutDecl[]): LayoutDecl => ({
			kind: 'stage',
			id: 'stage',
			children
		});
		const single = buildInitialLayout([stage([view('editor')])], []).layout as {
			child: { kind: string };
		};
		expect(single.child.kind).toBe('view');

		const many = buildInitialLayout([stage([view('a'), view('b')])], []).layout as {
			child: { kind: string; axis: string; children: unknown[] };
		};
		expect(many.child).toMatchObject({ kind: 'split', axis: 'x' });
		expect(many.child.children).toHaveLength(2);
	});

	it("only keeps views from a panel's children", () => {
		const panel: LayoutDecl = {
			kind: 'panel',
			id: 'docs',
			selected: 1,
			views: [{ kind: 'view', type: 't' }]
		};
		const result = buildInitialLayout([panel], []).layout as {
			kind: string;
			id: string;
			selected: number;
			views: unknown[];
		};
		expect(result).toMatchObject({ kind: 'panel', id: 'docs', selected: 1 });
		expect(result.views).toEqual([
			{ kind: 'view', type: 't', id: undefined, params: undefined, title: undefined }
		]);
	});

	it('builds floats from a panel or a view and drops floats without a child', () => {
		const rect = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
		const result = buildInitialLayout(
			[],
			[
				{ rect, child: { kind: 'view', type: 'tools', id: 't' } },
				{ rect },
				{ rect, layer: 'stage', child: { kind: 'panel', views: [] } }
			]
		);
		expect(result.floating).toHaveLength(2);
		expect(result.floating[0]).toMatchObject({
			rect,
			panel: { kind: 'view', type: 'tools', id: 't' }
		});
		expect(result.floating[1]).toMatchObject({
			layer: 'stage',
			panel: { kind: 'panel', views: [] }
		});
	});
});
