import type { Params } from './document';
import type { ViewInfo, ViewTypeProps } from './types';
import type { WorkspaceHandle, WorkspaceModel } from './workspace-model.svelte';

export class ViewApi<P extends object = Params> {
	readonly #ws: WorkspaceModel;
	readonly id: string;

	constructor(ws: WorkspaceModel, id: string) {
		this.#ws = ws;
		this.id = id;
	}

	get type(): string {
		return this.#ws.record(this.id)?.type ?? '';
	}

	get workspace(): WorkspaceHandle {
		return this.#ws;
	}

	get params(): P {
		return (this.#ws.record(this.id)?.params ?? {}) as P;
	}

	get title(): string {
		return this.#ws.titleOf(this.id);
	}

	get badge(): string | number | boolean | null {
		return this.#ws.runtime(this.id).badge;
	}

	get panelId(): string {
		return this.#ws.info(this.id)?.panelId ?? '';
	}

	get selected(): boolean {
		return this.#ws.info(this.id)?.selected ?? false;
	}

	get placement(): ViewInfo['placement'] {
		return this.#ws.placementOf(this.id);
	}

	get visible(): boolean {
		const info = this.#ws.info(this.id);
		return (info?.selected && info.placement !== 'hidden') ?? false;
	}

	get focused(): boolean {
		return this.#ws.focusedView === this.id;
	}

	get definition(): ViewTypeProps | undefined {
		return this.#ws.typeDef(this.type);
	}

	setTitle(title: string): void {
		this.#ws.setTitle(this.id, title);
	}

	setParams(patch: Partial<P>): void {
		this.#ws.setParams(this.id, patch as Params);
	}

	setBadge(badge: string | number | boolean | null): void {
		this.#ws.setBadge(this.id, badge);
	}

	focus(): void {
		this.#ws.focus(this.id);
	}

	close(options?: { force?: boolean }): Promise<boolean> {
		return this.#ws.close(this.id, options);
	}

	hide(): void {
		this.#ws.hide(this.id);
	}

	popout(): void {
		this.#ws.openPopout(this.id);
	}

	maximize(): void {
		this.#ws.toggleMaximize(this.id);
	}

	guardClose(guard: () => boolean | Promise<boolean>): () => void {
		return this.#ws.addGuard(this.id, guard);
	}
}
