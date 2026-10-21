import type { PanelNode } from './document';
import type { MenuEntry } from '../types';
import type { WorkspaceModel } from '../state/workspace-model.svelte';

export function cleanMenuSeparators(entries: MenuEntry[]): MenuEntry[] {
	const out: MenuEntry[] = [];
	for (const entry of entries) {
		if (entry === 'separator') {
			if (out.length === 0 || out[out.length - 1] === 'separator') continue;
		}
		out.push(entry);
	}
	while (out.length && out[out.length - 1] === 'separator') out.pop();
	return out;
}

export function buildPanelMenu(
	model: WorkspaceModel,
	panel: PanelNode,
	region: 'stage' | 'side' | 'floating'
): MenuEntry[] {
	const selected = model.api(panel.selected);
	const entries: MenuEntry[] = [];

	const def = model.typeDef(selected.type);
	const viewMenu = typeof def?.menu === 'function' ? def.menu(selected) : (def?.menu ?? []);
	if (viewMenu.length) {
		entries.push(...viewMenu);
		entries.push('separator');
	}

	const isFloating = region === 'floating';
	const isMaximized = model.maximizedView === panel.selected;
	const canFloat = model.canFloat(panel.selected);
	const canSplit = panel.views.length > 1;

	entries.push({
		id: 'maximize',
		label: isMaximized ? 'Restore View' : 'Maximize View',
		shortcut: 'Mod+Alt+M',
		run: () => model.toggleMaximize(panel.selected)
	});

	entries.push({
		id: 'popout',
		label: 'Pop Out into Window',
		run: () => model.openPopout(panel.selected)
	});

	entries.push('separator');

	if (canSplit) {
		entries.push({
			id: 'split-right',
			label: 'Split Right',
			run: () => model.splitView(panel.selected, 'right')
		});
		entries.push({
			id: 'split-below',
			label: 'Split Below',
			run: () => model.splitView(panel.selected, 'bottom')
		});
	}

	entries.push({
		id: 'move',
		label: 'Move',
		items: [
			{
				id: 'move-to-stage',
				label: 'Move to Stage',
				run: () => model.moveToStage(panel.id)
			},
			{
				id: 'move-to-side',
				label: 'Move to Sidebar',
				run: () => model.moveToSide(panel.id)
			},
			{
				id: 'move-to-floating',
				label: 'Move to Floating',
				disabled: !canFloat,
				run: () => model.float(panel.id)
			}
		]
	});

	entries.push({
		id: isFloating ? 'dock' : 'float',
		label: isFloating ? 'Dock to Layout' : 'Float Panel',
		disabled: !isFloating && !canFloat,
		run: () => (isFloating ? model.dock(panel.id, 'stage') : model.float(panel.id))
	});

	entries.push({
		id: 'hide',
		label: 'Hide Panel',
		run: () => model.hide(panel.id)
	});

	entries.push('separator');

	entries.push({
		id: 'close',
		label: 'Close Tab',
		shortcut: 'Mod+Alt+W',
		run: () => void model.close(panel.selected)
	});

	if (panel.views.length > 1) {
		entries.push({
			id: 'close-others',
			label: 'Close Other Tabs',
			run: () => {
				for (const id of [...panel.views]) {
					if (id !== panel.selected) void model.close(id);
				}
			}
		});
	}

	return entries;
}
