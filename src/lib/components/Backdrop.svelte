<script lang="ts">
	import { untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import { declarations } from '../utils/context';

	let { children }: { children?: Snippet } = $props();
	const decl = declarations('Backdrop');
	decl.slots.backdrop.value = untrack(() => children);
</script>
