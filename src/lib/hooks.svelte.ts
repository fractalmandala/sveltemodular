import type { Params } from './document';
import { optionalViewApi, optionalWorkspaceModel, viewApi, workspaceModel } from './context';
import type { ViewApi, WorkspaceHandle } from './workspace-model.svelte';

export function useWorkspace(): WorkspaceHandle {
	return workspaceModel('useWorkspace');
}

export function useOptionalWorkspace(): WorkspaceHandle | null {
	return optionalWorkspaceModel() ?? null;
}

export function useWorkspaceState(): WorkspaceHandle {
	return workspaceModel('useWorkspaceState');
}

export function useWorkspaceSelector<T>(select: (state: WorkspaceHandle) => T): {
	readonly value: T;
} {
	const state = useWorkspaceState();
	const value = $derived(select(state));
	return {
		get value() {
			return value;
		}
	};
}

export function useView<P extends object = Params>(): ViewApi<P> {
	return viewApi<P>('useView');
}

export function useOptionalView<P extends object = Params>(): ViewApi<P> | undefined {
	return optionalViewApi<P>();
}

export function useViewTitle(title: () => string | null | undefined): void {
	const view = optionalViewApi();
	$effect(() => {
		const next = title();
		if (view && next) view.setTitle(next);
	});
}

export function useViewBadge(badge: () => string | number | boolean | null | undefined): void {
	const view = optionalViewApi();
	$effect(() => {
		if (!view) return;
		// No cleanup: the badge belongs to the view's runtime state, which is
		// dropped when the view closes. Clearing it here would fight the tab
		// that re-rendered because of it.
		view.setBadge(badge() ?? null);
	});
}

export function useCloseGuard(guard: () => boolean | Promise<boolean>): void {
	const view = optionalViewApi();
	$effect(() => view?.guardClose(() => guard()));
}
