<script lang="ts">
	import type { LayoutNode } from './document';
	import { modelContext, slotsContext, renderOptionsContext } from './render-context';
	import PanelView from './PanelView.svelte';
	import NodeView from './NodeView.svelte';

	let { node }: { node: LayoutNode } = $props();

	const model = modelContext('NodeView');
	const slots = slotsContext('NodeView');
	const renderOptions = renderOptionsContext('NodeView');

	let resizingIndex = $state<number | null>(null);

	function startResize(event: PointerEvent, splitId: string, index: number) {
		const splitEl = (event.currentTarget as HTMLElement).closest(
			'[data-modular-split]'
		) as HTMLElement | null;
		if (!splitEl) return;
		const target = model.doc.root;
		const split = findSplit(target, splitId);
		if (!split) return;
		event.preventDefault();
		const axis = split.axis;
		const rect = splitEl.getBoundingClientRect();
		const total = axis === 'x' ? rect.width : rect.height;
		if (total <= 0) return;
		const startWeights = [...split.weights];
		const startPos = axis === 'x' ? event.clientX : event.clientY;
		const divider = event.currentTarget as HTMLElement;
		divider.setPointerCapture(event.pointerId);
		resizingIndex = index;

		const move = (e: PointerEvent) => {
			const delta = ((axis === 'x' ? e.clientX : e.clientY) - startPos) / total;
			const weights = [...startWeights];
			const min = 0.05;
			let a = startWeights[index] + delta;
			let b = startWeights[index + 1] - delta;
			const sum = a + b;
			a = Math.min(sum - min, Math.max(min, a));
			b = sum - a;
			weights[index] = a;
			weights[index + 1] = b;
			split.weights = weights;
		};

		const up = () => {
			resizingIndex = null;
			divider.removeEventListener('pointermove', move);
			divider.removeEventListener('pointerup', up);
			divider.removeEventListener('pointercancel', up);
			model.commit();
		};

		divider.addEventListener('pointermove', move);
		divider.addEventListener('pointerup', up);
		divider.addEventListener('pointercancel', up);
	}

	function findSplit(
		node: import('./document').LayoutNode | null,
		id: string
	): import('./document').SplitNode | null {
		if (!node) return null;
		if (node.kind === 'split' && node.id === id) return node;
		if (node.kind === 'split') {
			for (const child of node.children) {
				const found = findSplit(child, id);
				if (found) return found;
			}
		}
		if (node.kind === 'stage' && node.child) return findSplit(node.child, id);
		return null;
	}

	function keyResize(event: KeyboardEvent, splitId: string, index: number) {
		const split = findSplit(model.doc.root, splitId);
		if (!split) return;
		const step = event.shiftKey ? 0.05 : 0.01;
		let delta: number;
		if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') delta = -step;
		else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') delta = step;
		else if (event.key === 'Home') delta = -split.weights[index] + 0.05;
		else if (event.key === 'End') delta = split.weights[index + 1] - 0.05;
		else return;
		event.preventDefault();
		const weights = [...split.weights];
		const min = 0.05;
		let a = weights[index] + delta;
		let b = weights[index + 1] - delta;
		const sum = a + b;
		a = Math.min(sum - min, Math.max(min, a));
		weights[index] = a;
		weights[index + 1] = sum - a;
		split.weights = weights;
		model.commit();
	}
</script>

{#if node.kind === 'panel'}
	<PanelView panel={node} region="docked" />
{:else if node.kind === 'stage'}
	<section class="modular-stage" data-modular-stage={node.id} aria-label="Stage">
		{#if slots.stageBackdrop.value ?? slots.backdrop.value}
			<div class="modular-stage-backdrop">
				{@render (slots.stageBackdrop.value ?? slots.backdrop.value)?.()}
			</div>
		{/if}
		{#if node.child}
			<div class="modular-stage-child">
				<NodeView node={node.child} />
			</div>
		{:else}
			<div class="modular-stage-empty">
				{#if slots.stageEmpty.value ?? slots.stageEmptyDefault.value}
					{@render (slots.stageEmpty.value ?? slots.stageEmptyDefault.value)?.()}
				{/if}
			</div>
		{/if}
	</section>
{:else}
	<div
		class="modular-split"
		data-modular-split={node.id}
		data-axis={node.axis}
		role="group"
		aria-label={node.axis === 'x' ? 'Horizontal split' : 'Vertical split'}
	>
		{#each node.children as child, i (child.id)}
			<div class="modular-split-child" style:flex-grow={node.weights[i] ?? 1}>
				<NodeView node={child} />
			</div>
			{#if i < node.children.length - 1}
				<!--
					Window splitter pattern: a focusable separator with aria-value* is the
					ARIA-recommended widget, so the non-interactive role rules don't apply.
				-->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
				<div
					class="modular-divider"
					data-axis={node.axis}
					class:active={resizingIndex === i}
					role="separator"
					tabindex="0"
					aria-orientation={node.axis === 'x' ? 'vertical' : 'horizontal'}
					aria-label="Resize panels"
					aria-valuemin={5}
					aria-valuemax={95}
					aria-valuenow={Math.round((node.weights[i] ?? 0) * 100)}
					onpointerdown={(e) => startResize(e, node.id, i)}
					onkeydown={(e) => keyResize(e, node.id, i)}
				>
					{#if (renderOptions.showSplitRatio || resizingIndex === i) && node.weights[i] !== undefined}
						<div class="modular-split-ratio-pill">
							{Math.round((node.weights[i] ?? 0) * 100)}% : {Math.round(
								(node.weights[i + 1] ?? 0) * 100
							)}%
						</div>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
{/if}
