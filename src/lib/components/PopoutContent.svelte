<script lang="ts">
	import ViewContent from './ViewContent.svelte';

	let {
		popout,
		title,
		viewId
	}: {
		popout: Window;
		title: string;
		viewId: string;
	} = $props();

	$effect(() => {
		if (popout && popout.document) {
			popout.document.title = title;
		}
	});
</script>

<main class="modular-popout-body">
	<div class="modular" data-modular="" style="width: 100%; height: 100%;">
		<ViewContent {viewId} />
	</div>
</main>
