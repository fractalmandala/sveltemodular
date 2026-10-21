import type { Command } from '../types';
import type { WorkspaceModel } from '../state/workspace-model.svelte';

/** Runs a command against the workspace. */
export function runCommand(model: WorkspaceModel, command: Command): void {
	switch (command) {
		case 'view.close': {
			if (model.focusedView) void model.close(model.focusedView);
			break;
		}
		case 'view.maximize': {
			if (model.focusedView) model.toggleMaximize(model.focusedView);
			break;
		}
		case 'tab.next':
		case 'tab.previous': {
			const panel = model.focusedPanel ? model.panel(model.focusedPanel) : null;
			if (panel && panel.views.length > 1) {
				const index = panel.views.indexOf(panel.selected);
				const delta = command === 'tab.next' ? 1 : -1;
				const next = panel.views[(index + delta + panel.views.length) % panel.views.length];
				model.select(next);
			}
			break;
		}
		case 'panel.next':
		case 'panel.previous': {
			const panels = model.panels();
			if (panels.length > 1) {
				const current = panels.findIndex((p) => p.id === model.focusedPanel);
				const delta = command === 'panel.next' ? 1 : -1;
				const next = panels[(current + delta + panels.length) % panels.length];
				if (next) model.focus(next.selected || next.id);
			}
			break;
		}
		case 'panel.float': {
			if (model.focusedPanel) model.toggleDock(model.focusedPanel);
			break;
		}
		case 'panel.hide': {
			if (model.focusedPanel) model.hide(model.focusedPanel);
			break;
		}
		case 'panel.splitRight': {
			if (model.focusedView) model.splitView(model.focusedView, 'right');
			break;
		}
		case 'panel.splitBelow': {
			if (model.focusedView) model.splitView(model.focusedView, 'bottom');
			break;
		}
		case 'view.moveToStage': {
			if (model.focusedPanel) model.moveToStage(model.focusedPanel);
			break;
		}
		case 'view.moveToFloating': {
			if (model.focusedPanel) model.float(model.focusedPanel);
			break;
		}
		case 'tab.closeOthers': {
			const panel = model.focusedPanel ? model.panel(model.focusedPanel) : null;
			if (!panel) break;
			for (const id of [...panel.views]) {
				if (id !== panel.selected) void model.close(id);
			}
			break;
		}
	}
}
