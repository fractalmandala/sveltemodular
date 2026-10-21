import {
	cloneDocument,
	dockedPanels,
	emptyDocument,
	findNode,
	normalize,
	panelOf,
	parentOf,
	removeNode,
	sanitize,
	stageOf,
	uid,
	type FloatingLayer,
	type LayoutDocument,
	type PanelNode,
	type Params,
	type Rect,
	type RestoreTarget,
	type ViewRecord
} from './document';
import {
	allowsRegion,
	buildViewIndex,
	floatingRectOf,
	insertBeside,
	insertBesideStage,
	newPanel,
	placeNewView,
	raiseFloatingIn,
	resolvePlacement,
	restoreDocked,
	setFloatingRectOf,
	type ViewIndexEntry
} from './layout-ops';
import type {
	Command,
	MenuEntry,
	PanelMenuContext,
	OpenOptions,
	Placement,
	PlacementRegion,
	ViewInfo,
	ViewTypeProps
} from './types';
import { ViewApi } from './view-api.svelte';
import { buildPanelMenu, cleanMenuSeparators } from './menu';
import { runCommand } from './commands';

export interface WorkspaceSnapshot {
	document: LayoutDocument;
	focusedPanel: string | null;
	focusedView: string | null;
	views: ViewInfo[];
	hidden: { panelId: string; views: ViewInfo[] }[];
	maximizedView: string | null;
	popouts: string[];
}

interface ViewRuntime {
	title?: string;
	badge: string | number | boolean | null;
	guards: Set<() => boolean | Promise<boolean>>;
}

interface PopoutOrigin {
	panelId: string;
	index: number;
}

/**
 * Placeholder for ids that have no runtime record.
 *
 * Records are created up front (when a view is opened or adopted), never while
 * rendering: a state proxy created during a render does not notify `{#if}`
 * conditions, so a lazily created record would silently stop updating tabs.
 */
const EMPTY_RUNTIME: ViewRuntime = $state({
	title: undefined,
	badge: null,
	guards: new Set()
});

export type WorkspaceEvent = 'change' | 'open' | 'close' | 'focus' | 'popoutOpen' | 'popoutClose';

export interface WorkspaceModelOptions {
	isKnownType?: (type: string) => boolean;
	onEvent?: (event: WorkspaceEvent, payload: unknown) => void;
}

export class WorkspaceModel {
	doc = $state<LayoutDocument>(emptyDocument());
	focusedPanel = $state<string | null>(null);
	focusedView = $state<string | null>(null);
	maximizedView = $state<string | null>(null);
	popouts = $state<string[]>([]);
	/** Bumped on every model-reported change, so views can watch a single scalar. */
	revision = $state(0);
	/** Layer used by floating panels that don't ask for one. */
	floatingLayer: FloatingLayer = 'overlay';

	readonly #types = new Map<string, ViewTypeProps>();
	readonly #runtime = new Map<string, ViewRuntime>();
	readonly #apis = new Map<string, ViewApi>();
	readonly #listeners = new Set<() => void>();
	readonly #popoutOrigins = new Map<string, PopoutOrigin>();
	#index = new Map<string, ViewIndexEntry>();
	#panelRegions = new Map<string, PlacementRegion>();
	#knownTypeProvider?: () => ((type: string) => boolean) | undefined;
	#eventHandler?: WorkspaceModelOptions['onEvent'];

	constructor(options?: WorkspaceModelOptions) {
		if (options?.isKnownType) {
			const fn = options.isKnownType;
			this.#knownTypeProvider = () => fn;
		}
		this.#eventHandler = options?.onEvent;
	}

	setKnownTypeProvider(
		provider: (() => ((type: string) => boolean) | undefined) | undefined
	): void {
		this.#knownTypeProvider = provider;
	}

	setEventHandler(handler: WorkspaceModelOptions['onEvent']): void {
		this.#eventHandler = handler;
	}

	registerType(definition: ViewTypeProps): void {
		this.#types.set(definition.id, definition);
	}

	unregisterType(id: string): void {
		this.#types.delete(id);
	}

	typeDef(id: string): ViewTypeProps | undefined {
		return this.#types.get(id);
	}

	record(viewId: string): ViewRecord | undefined {
		return this.doc.views[viewId];
	}

	/** Runtime state of a view. Never creates a record: use `#ensureRuntime` for that. */
	runtime(viewId: string): ViewRuntime {
		return this.#runtime.get(viewId) ?? EMPTY_RUNTIME;
	}

	#ensureRuntime(viewId: string): ViewRuntime {
		const existing = this.#runtime.get(viewId);
		if (existing) return existing;
		const created: ViewRuntime = $state({ title: undefined, badge: null, guards: new Set() });
		this.#runtime.set(viewId, created);
		return created;
	}

	api<P extends object = Params>(viewId: string): ViewApi<P> {
		const existing = this.#apis.get(viewId);
		if (existing) return existing as ViewApi<P>;
		const created = new ViewApi(this, viewId);
		this.#apis.set(viewId, created);
		return created as unknown as ViewApi<P>;
	}

	titleOf(viewId: string): string {
		const run = this.#runtime.get(viewId);
		if (run?.title !== undefined) return run.title;
		const rec = this.record(viewId);
		if (rec?.title !== undefined) return rec.title;
		const def = rec ? this.typeDef(rec.type) : undefined;
		if (typeof def?.title === 'function') {
			try {
				return def.title(this.api(viewId));
			} catch {
				return rec?.type ?? '';
			}
		}
		return def?.title ?? rec?.type ?? '';
	}

	placementOf(viewId: string): ViewInfo['placement'] {
		if (this.popouts.includes(viewId)) return 'popout';
		return this.#index.get(viewId)?.placement ?? 'docked';
	}

	info(viewId: string): ViewInfo | null {
		const rec = this.record(viewId);
		if (!rec) return null;
		const entry = this.#index.get(viewId);
		return {
			id: viewId,
			type: rec.type,
			params: (rec.params ?? {}) as Params,
			title: this.titleOf(viewId),
			panelId: entry?.panelId ?? '',
			placement: this.placementOf(viewId),
			selected: entry?.selected ?? false
		};
	}

	views(filter?: { type?: string }): ViewInfo[] {
		const out: ViewInfo[] = [];
		for (const id of Object.keys(this.doc.views)) {
			const info = this.info(id);
			if (!info) continue;
			if (filter?.type && info.type !== filter.type) continue;
			out.push(info);
		}
		return out;
	}

	view(viewId: string): ViewApi | null {
		return this.record(viewId) ? this.api(viewId) : null;
	}

	snapshot(): WorkspaceSnapshot {
		return {
			document: this.getDocument(),
			focusedPanel: this.focusedPanel,
			focusedView: this.focusedView,
			views: this.views(),
			hidden: this.doc.hidden.map((h) => ({
				panelId: h.panel.id,
				views: h.panel.views.map((v) => this.info(v)!).filter(Boolean)
			})),
			maximizedView: this.maximizedView,
			popouts: [...this.popouts]
		};
	}

	adopt(doc: LayoutDocument): void {
		const isKnown = this.#knownTypeProvider?.();
		this.doc = sanitize(doc, isKnown);
		this.popouts = [...(this.doc.popouts ?? [])];
		// Runtime state has to exist before the first render reads it: a state
		// proxy created while rendering does not propagate to block conditions.
		for (const id of Object.keys(this.doc.views)) this.#ensureRuntime(id);
		// A popped-out view lives in its window, not in a panel.
		for (const id of [...this.popouts]) this.#detachViewForPopout(id);
		this.#afterStructuralChange();
		this.#changed();
	}

	getDocument(): LayoutDocument {
		const clean = cloneDocument(this.doc);
		clean.popouts = [...this.popouts];
		return clean;
	}

	setDocument(doc: LayoutDocument): void {
		this.adopt(doc);
	}

	reset(): void {
		this.doc = emptyDocument(this.doc.version);
		this.focusedPanel = null;
		this.focusedView = null;
		this.maximizedView = null;
		this.popouts = [];
		this.#rebuildIndex();
		this.#changed();
	}

	open(type: string, options?: OpenOptions): ViewInfo {
		const def = this.typeDef(type);
		const reuse = options?.reuse ?? (def?.singleton ? 'type' : 'none');
		if (reuse !== 'none') {
			const existing = this.#findReusableView(type, reuse, options?.params);
			if (existing) {
				if (options?.focus !== false) this.reveal(existing.id);
				return existing;
			}
		}

		const id = options?.id ?? uid('view');
		this.doc.views[id] = {
			type,
			params: options?.params as Params | undefined,
			title: options?.title
		};
		this.#ensureRuntime(id);

		const placement = this.#resolvePlacement(type, options?.placement ?? def?.placement ?? 'stage');
		const panel = this.#placeNewView(id, placement);
		this.focusedPanel = panel.id;
		this.focusedView = id;
		panel.selected = id;

		this.#afterStructuralChange();
		const info = this.info(id)!;
		this.#emit('open', info);
		this.#changed();
		return info;
	}

	async close(viewId: string, options?: { force?: boolean }): Promise<boolean> {
		if (!this.doc.views[viewId]) return false;
		if (!options?.force) {
			const run = this.#runtime.get(viewId);
			if (run) {
				for (const guard of run.guards) {
					try {
						const allow = await guard();
						if (allow === false) return false;
					} catch {
						return false;
					}
				}
			}
		}

		if (this.popouts.includes(viewId)) {
			this.#endPopout(viewId, false);
		}
		if (this.maximizedView === viewId) {
			this.maximizedView = null;
		}

		const info = this.info(viewId);
		const panel = panelOf(this.doc, viewId);
		if (panel) {
			const idx = panel.views.indexOf(viewId);
			if (idx >= 0) panel.views.splice(idx, 1);
			if (panel.selected === viewId) {
				panel.selected = panel.views[Math.max(0, idx - 1)] ?? panel.views[0] ?? '';
			}
			if (panel.views.length === 0) {
				this.#detachPanel(panel.id);
			}
		}

		delete this.doc.views[viewId];
		this.#runtime.delete(viewId);
		this.#apis.delete(viewId);

		this.#afterStructuralChange();
		if (info) this.#emit('close', info);
		this.#changed();
		return true;
	}

	focus(id: string): void {
		if (this.doc.views[id]) {
			this.focusedView = id;
			const panel = panelOf(this.doc, id);
			if (panel) {
				this.focusedPanel = panel.id;
				panel.selected = id;
				this.#rebuildIndex();
			}
			this.#emit('focus', id);
		} else {
			const node = findNode(this.doc.root, id);
			if (node?.kind === 'panel') {
				this.focusedPanel = node.id;
				this.focusedView = node.selected || null;
				this.#emit('focus', this.focusedView);
			}
		}
	}

	select(viewId: string): void {
		const panel = panelOf(this.doc, viewId);
		if (panel && panel.views.includes(viewId)) {
			panel.selected = viewId;
			this.focus(viewId);
			this.#changed();
		}
	}

	setParams(viewId: string, patch: Params): void {
		const rec = this.doc.views[viewId];
		if (!rec) return;
		const current = (rec.params ?? {}) as Params;
		const unchanged = Object.keys(patch).every((key) => current[key] === patch[key]);
		if (unchanged) return;
		rec.params = { ...current, ...patch };
		this.#changed();
	}

	/** Overrides the title of a view. Runtime state, not part of the document. */
	setTitle(viewId: string, title: string): void {
		const run = this.#ensureRuntime(viewId);
		if (run.title === title) return;
		run.title = title;
	}

	/** Sets the badge of a view. Runtime state, not part of the document. */
	setBadge(viewId: string, badge: string | number | boolean | null): void {
		const run = this.#ensureRuntime(viewId);
		if (run.badge === badge) return;
		run.badge = badge;
	}

	addGuard(viewId: string, guard: () => boolean | Promise<boolean>): () => void {
		const run = this.#ensureRuntime(viewId);
		run.guards.add(guard);
		return () => run.guards.delete(guard);
	}

	hide(panelOrViewId: string): void {
		const panel = this.#resolvePanel(panelOrViewId);
		if (!panel || this.doc.hidden.some((h) => h.panel.id === panel.id)) return;
		const floating = this.doc.floating.find((f) => f.panel.id === panel.id);
		let restore: RestoreTarget;
		if (floating) {
			restore = { kind: 'floating', rect: { ...floating.rect }, layer: floating.layer };
		} else {
			const loc = parentOf(this.doc.root, panel.id);
			const region = this.#panelRegions.get(panel.id) ?? 'side';
			restore =
				region === 'stage'
					? { kind: 'stage', parent: loc?.parent.id, index: loc?.index }
					: {
							kind: 'docked',
							parent: loc?.parent.id,
							index: loc?.index,
							beside: loc?.parent.id ?? '',
							edge: 'right',
							share: 0.3
						};
		}
		this.#detachPanel(panel.id);
		this.doc.hidden.push({ panel, restore });
		this.#afterStructuralChange();
		this.#changed();
	}

	restore(panelId: string): void {
		const index = this.doc.hidden.findIndex((h) => h.panel.id === panelId);
		if (index < 0) return;
		const [hidden] = this.doc.hidden.splice(index, 1);
		const panel = hidden.panel;
		if (hidden.restore.kind === 'floating') {
			const z = Math.max(0, ...this.doc.floating.map((f) => f.z)) + 1;
			this.doc.floating.push({
				panel,
				rect: hidden.restore.rect,
				z,
				layer: hidden.restore.layer
			});
		} else {
			this.#restoreDocked(panel, hidden.restore);
		}
		this.focusedPanel = hidden.panel.id;
		this.focusedView = hidden.panel.selected;
		this.#emit('focus', hidden.panel.selected);
		this.#afterStructuralChange();
		this.#changed();
	}

	float(panelOrViewId: string, rect?: Rect, layer?: FloatingLayer): void {
		const panel = this.#resolvePanel(panelOrViewId);
		if (!panel || this.doc.floating.some((f) => f.panel.id === panel.id)) return;
		if (!this.canFloat(panel.selected)) return;
		this.#detachPanel(panel.id);
		const z = Math.max(0, ...this.doc.floating.map((f) => f.z)) + 1;
		this.doc.floating.push({
			panel,
			rect: rect ?? { x: 0.15, y: 0.12, w: 0.45, h: 0.5 },
			z,
			layer: layer ?? this.floatingLayer
		});
		this.focusedPanel = panel.id;
		this.focusedView = panel.selected;
		this.#afterStructuralChange();
		this.#changed();
	}

	dock(
		panelOrViewId: string,
		target:
			| { beside: string; edge: 'left' | 'right' | 'top' | 'bottom'; share?: number }
			| { into: string; index?: number }
			| 'stage'
	): void {
		const panel = this.#resolvePanel(panelOrViewId);
		if (!panel) return;
		this.#detachPanel(panel.id);

		if (target === 'stage') {
			this.#insertBesideStage(panel, 'right', 0.3);
		} else if ('into' in target) {
			const dest = (findNode(this.doc.root, target.into) ??
				this.doc.floating.find((f) => f.panel.id === target.into)?.panel) as PanelNode | null;
			if (dest?.kind === 'panel') {
				const views = [...panel.views];
				for (const id of views) {
					if (!dest.views.includes(id)) dest.views.push(id);
				}
				dest.selected = panel.selected || dest.selected;
			} else {
				this.#insertBesideStage(panel, 'right', 0.3);
			}
		} else {
			this.#insertBeside(panel, target.beside, target.edge, target.share ?? 0.3);
		}
		this.focusedPanel = panel.id;
		this.focusedView = panel.selected;
		this.#afterStructuralChange();
		this.#changed();
	}

	toggleDock(panelOrViewId: string): void {
		const panel = this.#resolvePanel(panelOrViewId);
		if (!panel) return;
		if (this.doc.floating.some((f) => f.panel.id === panel.id)) {
			this.dock(panel.id, 'stage');
		} else if (this.doc.hidden.some((h) => h.panel.id === panel.id)) {
			this.restore(panel.id);
		} else {
			this.float(panel.id);
		}
	}

	// ------------------------------------------------------------------ Enhanced features

	moveView(
		viewId: string,
		target:
			| { into: string; index?: number }
			| { beside: string; edge: 'left' | 'right' | 'top' | 'bottom'; share?: number }
	): boolean {
		const sourcePanel = panelOf(this.doc, viewId);
		if (!sourcePanel) return false;

		const region =
			'into' in target ? this.#regionForPanel(target.into) : this.#regionForPanel(target.beside);
		if (!this.#allows(this.record(viewId)?.type ?? '', region)) return false;

		if ('into' in target) {
			if (sourcePanel.id === target.into) {
				const idx = sourcePanel.views.indexOf(viewId);
				if (idx >= 0) {
					sourcePanel.views.splice(idx, 1);
					let targetIndex = target.index ?? sourcePanel.views.length;
					if (targetIndex > sourcePanel.views.length) targetIndex = sourcePanel.views.length;
					sourcePanel.views.splice(targetIndex, 0, viewId);
					sourcePanel.selected = viewId;
				}
			} else {
				const destPanel = this.#resolvePanel(target.into);
				if (destPanel) {
					const idx = sourcePanel.views.indexOf(viewId);
					if (idx >= 0) sourcePanel.views.splice(idx, 1);
					if (sourcePanel.selected === viewId) {
						sourcePanel.selected = sourcePanel.views[0] ?? '';
					}

					let targetIndex = target.index ?? destPanel.views.length;
					if (targetIndex > destPanel.views.length) targetIndex = destPanel.views.length;
					if (!destPanel.views.includes(viewId)) {
						destPanel.views.splice(targetIndex, 0, viewId);
					}
					destPanel.selected = viewId;

					if (sourcePanel.views.length === 0) {
						this.#detachPanel(sourcePanel.id);
					}
				}
			}
		} else {
			const destNode = findNode(this.doc.root, target.beside);
			if (!destNode) return false;

			if (sourcePanel.views.length === 1) {
				this.dock(sourcePanel.id, target);
				return true;
			}

			const idx = sourcePanel.views.indexOf(viewId);
			if (idx >= 0) sourcePanel.views.splice(idx, 1);
			if (sourcePanel.selected === viewId) {
				sourcePanel.selected = sourcePanel.views[0] ?? '';
			}

			const newPanel: PanelNode = {
				kind: 'panel',
				id: uid('panel'),
				views: [viewId],
				selected: viewId
			};

			this.#insertBeside(newPanel, target.beside, target.edge, target.share ?? 0.35);
		}

		this.focusedView = viewId;
		this.#afterStructuralChange();
		this.#changed();
		return true;
	}

	/** Moves the view out of its panel into a new panel beside it. */
	splitView(viewId: string, edge: 'left' | 'right' | 'top' | 'bottom'): void {
		const sourcePanel = panelOf(this.doc, viewId);
		if (!sourcePanel || sourcePanel.views.length < 2) return;
		const idx = sourcePanel.views.indexOf(viewId);
		if (idx < 0) return;

		sourcePanel.views.splice(idx, 1);
		if (sourcePanel.selected === viewId) {
			sourcePanel.selected = sourcePanel.views[0] ?? '';
		}

		const newPanel: PanelNode = {
			kind: 'panel',
			id: uid('panel'),
			views: [viewId],
			selected: viewId
		};
		this.#insertBeside(newPanel, sourcePanel.id, edge, 0.35);
		this.focusedPanel = newPanel.id;
		this.focusedView = viewId;
		this.#afterStructuralChange();
		this.#changed();
	}

	/** Moves a panel into the stage. */
	moveToStage(panelOrViewId: string): void {
		const panel = this.#resolvePanel(panelOrViewId);
		const stage = stageOf(this.doc.root);
		if (!panel || !stage) return;
		this.#detachPanel(panel.id);
		const child = stage.child;
		if (child?.kind === 'panel') {
			for (const id of panel.views) {
				if (!child.views.includes(id)) child.views.push(id);
			}
			child.selected = panel.selected || child.selected;
		} else {
			this.#insertBesideStage(panel, 'right', 0.5);
		}
		this.focusedPanel = panel.id;
		this.focusedView = panel.selected;
		this.#afterStructuralChange();
		this.#changed();
	}

	/** Moves a panel next to the stage, outside of it. */
	moveToSide(panelOrViewId: string): void {
		const panel = this.#resolvePanel(panelOrViewId);
		const stage = stageOf(this.doc.root);
		if (!panel || !stage) return;
		this.#detachPanel(panel.id);
		this.#insertBeside(panel, stage.id, 'right', 0.3);
		this.focusedPanel = panel.id;
		this.focusedView = panel.selected;
		this.#afterStructuralChange();
		this.#changed();
	}

	toggleMaximize(viewId?: string): void {
		const target = viewId ?? this.focusedView;
		if (!target) return;
		this.maximizedView = this.maximizedView === target ? null : target;
		this.#changed();
	}

	openPopout(viewId: string): void {
		if (this.popouts.includes(viewId)) return;
		this.#detachViewForPopout(viewId);
		this.popouts.push(viewId);
		this.#afterStructuralChange();
		this.#emit('popoutOpen', viewId);
		this.#changed();
	}

	closePopout(viewId: string): void {
		if (!this.#endPopout(viewId, true)) return;
		this.#afterStructuralChange();
		this.#changed();
	}

	closeAllPopouts(): void {
		const all = [...this.popouts];
		for (const id of all) {
			this.closePopout(id);
		}
	}

	run(command: Command): void {
		runCommand(this, command);
	}

	menuEntries(
		panel: PanelNode,
		region: 'stage' | 'side' | 'floating',
		filter?: boolean | ((entries: MenuEntry[], context: PanelMenuContext) => MenuEntry[])
	): MenuEntry[] {
		const entries = buildPanelMenu(this, panel, region);
		if (typeof filter === 'function') {
			return filter(entries, {
				panelId: panel.id,
				view: this.api(panel.selected),
				region
			});
		}
		return cleanMenuSeparators(entries);
	}

	commit(): void {
		this.#changed();
	}

	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	getSnapshot(): WorkspaceSnapshot {
		return this.snapshot();
	}

	on(listener: () => void): () => void {
		return this.subscribe(listener);
	}

	reveal(viewId: string): void {
		const hidden = this.doc.hidden.find((h) => h.panel.views.includes(viewId));
		if (hidden) this.restore(hidden.panel.id);
		this.focus(viewId);
	}

	/** Id of the stage node, if the workspace has one. */
	stageId(): string | null {
		return stageOf(this.doc.root)?.id ?? null;
	}

	/** May a view of this type be floated? */
	canFloat(viewId: string): boolean {
		return this.#allows(this.record(viewId)?.type ?? '', 'floating');
	}

	/** The panel with this id, wherever it lives (docked, floating or hidden). */
	panel(panelOrViewId: string): PanelNode | null {
		return this.#resolvePanel(panelOrViewId);
	}

	/** Every panel of the workspace, docked and floating. */
	panels(): PanelNode[] {
		return [...dockedPanels(this.doc.root), ...this.doc.floating.map((f) => f.panel)];
	}

	/** Which region a panel lives in. */
	regionOf(panelId: string): PlacementRegion {
		return this.#regionForPanel(panelId);
	}

	/** Current rectangle of a floating panel, in fractions of the workspace. */
	floatingRect(panelId: string): Rect | null {
		return floatingRectOf(this.doc, panelId);
	}

	/**
	 * Moves or resizes a floating panel. Pass `commit: false` while dragging and
	 * call `commit()` once at the end, so a drag does not emit a change per frame.
	 */
	setFloatingRect(panelId: string, rect: Partial<Rect>, options?: { commit?: boolean }): void {
		if (!setFloatingRectOf(this.doc, panelId, rect)) return;
		if (options?.commit !== false) this.#changed();
	}

	/** Brings a floating panel to the front. */
	raiseFloating(panelId: string): void {
		if (!raiseFloatingIn(this.doc, panelId)) return;
		this.#changed();
	}

	/** May a view of this type be dropped into this region? */
	canPlace(viewId: string, region: PlacementRegion): boolean {
		return this.#allows(this.record(viewId)?.type ?? '', region);
	}

	// ------------------------------------------------------------------ Internals

	#placeNewView(viewId: string, placement: Placement): PanelNode {
		return placeNewView(this.doc, viewId, placement, {
			floatingLayer: this.floatingLayer,
			resolvePanel: (id) => this.#resolvePanel(id)
		});
	}

	#findReusableView(
		type: string,
		strategy: NonNullable<OpenOptions['reuse']>,
		params?: object
	): ViewInfo | null {
		const existing = this.views({ type });
		if (existing.length === 0) return null;
		if (strategy === 'type') return existing[0];
		if (strategy === 'params') {
			return existing.find((v) => shallowEqual(v.params, (params ?? {}) as Params)) ?? null;
		}
		if (typeof strategy === 'function') {
			return existing.find((v) => strategy(v)) ?? null;
		}
		return null;
	}

	#allows(type: string, region: PlacementRegion): boolean {
		return allowsRegion(this.typeDef(type), region);
	}

	#regionForPanel(id: string): PlacementRegion {
		const direct = this.#panelRegions.get(id);
		if (direct) return direct;
		const entry = this.#index.get(id);
		if (entry) return this.#panelRegions.get(entry.panelId) ?? 'side';
		return 'side';
	}

	#resolvePlacement(type: string, requested: Placement): Placement {
		return resolvePlacement(this.typeDef(type), requested, (id) => this.#regionForPanel(id));
	}

	#insertBeside(
		panel: PanelNode,
		besideId: string,
		edge: 'left' | 'right' | 'top' | 'bottom',
		share: number
	): void {
		insertBeside(this.doc, panel, besideId, edge, share);
	}

	#insertBesideStage(
		panel: PanelNode,
		edge: 'left' | 'right' | 'top' | 'bottom',
		share: number
	): void {
		insertBesideStage(this.doc, panel, edge, share);
	}

	#restoreDocked(panel: PanelNode, target: RestoreTarget): void {
		restoreDocked(this.doc, panel, target);
	}

	#resolvePanel(panelOrViewId: string): PanelNode | null {
		const node = findNode(this.doc.root, panelOrViewId);
		if (node?.kind === 'panel') return node;
		const floating = this.doc.floating.find((f) => f.panel.id === panelOrViewId);
		if (floating) return floating.panel;
		const hidden = this.doc.hidden.find((h) => h.panel.id === panelOrViewId);
		if (hidden) return hidden.panel;
		return panelOf(this.doc, panelOrViewId);
	}

	#detachPanel(panelId: string): PanelNode | null {
		const floatingIndex = this.doc.floating.findIndex((f) => f.panel.id === panelId);
		if (floatingIndex >= 0) return this.doc.floating.splice(floatingIndex, 1)[0].panel;
		const hiddenIndex = this.doc.hidden.findIndex((h) => h.panel.id === panelId);
		if (hiddenIndex >= 0) return this.doc.hidden.splice(hiddenIndex, 1)[0].panel;
		const node = findNode(this.doc.root, panelId);
		if (node?.kind === 'panel') {
			this.doc.root = removeNode(this.doc.root, panelId);
			return node;
		}
		return null;
	}

	#detachViewForPopout(viewId: string): void {
		const panel = panelOf(this.doc, viewId);
		if (!panel) return;
		const index = panel.views.indexOf(viewId);
		if (index < 0) return;
		this.#popoutOrigins.set(viewId, { panelId: panel.id, index });
		panel.views.splice(index, 1);
		if (panel.selected === viewId) {
			panel.selected = panel.views[Math.max(0, index - 1)] ?? panel.views[0] ?? '';
		}
		if (panel.views.length === 0) this.#detachPanel(panel.id);
	}

	#endPopout(viewId: string, redock: boolean): boolean {
		const index = this.popouts.indexOf(viewId);
		if (index < 0) return false;
		this.popouts.splice(index, 1);
		if (redock) this.#redockPopout(viewId);
		else this.#popoutOrigins.delete(viewId);
		this.#emit('popoutClose', viewId);
		return true;
	}

	#redockPopout(viewId: string): void {
		const origin = this.#popoutOrigins.get(viewId);
		this.#popoutOrigins.delete(viewId);
		if (!origin) return;
		const panel = this.#resolvePanel(origin.panelId);
		if (panel && !panel.views.includes(viewId)) {
			const index = Math.min(origin.index, panel.views.length);
			panel.views.splice(index, 0, viewId);
			panel.selected = viewId;
			this.focusedPanel = panel.id;
		} else {
			const redocked = newPanel(viewId);
			this.#insertBesideStage(redocked, 'right', 0.3);
			this.focusedPanel = redocked.id;
		}
		this.focusedView = viewId;
	}

	#rebuildIndex(): void {
		const { views, regions } = buildViewIndex(this.doc);
		this.#index = views;
		this.#panelRegions = regions;
	}

	#afterStructuralChange(): void {
		// Keep the document's popout list in sync so sanitize keeps those views alive.
		this.doc.popouts = [...this.popouts];
		this.doc = normalize(this.doc);
		this.#rebuildIndex();
		const panels = [...dockedPanels(this.doc.root), ...this.doc.floating.map((f) => f.panel)];
		if (this.focusedPanel && !panels.some((p) => p.id === this.focusedPanel)) {
			const first = panels[0];
			this.focusedPanel = first?.id ?? null;
			this.focusedView = first?.selected ?? null;
			if (first) this.#emit('focus', first.selected);
		} else if (this.focusedView && !this.doc.views[this.focusedView]) {
			const panel = panels.find((p) => p.id === this.focusedPanel);
			this.focusedView = panel?.selected ?? null;
		}
	}

	#changed(): void {
		this.revision += 1;
		this.#emit('change', this.doc);
		this.#notify();
	}

	#notify(): void {
		for (const listener of this.#listeners) {
			try {
				listener();
			} catch {
				// listeners shouldn't crash model
			}
		}
	}

	#emit(event: WorkspaceEvent, payload: unknown): void {
		this.#eventHandler?.(event, payload);
	}
}

export type WorkspaceHandle = WorkspaceModel;

export { ViewApi } from './view-api.svelte';

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) return false;
	return aKeys.every((key) => a[key] === b[key]);
}
