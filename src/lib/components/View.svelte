<script lang="ts">
	import { untrack } from 'svelte';
	import { collector } from '../utils/context';
	import type { ViewProps } from '../types';

	let { type, id, params, title }: ViewProps = $props();
	collector('View').add(untrack(() => ({ kind: 'view', type, id, params, title })));
</script>
