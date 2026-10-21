<script lang="ts">
	import type { PanelNode } from '../utils/document';
	import { modelContext, renderOptionsContext } from '../utils/render-context';
	import type { MenuEntry, MenuRequest, DropZone } from '../types';
	import Menu from './Menu.svelte';
	import ViewContent from './ViewContent.svelte';
	import MaximizeIcon from '../icons/maximize.svelte';
	import MoreIcon from '../icons/more.svelte';
	import NewWindowIcon from '../icons/newWindow.svelte';
	import CloseIcon from '../icons/close.svelte'

	let { panel, region }: { panel: PanelNode; region: 'docked' | 'floating' | 'stage' } = $props();

	const model = modelContext('PanelView');
	const options = renderOptionsContext('PanelView');

	let menuOpen = $state(false);
	let menuPos = $state({ x: 0, y: 0, align: 'end' as 'start' | 'end' });
	let menuEntries = $state<MenuEntry[]>([]);
	let customRequest = $state<MenuRequest | null>(null);

	// Drag & Drop State
	let hoverDropZone = $state<DropZone | null>(null);
	let isDraggingOver = $state(false);
	let panelEl = $state<HTMLElement | null>(null);

	const focused = $derived(model.focusedPanel === panel.id);
	const isMaximized = $derived(model.maximizedView === panel.selected);

	function tabbarVisible(): boolean {
		const selected = model.api(panel.selected);
		const mode = selected.definition?.tabbar ?? 'always';
		if (mode === 'never') return false;
		if (mode === 'auto') return panel.views.length > 1;
		return true;
	}

	function openMenu(event: MouseEvent) {
		const entries = model.menuEntries(
			panel,
			region === 'docked' ? (isInStage() ? 'stage' : 'side') : 'floating',
			options.panelMenu
		);
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		if (options.renderMenu) {
			customRequest = {
				entries,
				x: rect.right,
				y: rect.bottom,
				align: 'end',
				anchor: event.currentTarget as HTMLElement,
				panelId: panel.id,
				close: () => {
					customRequest = null;
				}
			};
			options.renderMenu(customRequest);
			return;
		}
		menuEntries = entries;
		menuPos = { x: rect.right, y: rect.bottom, align: 'end' };
		menuOpen = true;
	}

	function onPanelPointerDown(event: MouseEvent) {
		if (model.focusedPanel === panel.id) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('.modular-tabbar')) return;
		model.focus(panel.selected || panel.id);
	}

	/** Focus the panel when it is clicked. The tab bar handles its own focus. */
	function panelFocus(node: HTMLElement) {
		const onDown = (event: MouseEvent) => onPanelPointerDown(event);
		node.addEventListener('mousedown', onDown);
		return {
			destroy() {
				node.removeEventListener('mousedown', onDown);
			}
		};
	}

	function isInStage(): boolean {
		return panel.selected ? model.placementOf(panel.selected) === 'stage' : false;
	}

	function onTabKeydown(event: KeyboardEvent, viewId: string) {
		const tabs = panel.views;
		const index = tabs.indexOf(viewId);
		let next: string | undefined;
		if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
		else if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
		else if (event.key === 'Home') next = tabs[0];
		else if (event.key === 'End') next = tabs[tabs.length - 1];
		else return;
		event.preventDefault();
		if (next) {
			model.select(next);
			requestAnimationFrame(() => {
				document.querySelector<HTMLElement>(`[data-modular-tab="${CSS.escape(next!)}"]`)?.focus();
			});
		}
	}

	function closable(viewId: string): boolean {
		return model.api(viewId).definition?.closable !== false;
	}

	/** Should this view stay in the DOM while another tab is selected? */
	function keepMounted(viewId: string): boolean {
		if (panel.selected === viewId) return true;
		const def = model.api(viewId).definition;
		if (def?.unmountWhenHidden !== undefined) return !def.unmountWhenHidden;
		return !options.unmountInactive;
	}

	// ------------------------------------------------------------------ Floating panels

	function startFloatingGesture(event: PointerEvent, mode: 'move' | 'resize') {
		if (!panelEl || region !== 'floating') return;
		const container = panelEl.closest('.modular') as HTMLElement | null;
		const rect = model.floatingRect(panel.id);
		if (!container || !rect) return;

		const bounds = container.getBoundingClientRect();
		if (bounds.width <= 0 || bounds.height <= 0) return;

		const handle = event.currentTarget as HTMLElement;
		const startX = event.clientX;
		const startY = event.clientY;
		const origin = { ...rect };
		event.preventDefault();
		event.stopPropagation();
		handle.setPointerCapture(event.pointerId);

		const move = (e: PointerEvent) => {
			const dx = (e.clientX - startX) / bounds.width;
			const dy = (e.clientY - startY) / bounds.height;
			if (mode === 'move') {
				model.setFloatingRect(panel.id, { x: origin.x + dx, y: origin.y + dy }, { commit: false });
			} else {
				model.setFloatingRect(panel.id, { w: origin.w + dx, h: origin.h + dy }, { commit: false });
			}
		};

		const up = () => {
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', up);
			handle.removeEventListener('pointercancel', up);
			model.commit();
		};

		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', up);
		handle.addEventListener('pointercancel', up);
	}

	function onFloatingDragStart(event: PointerEvent) {
		if (region !== 'floating') return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('.modular-tab, button')) return;
		model.raiseFloating(panel.id);
		startFloatingGesture(event, 'move');
	}

	function onFloatingResizeStart(event: PointerEvent) {
		if (region !== 'floating') return;
		model.raiseFloating(panel.id);
		startFloatingGesture(event, 'resize');
	}

	function floatingDrag(node: HTMLElement) {
		const onDown = (event: PointerEvent) => onFloatingDragStart(event);
		node.addEventListener('pointerdown', onDown);
		return {
			destroy() {
				node.removeEventListener('pointerdown', onDown);
			}
		};
	}

	function floatingResize(node: HTMLElement) {
		const onDown = (event: PointerEvent) => onFloatingResizeStart(event);
		node.addEventListener('pointerdown', onDown);
		return {
			destroy() {
				node.removeEventListener('pointerdown', onDown);
			}
		};
	}

	// ------------------------------------------------------------------ Drag and Drop

	function onTabDragStart(event: DragEvent, viewId: string) {
		if (options.disableDragAndDrop || !event.dataTransfer) return;
		const data = JSON.stringify({ viewId, sourcePanelId: panel.id });
		event.dataTransfer.setData('application/x-modular-view', data);
		event.dataTransfer.setData('text/plain', viewId);
		event.dataTransfer.effectAllowed = 'move';
	}

	function parseDragData(event: DragEvent): { viewId: string; sourcePanelId: string } | null {
		const raw = event.dataTransfer?.getData('application/x-modular-view');
		if (raw) {
			try {
				return JSON.parse(raw);
			} catch {
				return null;
			}
		}
		const fallback = event.dataTransfer?.getData('text/plain');
		if (fallback && model.record(fallback)) {
			return { viewId: fallback, sourcePanelId: panel.id };
		}
		return null;
	}

	function calculateDropZone(event: DragEvent, rect: DOMRect): DropZone {
		const relX = (event.clientX - rect.left) / rect.width;
		const relY = (event.clientY - rect.top) / rect.height;

		const edgeThreshold = 0.25;
		if (relX < edgeThreshold) return 'left';
		if (relX > 1 - edgeThreshold) return 'right';
		if (relY < edgeThreshold) return 'top';
		if (relY > 1 - edgeThreshold) return 'bottom';
		return 'center';
	}

	function onPanelDragOver(event: DragEvent) {
		if (options.disableDragAndDrop || !panelEl) return;
		event.preventDefault();
		const data = parseDragData(event);
		if (data && !model.canPlace(data.viewId, model.regionOf(panel.id))) {
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
			hoverDropZone = null;
			isDraggingOver = false;
			return;
		}
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		const rect = panelEl.getBoundingClientRect();
		hoverDropZone = calculateDropZone(event, rect);
		isDraggingOver = true;
	}

	function onPanelDragLeave(event: DragEvent) {
		if (!panelEl) return;
		const rect = panelEl.getBoundingClientRect();
		const { clientX, clientY } = event;
		if (
			clientX <= rect.left ||
			clientX >= rect.right ||
			clientY <= rect.top ||
			clientY >= rect.bottom
		) {
			isDraggingOver = false;
			hoverDropZone = null;
		}
	}

	function onPanelDrop(event: DragEvent) {
		if (options.disableDragAndDrop) return;
		event.preventDefault();
		const data = parseDragData(event);
		const zone = hoverDropZone;
		isDraggingOver = false;
		hoverDropZone = null;

		if (!data || !data.viewId) return;

		if (zone === 'center') {
			model.moveView(data.viewId, { into: panel.id });
		} else if (zone) {
			model.moveView(data.viewId, { beside: panel.id, edge: zone });
		}
	}

	function onTabDrop(event: DragEvent, targetIndex: number) {
		if (options.disableDragAndDrop) return;
		event.preventDefault();
		event.stopPropagation();
		const data = parseDragData(event);
		isDraggingOver = false;
		hoverDropZone = null;
		if (!data || !data.viewId) return;
		model.moveView(data.viewId, { into: panel.id, index: targetIndex });
	}
</script>

<section
	bind:this={panelEl}
	class="modular-panel"
	data-modular-panel={panel.id}
	data-focused={focused || undefined}
	aria-label="Panel"
	ondragover={onPanelDragOver}
	ondragleave={onPanelDragLeave}
	ondrop={onPanelDrop}
	use:panelFocus
>
	{#if tabbarVisible()}
		<div
			class="modular-tabbar"
			class:modular-tabbar-drag={region === 'floating'}
			role="tablist"
			aria-label="Views"
			style:padding={options.tabs?.inset !== undefined ? `${options.tabs.inset}px` : undefined}
			use:floatingDrag
		>
			{#each panel.views as viewId, i (viewId)}
				{@const api = model.api(viewId)}
				{@const selected = panel.selected === viewId}
				<div
					class="modular-tab"
					class:selected
					data-modular-tab={viewId}
					role="tab"
					id={`modular-tab-${viewId}`}
					aria-selected={selected}
					aria-controls={`modular-view-${viewId}`}
					tabindex={selected ? 0 : -1}
					draggable={!options.disableDragAndDrop}
					style:flex={options.tabs?.fill ? '1 1 0' : undefined}
					ondragstart={(e) => onTabDragStart(e, viewId)}
					ondragover={(e) => {
						e.preventDefault();
						e.stopPropagation();
					}}
					ondrop={(e) => onTabDrop(e, i)}
					onclick={() => model.select(viewId)}
					onkeydown={(e) => onTabKeydown(e, viewId)}
				>
					<ViewContent {viewId} part="icon" />
					<span class="modular-tab-title">{api.title}</span>
					{#if api.badge !== null && api.badge !== false}
						<span
							class="modular-badge"
							aria-label={api.badge === true ? 'Modified' : `Badge ${api.badge}`}
						>
							{api.badge === true ? '' : api.badge}
						</span>
					{/if}
					{#if closable(viewId)}
						<button
							type="button"
							class="modular-tab-close"
							aria-label={`Close ${api.title}`}
							onclick={(e) => {
								e.stopPropagation();
								void model.close(viewId);
							}}
						>
							<CloseIcon size={16}/>
						</button>
					{/if}
				</div>
			{/each}

			<div class="modular-tab-accessory">
				{#if panel.selected}
					<ViewContent viewId={panel.selected} part="accessory" />
				{/if}
			</div>

			<div class="modular-tab-actions">
				{#if panel.selected}
					<button
						type="button"
						class="modular-action-button"
						aria-label="Pop out to window"
						title="Pop out window"
						onclick={(e) => {
							e.stopPropagation();
							model.openPopout(panel.selected);
						}}
					>
						<NewWindowIcon size={16} />
					</button>
					<button
						type="button"
						class="modular-action-button"
						class:active={isMaximized}
						aria-label={isMaximized ? 'Restore' : 'Maximize'}
						title={isMaximized ? 'Restore' : 'Maximize'}
						onclick={(e) => {
							e.stopPropagation();
							model.toggleMaximize(panel.selected);
						}}
					>
						<MaximizeIcon size={16} />
					</button>
				{/if}
				<button
					type="button"
					class="modular-menu-button"
					aria-label="Panel menu"
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					onclick={(e) => {
						e.stopPropagation();
						openMenu(e);
					}}
				>
					<MoreIcon size={16} />
				</button>
			</div>
		</div>
	{/if}

	<div class="modular-panel-body">
		{#each panel.views as viewId (viewId)}
			{@const api = model.api(viewId)}
			{#if keepMounted(viewId)}
				<div
					class="modular-view {api.definition?.className ?? ''}"
					id={`modular-view-${viewId}`}
					role="tabpanel"
					aria-labelledby={`modular-tab-${viewId}`}
					hidden={panel.selected !== viewId}
					data-selected={panel.selected === viewId || undefined}
				>
					<ViewContent {viewId} />
				</div>
			{/if}
		{/each}
	</div>

	{#if region === 'floating'}
		<div
			class="modular-floating-resize"
			role="presentation"
			title="Resize"
			use:floatingResize
		></div>
	{/if}

	<!-- Interactive Drop Target Overlay -->
	{#if isDraggingOver && hoverDropZone}
		<div class="modular-drop-overlay" data-drop-zone={hoverDropZone} aria-hidden="true">
			<div class="modular-drop-indicator" data-zone={hoverDropZone}></div>
		</div>
	{/if}

	{#if menuOpen}
		<Menu
			entries={menuEntries}
			x={menuPos.x}
			y={menuPos.y}
			align={menuPos.align}
			onclose={() => (menuOpen = false)}
		/>
	{/if}
	{#if customRequest}
		<span hidden data-modular-custom-menu={customRequest.panelId}></span>
	{/if}
</section>
