<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import { collector, declarations, COLLECTOR } from './context';
	import type { Collector, LayoutDecl, StageDecl } from './declare';
	import type { StageProps } from './types';

	let { id, backdrop, empty, children }: StageProps = $props();

	const decls = declarations('Stage');
	if (untrack(() => backdrop)) decls.slots.stageBackdrop.value = untrack(() => backdrop);
	if (untrack(() => empty)) decls.slots.stageEmpty.value = untrack(() => empty);

	// Read the parent collector before overriding the context: `setContext`
	// shadows the inherited value for this component as well.
	const parent = collector('Stage');

	const childNodes: LayoutDecl[] = [];
	const stageCollector: Collector = {
		add(node) {
			childNodes.push(node);
		}
	};
	setContext(COLLECTOR, stageCollector);

	const decl: StageDecl = untrack(() => ({ kind: 'stage', id, children: childNodes }));
	parent.add(decl);
</script>

{@render children?.()}
