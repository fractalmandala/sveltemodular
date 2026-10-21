<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import { VIEW_API } from './context';
	import { modelContext, declarationsContext } from './render-context';
	import type { ViewTypeProps } from './types';
	import type { ViewApi } from './workspace-model.svelte';

	let { viewId, part = 'content' }: { viewId: string; part?: 'content' | 'icon' | 'accessory' } =
		$props();

	const model = modelContext('ViewContent');
	const declarations = declarationsContext('ViewContent');
	const api: ViewApi = untrack(() => model.api(viewId));

	setContext(VIEW_API, api);

	const typeId = $derived(model.record(viewId)?.type ?? '');
	const def = $derived(typeId ? declarations.type(typeId).value : undefined);
	const record = $derived(model.record(viewId));

	function iframeAttrs(d: ViewTypeProps | undefined) {
		const value = typeof d?.iframe === 'function' ? d.iframe(api) : d?.iframe;
		if (typeof value === 'string') return { src: value };
		return value ?? {};
	}

	let mountEl = $state<HTMLElement | null>(null);
	let iconEl = $state<HTMLElement | null>(null);
	let accessoryEl = $state<HTMLElement | null>(null);

	$effect(() => {
		const d = def;
		if (part !== 'content' || !d?.mount || !mountEl) return;
		const cleanup = untrack(() =>
			d.mount!(mountEl!, api, { icon: iconEl!, accessory: accessoryEl! })
		);
		return () => {
			if (typeof cleanup === 'function') cleanup();
		};
	});
</script>

{#if part === 'content'}
	{#if !record}
		<!-- record gone -->
	{:else if !def}
		<div class="modular-unavailable" role="note">
			<p>Unavailable: view type “{typeId}” is not registered.</p>
		</div>
	{:else if def.iframe !== undefined}
		{#key JSON.stringify(iframeAttrs(def))}
			<iframe class="modular-iframe" title={model.titleOf(viewId)} {...iframeAttrs(def)}></iframe>
		{/key}
	{:else if def.mount}
		<div bind:this={mountEl} class="modular-mount {def.className ?? ''}"></div>
		<span bind:this={iconEl} hidden></span>
		<span bind:this={accessoryEl} hidden></span>
	{:else if def.render}
		{@render def.render(api)}
	{:else if def.children}
		{@render def.children()}
	{/if}
{:else if part === 'icon'}
	{#if def}
		{#if typeof def.icon === 'string'}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<span class="modular-tab-icon-html">{@html def.icon}</span>
		{:else if def.icon}
			{@render def.icon()}
		{/if}
	{/if}
{:else if def?.accessory}
	{@render def.accessory()}
{/if}
