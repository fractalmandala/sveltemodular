<script lang="ts">
	import { untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import { declarations } from './context';

	let { children }: { children?: Snippet } = $props();
	const decl = declarations('Empty');
	decl.slots.empty.value = untrack(() => children);
</script>
