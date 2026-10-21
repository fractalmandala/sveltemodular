import { describe, expect, it } from 'vitest';
import { createDocument, layout, type LayoutDocument, type LayoutNode } from '../src/lib/document';
import { WorkspaceModel } from '../src/lib/workspace-model.svelte';
import { matchesCombo } from '../src/lib/types';

function model(): WorkspaceModel {
	const m = new WorkspaceModel();
	m.registerType({ id: 'notes', title: 'Notes' });
	m.registerType({ id: 'editor', title: 'Editor', placement: 'stage' });
	return m;
}

function staged(): WorkspaceModel {
	const m = model();
	m.adopt(
		createDocument(
			layout.split('x', [
				layout.panel(layout.view('notes', { id: 'n1' })),
				layout.stage(
					layout.split('y', [
						layout.panel(layout.view('notes', { id: 'a' })),
						layout.panel(layout.view('notes', { id: 'b' }))
					])
				)
			])
		)
	);
	return m;
}

describe('stage placement', () => {
	it('opens into a stage that holds a split without dropping the other panels', () => {
		const m = staged();
		m.open('editor', { id: 'e9' });

		expect(Object.keys(m.doc.views).sort()).toEqual(['a', 'b', 'e9', 'n1']);
		const stage = m.doc.root?.kind === 'split' ? m.doc.root.children[1] : null;
		expect(stage?.kind).toBe('stage');
		const child = stage?.kind === 'stage' ? stage.child : null;
		expect(child?.kind).toBe('split');
		const collect = (node: LayoutNode): string[] =>
			node.kind === 'panel' ? node.views : node.children.flatMap(collect);
		if (child?.kind === 'split') {
			expect(collect(child).sort()).toEqual(['a', 'b', 'e9']);
		}
	});

	it('keeps the panels of a stage that holds a single panel', () => {
		const m = model();
		m.adopt(
			createDocument(
				layout.split('x', [
					layout.panel(layout.view('notes', { id: 'n1' })),
					layout.stage(layout.view('editor', { id: 'e1' }))
				])
			)
		);
		m.open('editor', { id: 'e2' });
		expect(m.view('e2')!.panelId).toBe(m.view('e1')!.panelId);
		expect(Object.keys(m.doc.views).sort()).toEqual(['e1', 'e2', 'n1']);
	});
});

describe('popouts', () => {
	it('moves the view into the window and redocks it when the window closes', () => {
		const m = model();
		m.adopt(
			createDocument(
				layout.panel(layout.view('notes', { id: 'n1' }), layout.view('notes', { id: 'n2' }))
			)
		);
		const panelId = m.view('n1')!.panelId;

		m.openPopout('n1');
		expect(m.popouts).toEqual(['n1']);
		expect(m.placementOf('n1')).toBe('popout');
		expect(m.doc.views.n1).toBeDefined();
		expect(m.view('n1')!.panelId).toBe('');

		m.closePopout('n1');
		expect(m.popouts).toEqual([]);
		expect(m.placementOf('n1')).not.toBe('popout');
		expect(m.view('n1')!.panelId).toBe(panelId);
	});

	it('redocks into a fresh panel when the original one was emptied', () => {
		const m = model();
		m.adopt(createDocument(layout.panel(layout.view('notes', { id: 'n1' }))));
		m.openPopout('n1');
		m.closePopout('n1');
		expect(m.view('n1')!.panelId).not.toBe('');
		expect(m.placementOf('n1')).not.toBe('popout');
	});

	it('adopts a document with popouts without showing them twice', () => {
		const m = model();
		const doc = createDocument(
			layout.panel(layout.view('notes', { id: 'n1' }), layout.view('notes', { id: 'n2' }))
		);
		doc.popouts = ['n1'];
		m.adopt(doc);
		expect(m.popouts).toEqual(['n1']);
		expect(m.view('n1')!.panelId).toBe('');
		expect(m.view('n2')!.panelId).not.toBe('');
	});
});

describe('hidden panels', () => {
	it('restores a panel to the position it was hidden from', () => {
		const m = model();
		m.adopt(
			createDocument(
				layout.split('x', [
					layout.panel(layout.view('notes', { id: 'left' })),
					layout.panel(layout.view('notes', { id: 'middle' })),
					layout.panel(layout.view('notes', { id: 'right' }))
				])
			)
		);
		const middleId = m.view('middle')!.panelId;
		m.hide(middleId);
		expect(m.view('middle')!.placement).toBe('hidden');

		m.restore(middleId);
		const root = m.doc.root;
		expect(root?.kind).toBe('split');
		if (root?.kind === 'split') {
			const order = root.children.map((c) => (c.kind === 'panel' ? c.views[0] : ''));
			expect(order).toEqual(['left', 'middle', 'right']);
		}
	});
});

describe('placement rules', () => {
	it('falls back to a region the type allows', () => {
		const m = model();
		m.registerType({
			id: 'palette',
			title: 'Palette',
			placement: 'stage',
			allow: { stage: false }
		});
		m.adopt(
			createDocument(
				layout.split('x', [
					layout.panel(layout.view('notes', { id: 'n1' })),
					layout.stage(layout.view('editor', { id: 'e1' }))
				])
			)
		);
		const info = m.open('palette');
		expect(info.placement).toBe('docked');
		expect(m.view(info.id)!.panelId).not.toBe(m.view('e1')!.panelId);
	});

	it('refuses a move into a region the type does not allow', () => {
		const m = model();
		m.registerType({ id: 'palette', title: 'Palette', allow: { stage: false } });
		m.adopt(
			createDocument(
				layout.split('x', [
					layout.panel(layout.view('notes', { id: 'n1' })),
					layout.stage(layout.view('editor', { id: 'e1' }))
				])
			)
		);
		m.open('palette', { id: 'p1', placement: 'side' });
		const stagePanel = m.view('e1')!.panelId;
		const palettePanel = m.view('p1')!.panelId;
		expect(m.moveView('p1', { into: stagePanel })).toBe(false);
		expect(m.view('p1')!.panelId).toBe(palettePanel);
	});

	it('allows a move the type permits', () => {
		const m = model();
		m.adopt(
			createDocument(
				layout.split('x', [
					layout.panel(layout.view('notes', { id: 'n1' })),
					layout.stage(layout.view('editor', { id: 'e1' }))
				])
			)
		);
		const stagePanel = m.view('e1')!.panelId;
		expect(m.moveView('n1', { into: stagePanel })).toBe(true);
		expect(m.view('n1')!.panelId).toBe(stagePanel);
	});
});

describe('splitting', () => {
	it('moves the view into a new panel beside the old one', () => {
		const m = model();
		m.adopt(
			createDocument(
				layout.panel(layout.view('notes', { id: 'n1' }), layout.view('notes', { id: 'n2' }))
			)
		);
		const panelId = m.view('n1')!.panelId;
		m.splitView('n2', 'right');
		expect(m.view('n2')!.panelId).not.toBe(panelId);
		expect(m.view('n1')!.panelId).toBe(panelId);
		expect(m.doc.root?.kind).toBe('split');
	});
});

describe('menu', () => {
	it('leads with the view menu and adds the split entries', () => {
		const m = model();
		m.registerType({
			id: 'notes',
			title: 'Notes',
			menu: [{ id: 'custom', label: 'Custom', run: () => {} }]
		});
		m.adopt(
			createDocument(
				layout.panel(layout.view('notes', { id: 'n1' }), layout.view('notes', { id: 'n2' }))
			)
		);
		const panel = m.doc.root as { kind: string; views: string[] };
		const entries = m.menuEntries(panel as never, 'side');
		const ids = entries.map((e) => (e === 'separator' ? 'separator' : e.id));
		expect(ids[0]).toBe('custom');
		expect(ids).toContain('split-right');
		expect(ids).toContain('split-below');
		expect(ids).toContain('move');
		expect(ids).toContain('close-others');
	});
});

describe('runtime state', () => {
	it('updates the title and badge of a view', () => {
		const m = model();
		m.adopt(createDocument(layout.panel(layout.view('notes', { id: 'n1' }))));
		m.api('n1').setTitle('Renamed');
		expect(m.api('n1').title).toBe('Renamed');
		m.api('n1').setBadge(3);
		expect(m.api('n1').badge).toBe(3);
	});
});

describe('keyboard', () => {
	it('matches bracket shortcuts by physical key when Alt rewrites the key', () => {
		const event = {
			key: '{',
			code: 'BracketLeft',
			metaKey: true,
			ctrlKey: false,
			altKey: true,
			shiftKey: false
		} as unknown as KeyboardEvent;
		expect(matchesCombo(event, 'Mod+Alt+[')).toBe(true);

		const plain = {
			key: ']',
			code: 'BracketRight',
			metaKey: true,
			ctrlKey: false,
			altKey: true,
			shiftKey: false
		} as unknown as KeyboardEvent;
		expect(matchesCombo(plain, 'Mod+Alt+]')).toBe(true);
	});
});

describe('documents', () => {
	it('keeps the document serialisable after a change', () => {
		const m = model();
		m.adopt(createDocument(layout.panel(layout.view('notes', { id: 'n1' }))));
		m.open('notes', { id: 'n2' });
		const doc: LayoutDocument = m.getDocument();
		expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
	});
});
