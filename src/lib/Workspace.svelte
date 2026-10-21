<script lang="ts">
	import { getContext, mount, setContext, unmount, untrack } from 'svelte';
	import { COLLECTOR, DECLARATIONS, PROVIDER, WORKSPACE } from './context';
	import { MODEL, RENDER_OPTIONS, SLOTS, type RenderOptions } from './render-context';
	import { WorkspaceModel } from './workspace-model.svelte';
	import { Declarations } from './state.svelte';
	import { buildInitialLayout } from './declare';
	import { createDocument, emptyDocument, sanitize, type LayoutDocument } from './document';
	import type { WorkspaceProps } from './types';
	import { DEFAULT_KEYMAP, matchesCombo, type Command } from './types';
	import NodeView from './NodeView.svelte';
	import PanelView from './PanelView.svelte';
	import ViewContent from './ViewContent.svelte';
	import PopoutContent from './PopoutContent.svelte';
	import Menu from './Menu.svelte';

	let {
		children,
		// eslint-disable-next-line no-useless-assignment
		workspace = $bindable(null),
		class: className,
		...options
	}: WorkspaceProps = $props();

	const provided = getContext<WorkspaceModel | undefined>(PROVIDER);
	const model = provided ?? new WorkspaceModel();
	const decl = new Declarations(model);
	model.setKnownTypeProvider(() =>
		decl.types.size > 0 ? (t: string) => decl.types.has(t) : undefined
	);
	model.setEventHandler((event, payload) => {
		if (event === 'open') options.onOpen?.(payload as import('./types').ViewInfo);
		else if (event === 'close') options.onClose?.(payload as import('./types').ViewInfo);
		else if (event === 'focus') options.onFocus?.(payload as string | null);
		else if (event === 'popoutOpen') options.onPopoutOpen?.(payload as string);
		else if (event === 'popoutClose') options.onPopoutClose?.(payload as string);
	});

	setContext(DECLARATIONS, decl);
	setContext(COLLECTOR, decl);
	setContext(WORKSPACE, model);
	setContext(MODEL, model);
	setContext(SLOTS, decl);

	const renderOptions: RenderOptions = {
		get panelMenu() {
			return options.panelMenu ?? true;
		},
		get renderMenu() {
			return options.renderMenu;
		},
		get tabs() {
			return options.tabs;
		},
		get floatingEnabled() {
			return options.floating !== false;
		},
		get showSplitRatio() {
			return options.showSplitRatio ?? false;
		},
		get disableDragAndDrop() {
			return options.disableDragAndDrop ?? false;
		},
		get unmountInactive() {
			return options.unmountInactive ?? false;
		}
	};
	setContext(RENDER_OPTIONS, renderOptions);
	// Publish the model to the parent through the bindable prop.
	// eslint-disable-next-line no-useless-assignment
	workspace = model;

	$effect(() => {
		model.floatingLayer = typeof options.floating === 'string' ? options.floating : 'overlay';
	});

	const initial = (() => {
		if (options.document) return sanitize(options.document);
		if (
			options.storageKey &&
			typeof window !== 'undefined' &&
			typeof window.localStorage !== 'undefined'
		) {
			try {
				const raw = window.localStorage.getItem(`modular:${options.storageKey}`);
				if (raw) {
					const parsed = JSON.parse(raw) as LayoutDocument;
					if (options.version === undefined || parsed.version === options.version) {
						return parsed;
					}
				}
			} catch {
				// Fall through
			}
		}
		return null;
	})();

	let ready = $state(false);
	// A plain effect: pre-effects run before the template renders, so the
	// declaration components would not have registered their layout yet.
	$effect(() => {
		if (ready) return;
		ready = true;
		if (initial) {
			model.adopt(initial);
			return;
		}
		const declared = buildInitialLayout(decl.layout, decl.floating);
		if (declared.layout || declared.floating.length) {
			model.adopt(
				createDocument(declared.layout, {
					floating: declared.floating,
					version: options.version
				})
			);
		} else if (options.defaultLayout) {
			model.adopt(
				typeof options.defaultLayout === 'object' && 'schema' in options.defaultLayout
					? (options.defaultLayout as LayoutDocument)
					: createDocument(options.defaultLayout as never, { version: options.version })
			);
		} else {
			model.adopt(emptyDocument(options.version));
		}
	});

	let rootEl = $state<HTMLElement | null>(null);
	let hiddenMenuOpen = $state(false);
	let hiddenMenuPos = $state({ x: 0, y: 0 });

	const hiddenEntries = $derived(
		model.doc.hidden.map((hidden) => ({
			id: `restore-${hidden.panel.id}`,
			label: model.titleOf(hidden.panel.selected) || 'Hidden panel',
			run: () => {
				model.restore(hidden.panel.id);
				hiddenMenuOpen = false;
			}
		}))
	);

	let lastEmittedJson = '';
	let persistTimer: ReturnType<typeof setTimeout> | undefined;

	function schedulePersist(
		key: string | undefined,
		snapshot: LayoutDocument,
		revision: number
	): void {
		if (!key || typeof window === 'undefined' || !window.localStorage) return;
		const value = JSON.stringify(snapshot);
		if (persistTimer) clearTimeout(persistTimer);
		persistTimer = setTimeout(() => {
			persistTimer = undefined;
			if (revision !== model.revision) return;
			try {
				window.localStorage.setItem(`modular:${key}`, value);
			} catch {
				// storage full or blocked
			}
		}, 150);
	}

	$effect(() => {
		// The model reports every change through `revision`, so this effect never
		// has to walk the document to find out whether something moved.
		const revision = model.revision;
		const snapshot = untrack(() => model.getDocument());
		lastEmittedJson = JSON.stringify(snapshot);
		options.onDocumentChange?.(snapshot);
		schedulePersist(options.storageKey, snapshot, revision);
	});

	$effect(() => {
		return () => {
			if (persistTimer) {
				clearTimeout(persistTimer);
				persistTimer = undefined;
			}
		};
	});

	$effect(() => {
		const doc = options.document;
		if (!doc) return;
		if (JSON.stringify(doc) === lastEmittedJson) return;
		model.adopt(doc);
	});

	// ------------------------------------------------------------------ Popouts Sync
	const activeWindows = new Map<
		string,
		{ win: Window; mounted: Record<string, unknown>; onClose: () => void }
	>();

	// A popout window is its own Svelte root, so it needs the workspace context handed over.
	const popoutContext = new Map<unknown, unknown>([
		[MODEL, model],
		[SLOTS, decl],
		[RENDER_OPTIONS, renderOptions],
		[WORKSPACE, model],
		[DECLARATIONS, decl]
	]);

	$effect(() => {
		const currentPopouts = new Set(model.popouts);

		// Open windows for new popouts
		for (const viewId of currentPopouts) {
			if (!activeWindows.has(viewId) && typeof window !== 'undefined') {
				const title = model.titleOf(viewId);
				const popWin = window.open('', `modular_popout_${viewId}`, 'width=840,height=620');
				if (!popWin) {
					// Popup blocked: bring the view back to the workspace.
					model.closePopout(viewId);
					continue;
				}
				// Mirror stylesheet links and style tags
				for (const node of document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
					'link[rel~="stylesheet"], style'
				)) {
					const clone = node.cloneNode(true);
					if (node instanceof HTMLLinkElement && clone instanceof HTMLLinkElement) {
						clone.href = node.href;
					}
					popWin.document.head.appendChild(clone);
				}

				// Mount snippet/content
				const mounted = mount(PopoutContent, {
					target: popWin.document.body,
					props: {
						popout: popWin,
						title,
						viewId
					},
					context: popoutContext
				});

				const handleClose = () => {
					if (!activeWindows.has(viewId)) return;
					const entry = activeWindows.get(viewId);
					activeWindows.delete(viewId);
					if (entry?.mounted) unmount(entry.mounted);
					model.closePopout(viewId);
				};

				popWin.addEventListener('pagehide', handleClose);
				popWin.addEventListener('beforeunload', handleClose);
				activeWindows.set(viewId, { win: popWin, mounted, onClose: handleClose });
			}
		}

		// Close windows that were removed from popouts
		for (const [viewId, entry] of activeWindows) {
			if (!currentPopouts.has(viewId)) {
				activeWindows.delete(viewId);
				entry.win.removeEventListener('pagehide', entry.onClose);
				entry.win.removeEventListener('beforeunload', entry.onClose);
				if (entry.mounted) unmount(entry.mounted);
				if (!entry.win.closed) entry.win.close();
			}
		}
	});

	/** Give the workspace keyboard focus on click, so its shortcuts work right away. */
	function onPointerDown(event: PointerEvent) {
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
		rootEl?.focus({ preventScroll: true });
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.defaultPrevented) return;
		const keymap = { ...DEFAULT_KEYMAP, ...options.keymap };
		for (const [command, combo] of Object.entries(keymap) as [Command, string | null][]) {
			if (combo && matchesCombo(event, combo)) {
				event.preventDefault();
				model.run(command);
				return;
			}
		}
	}
</script>

<!-- A focusable region that owns the workspace shortcuts. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={rootEl}
	class="modular {className ?? ''}"
	data-modular=""
	data-theme={options.theme}
	style={options.tokens
		? Object.entries(options.tokens)
				.map(([k, v]) => `${k}:${v}`)
				.join(';')
		: undefined}
	role="region"
	aria-label={options.label ?? 'Workspace'}
	tabindex="-1"
	{onkeydown}
	onpointerdown={onPointerDown}
>
	<!-- Declarations collection -->
	{@render children?.()}

	{#if model.maximizedView}
		<!-- Maximized view overlay -->
		<div class="modular-maximized" role="region" aria-label="Maximized View">
			<div class="modular-maximized-bar">
				<span class="modular-maximized-title">
					{model.titleOf(model.maximizedView)}
				</span>
				<div class="modular-maximized-actions">
					<button
						type="button"
						class="modular-action-button"
						title="Restore layout (Esc / Shortcut)"
						onclick={() => model.toggleMaximize(model.maximizedView ?? undefined)}
					>
						Restore ❐
					</button>
				</div>
			</div>
			<div class="modular-maximized-body">
				<ViewContent viewId={model.maximizedView} />
			</div>
		</div>
	{:else if model.doc.root}
		<div class="modular-root">
			<NodeView node={model.doc.root} />
		</div>
	{:else if decl.slots.empty.value}
		<div class="modular-empty">
			{@render decl.slots.empty.value()}
		</div>
	{/if}

	{#if options.floating !== false && !model.maximizedView}
		{#each model.doc.floating as floating (floating.panel.id)}
			<div
				class="modular-floating"
				data-layer={floating.layer}
				style:left={`${floating.rect.x * 100}%`}
				style:top={`${floating.rect.y * 100}%`}
				style:width={`${floating.rect.w * 100}%`}
				style:height={`${floating.rect.h * 100}%`}
				style:z-index={floating.z}
			>
				<PanelView panel={floating.panel} region="floating" />
			</div>
		{/each}
	{/if}

	{#if decl.slots.chrome.value}
		<div class="modular-chrome">
			{@render decl.slots.chrome.value()}
		</div>
	{/if}

	{#if model.doc.hidden.length > 0}
		<div class="modular-hidden-tray">
			<button
				type="button"
				class="modular-hidden-button"
				aria-haspopup="menu"
				aria-expanded={hiddenMenuOpen}
				onclick={(event) => {
					const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
					hiddenMenuPos = { x: rect.left, y: rect.top - 4 };
					hiddenMenuOpen = !hiddenMenuOpen;
				}}
			>
				Hidden panels ({model.doc.hidden.length})
			</button>
		</div>
		{#if hiddenMenuOpen}
			<Menu
				entries={hiddenEntries}
				x={hiddenMenuPos.x}
				y={hiddenMenuPos.y}
				align="start"
				onclose={() => (hiddenMenuOpen = false)}
			/>
		{/if}
	{/if}
</div>
