<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setContext, untrack } from 'svelte';
	import { PROVIDER, WORKSPACE } from './context';
	import { WorkspaceModel } from './workspace-model.svelte';

	let {
		children,
		workspace = new WorkspaceModel()
	}: { children?: Snippet; workspace?: WorkspaceModel } = $props();

	setContext(
		PROVIDER,
		untrack(() => workspace)
	);
	setContext(
		WORKSPACE,
		untrack(() => workspace)
	);
</script>

{@render children?.()}
