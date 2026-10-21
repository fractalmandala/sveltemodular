<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import { collector, COLLECTOR } from './context';
	import type { Collector, PanelDecl, ViewDecl } from './declare';
	import type { PanelProps } from './types';

	let { id, selected, children }: PanelProps = $props();

	// Read the parent collector before overriding the context: `setContext`
	// shadows the inherited value for this component as well.
	const parent = collector('Panel');

	const views: ViewDecl[] = [];
	const panelCollector: Collector = {
		add(node) {
			if (node.kind === 'view') views.push(node);
		}
	};
	setContext(COLLECTOR, panelCollector);

	const decl: PanelDecl = untrack(() => ({ kind: 'panel', id, selected, views }));
	parent.add(decl);
</script>

{@render children?.()}
