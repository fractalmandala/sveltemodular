import { getContext } from 'svelte';
import type { Collector } from './declare';
import type { Declarations } from './state.svelte';
import type { ViewApi, WorkspaceModel } from './workspace-model.svelte';

export const DECLARATIONS = Symbol('modular.declarations');
export const COLLECTOR = Symbol('modular.collector');
export const WORKSPACE = Symbol('modular.workspace');
export const PROVIDER = Symbol('modular.provider');
export const VIEW_API = Symbol('modular.view');

export function declarations(component: string): Declarations {
	const found = getContext<Declarations | undefined>(DECLARATIONS);
	if (!found) throw Error(`sveltemodular: <${component}> must be used inside <Workspace>`);
	return found;
}

export function collector(component: string): Collector {
	const found = getContext<Collector | undefined>(COLLECTOR);
	if (!found) throw Error(`sveltemodular: <${component}> must be used inside <Workspace>`);
	return found;
}

export function workspaceModel(hook: string): WorkspaceModel {
	const found = getContext<WorkspaceModel | undefined>(WORKSPACE);
	if (!found)
		throw Error(`sveltemodular: ${hook}() must be used inside <Workspace> or <WorkspaceProvider>`);
	return found;
}

export function optionalWorkspaceModel(): WorkspaceModel | undefined {
	return getContext<WorkspaceModel | undefined>(WORKSPACE);
}

export function viewApi<P extends object>(hook: string): ViewApi<P> {
	const found = getContext<ViewApi<P> | undefined>(VIEW_API);
	if (!found) throw Error(`sveltemodular: ${hook}() must be used inside view content`);
	return found;
}

export function optionalViewApi<P extends object>(): ViewApi<P> | undefined {
	return getContext<ViewApi<P> | undefined>(VIEW_API);
}
