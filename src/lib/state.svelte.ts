import type { Snippet } from 'svelte';
import type { Collector, FloatingDecl, LayoutDecl } from './declare';
import type { ViewTypeProps } from './types';
import type { WorkspaceModel } from './workspace-model.svelte';

export class SnippetSlot {
	value = $state.raw<Snippet | undefined>(undefined);
}

export class TypeSlot {
	value = $state.raw<ViewTypeProps | undefined>(undefined);
}

export class Declarations implements Collector {
	readonly layout: LayoutDecl[] = [];
	readonly floating: FloatingDecl[] = [];
	readonly types = new Map<string, TypeSlot>();
	readonly slots = {
		backdrop: new SnippetSlot(),
		stageBackdrop: new SnippetSlot(),
		stageEmpty: new SnippetSlot(),
		stageEmptyDefault: new SnippetSlot(),
		empty: new SnippetSlot(),
		chrome: new SnippetSlot()
	};

	readonly #model: WorkspaceModel;

	constructor(model: WorkspaceModel) {
		this.#model = model;
	}

	add(node: LayoutDecl): void {
		this.layout.push(node);
	}

	addFloating(node: FloatingDecl): void {
		this.floating.push(node);
	}

	type(id: string): TypeSlot {
		let slot = this.types.get(id);
		if (!slot) this.types.set(id, (slot = new TypeSlot()));
		return slot;
	}

	setType(id: string, registration: ViewTypeProps): void {
		this.type(id).value = registration;
		this.#model.registerType(registration);
	}

	removeType(id: string): void {
		this.type(id).value = undefined;
		this.#model.unregisterType(id);
	}
}
