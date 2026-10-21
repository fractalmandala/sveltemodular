<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import { collector, COLLECTOR } from '../utils/context';
	import type { Collector, LayoutDecl, SplitDecl } from '../utils/declare';
	import type { SplitProps } from '../types';

	let { axis = 'x', weights, id, children }: SplitProps = $props();

	// Read the parent collector before overriding the context: `setContext`
	// shadows the inherited value for this component as well.
	const parent = collector('Split');

	const childNodes: LayoutDecl[] = [];
	const splitCollector: Collector = {
		add(node) {
			childNodes.push(node);
		}
	};
	setContext(COLLECTOR, splitCollector);

	const decl: SplitDecl = untrack(() => ({
		kind: 'split',
		axis,
		id,
		weights,
		children: childNodes
	}));
	parent.add(decl);
</script>

{@render children?.()}
