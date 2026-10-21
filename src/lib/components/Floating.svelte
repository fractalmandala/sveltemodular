<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import { declarations, COLLECTOR } from '../utils/context';
	import type { Collector, FloatingDecl, LayoutDecl, PanelDecl, ViewDecl } from '../utils/declare';
	import type { FloatingProps } from '../types';

	let { rect, layer = 'overlay', children }: FloatingProps = $props();

	const decl: FloatingDecl = untrack(() => ({ rect, layer }));
	const floatCollector: Collector = {
		add(node: LayoutDecl) {
			if (node.kind === 'panel' || node.kind === 'view') {
				decl.child = node as PanelDecl | ViewDecl;
			}
		}
	};
	setContext(COLLECTOR, floatCollector);

	const root = declarations('Floating');
	root.addFloating(decl);
</script>

{@render children?.()}
