import { getContext } from 'svelte';
import type { Declarations } from '../state/state.svelte';
import type { WorkspaceModel } from '../state/workspace-model.svelte';
import type { MenuEntry, PanelMenuContext } from '../types';

export const MODEL = Symbol('modular.model');
export const SLOTS = Symbol('modular.slots');
export const RENDER_OPTIONS = Symbol('modular.render-options');

export interface RenderOptions {
	panelMenu: WorkspaceRenderMenu;
	renderMenu?: (request: import('../types').MenuRequest) => void;
	tabs?: { fill?: boolean; inset?: number };
	floatingEnabled: boolean;
	showSplitRatio?: boolean;
	disableDragAndDrop?: boolean;
	unmountInactive?: boolean;
}

export type WorkspaceRenderMenu =
	boolean | ((entries: MenuEntry[], context: PanelMenuContext) => MenuEntry[]);

export function modelContext(component: string): WorkspaceModel {
	const found = getContext<WorkspaceModel | undefined>(MODEL);
	if (!found) throw Error(`sveltemodular: <${component}> must be rendered inside <Workspace>`);
	return found;
}

export function slotsContext(component: string): Declarations['slots'] {
	const found = getContext<Declarations | undefined>(SLOTS);
	if (!found) throw Error(`sveltemodular: <${component}> must be rendered inside <Workspace>`);
	return found.slots;
}

export function declarationsContext(component: string): Declarations {
	const found = getContext<Declarations | undefined>(SLOTS);
	if (!found) throw Error(`sveltemodular: <${component}> must be rendered inside <Workspace>`);
	return found;
}

export function renderOptionsContext(component: string): RenderOptions {
	const found = getContext<RenderOptions | undefined>(RENDER_OPTIONS);
	if (!found) throw Error(`sveltemodular: <${component}> must be rendered inside <Workspace>`);
	return found;
}
