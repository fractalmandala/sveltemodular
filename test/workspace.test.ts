import { describe, expect, it } from 'vitest';
import { createDocument, layout } from '../src/lib/document';
import { WorkspaceModel } from '../src/lib/workspace-model.svelte';

function seeded(): WorkspaceModel {
	const model = new WorkspaceModel();
	model.registerType({ id: 'notes', title: 'Notes' });
	model.registerType({ id: 'editor', title: 'Editor', placement: 'stage' });
	model.adopt(
		createDocument(
			layout.split('x', [
				layout.panel(layout.view('notes', { id: 'n1' })),
				layout.stage(layout.view('editor', { id: 'e1' }))
			])
		)
	);
	return model;
}

describe('WorkspaceModel', () => {
	it('opens into the stage panel and focuses the new view', () => {
		const model = seeded();
		const info = model.open('editor', { id: 'e2' });
		expect(info.panelId).toBe(model.view('e1')!.panelId);
		expect(model.focusedView).toBe('e2');
		expect(model.view('e2')!.selected).toBe(true);
	});

	it('enforces singleton by revealing the existing view', () => {
		const model = seeded();
		model.registerType({ id: 'palette', title: 'Palette', singleton: true });
		const first = model.open('palette');
		const second = model.open('palette');
		expect(second.id).toBe(first.id);
		expect(model.views({ type: 'palette' })).toHaveLength(1);
	});

	it('close removes the view, its record, and collapses its empty panel', async () => {
		const model = seeded();
		await model.close('n1');
		expect(model.view('n1')).toBeNull();
		expect(model.doc.root?.kind).toBe('stage');
	});

	it('close guards can veto', async () => {
		const model = seeded();
		model.api('n1').guardClose(() => false);
		expect(await model.close('n1')).toBe(false);
		expect(model.view('n1')).not.toBeNull();
		expect(await model.close('n1', { force: true })).toBe(true);
	});

	it('hide/restore round-trips a panel with its views and selection', () => {
		const model = seeded();
		const panelId = model.view('n1')!.panelId;
		model.hide(panelId);
		expect(model.view('n1')!.placement).toBe('hidden');
		expect(model.getSnapshot().hidden.map((h) => h.panelId)).toEqual([panelId]);
		model.restore(panelId);
		expect(model.view('n1')!.placement).not.toBe('hidden');
		expect(model.focusedView).toBe('n1');
	});

	it('float then dock returns the panel to the tree', () => {
		const model = seeded();
		const panelId = model.view('n1')!.panelId;
		model.float(panelId);
		expect(model.view('n1')!.placement).toBe('floating');
		model.dock(panelId, 'stage');
		expect(model.view('n1')!.placement).not.toBe('floating');
		expect(model.doc.floating).toHaveLength(0);
	});

	it('getDocument returns a detached copy', () => {
		const model = seeded();
		const copy = model.getDocument();
		(copy.root as { id: string }).id = 'mutated';
		expect(model.doc.root?.id).not.toBe('mutated');
	});

	it('title resolution: runtime title wins, then record, then type', () => {
		const model = seeded();
		expect(model.titleOf('n1')).toBe('Notes');
		model.setTitle('n1', 'Renamed');
		expect(model.titleOf('n1')).toBe('Renamed');
	});

	it('run tab.next cycles within the focused panel', () => {
		const model = seeded();
		model.open('notes', { id: 'n2', placement: { into: model.view('n1')!.panelId } });
		model.focus('n1');
		model.run('tab.next');
		expect(model.focusedView).toBe('n2');
		model.run('tab.next');
		expect(model.focusedView).toBe('n1');
	});

	it('moveView reorders tabs within the same panel', () => {
		const model = seeded();
		const p1 = model.view('n1')!.panelId;
		model.open('notes', { id: 'n2', placement: { into: p1 } });
		model.open('notes', { id: 'n3', placement: { into: p1 } });
		// Move n3 to the beginning (index 0)
		model.moveView('n3', { into: p1, index: 0 });
		const panel = model.doc.root?.kind === 'split' ? model.doc.root.children[0] : null;
		expect(panel?.views).toEqual(['n3', 'n1', 'n2']);
		expect(panel?.selected).toBe('n3');
	});

	it('moveView moves a view into another panel', () => {
		const model = seeded();
		const pStage = model.view('e1')!.panelId;
		model.moveView('n1', { into: pStage });
		expect(model.view('n1')!.panelId).toBe(pStage);
		expect(model.doc.root?.kind).toBe('stage');
	});

	it('moveView splits a view beside another panel on drag-dock', () => {
		const model = seeded();
		const p1 = model.view('n1')!.panelId;
		model.open('notes', { id: 'n2', placement: { into: p1 } });
		// Split n2 below n1
		model.moveView('n2', { beside: p1, edge: 'bottom', share: 0.5 });
		expect(model.view('n2')!.panelId).not.toBe(p1);
		expect(model.views()).toHaveLength(3);
	});

	it('toggleMaximize maximizes and restores views', () => {
		const model = seeded();
		expect(model.maximizedView).toBeNull();
		model.toggleMaximize('n1');
		expect(model.maximizedView).toBe('n1');
		model.toggleMaximize('n1');
		expect(model.maximizedView).toBeNull();
	});

	it('openPopout and closePopout manage detached windows', () => {
		const model = seeded();
		expect(model.popouts).toHaveLength(0);
		model.openPopout('n1');
		expect(model.popouts).toEqual(['n1']);
		expect(model.placementOf('n1')).toBe('popout');
		model.closePopout('n1');
		expect(model.popouts).toHaveLength(0);
	});
});
