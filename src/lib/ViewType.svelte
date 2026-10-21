<script lang="ts">
	import { untrack } from 'svelte';
	import { declarations } from './context';
	import type { ViewTypeProps } from './types';

	let props: ViewTypeProps = $props();
	const decl = declarations('ViewType');

	$effect.pre(() => {
		const snapshot = { ...props };
		untrack(() => decl.setType(props.id, snapshot));
		return () => untrack(() => decl.removeType(props.id));
	});
</script>
