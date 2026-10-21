<script lang="ts">
	import '@fractaldesign/fractalstyler/css';
	import '#lib/style.css';
	import '$site/styles/routes.sass';
	import { resolve } from '$app/paths';
	import { modeScript } from '$site/mode/mode.svelte';
	import ModeToggle from '$site/mode/ModeToggle.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>sveltemodular — Pure Svelte 5 Fractal Workspace</title>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<script>${modeScript()}<\x2fscript>`}
</svelte:head>

<div class="app-shell">
	<header class="app-header ycenter row xbetween wfull px-lg py-sm">
		<a class="logo-link row gap-bs ycenter" href={resolve('/')}>
			<span class="text-heading-md font-bold">sveltemodular</span>
			<span class="tag text-xs text-secondary">svelte 5 runes</span>
		</a>
		<nav class="header-nav row gap-bs ycenter">
			<a
				class="nav-link text-body-sm"
				href="https://github.com/fractalmandala"
				target="_blank"
				rel="noreferrer"
			>
				GitHub
			</a>
			<ModeToggle />
		</nav>
	</header>
	<main class="app-main">
		{@render children()}
	</main>
</div>
