<script lang="ts">
	import { untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import { declarations } from '../utils/context';

	let { children }: { children?: Snippet } = $props();
	const decl = declarations('Chrome');
	decl.slots.chrome.value = untrack(() => children);
</script>
