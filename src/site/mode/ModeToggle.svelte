<script lang="ts">
	import { mode } from './mode.svelte.js';
	import Sun from './Sun.svelte';
	import Moon from './Moon.svelte';

	let { class: className = '' }: { class?: string } = $props();

	// The one mode engine. toggle() defaults to the swipe — the incoming theme
	// wipes over the old one (dark falls from the top, light rises from the
	// bottom, 520ms), and falls back to an instant flip under reduced motion or
	// where view transitions are missing.
	const store = mode();
	const dark = $derived(store.resolved === 'dark');
</script>

<button
	type="button"
	class="row modeToggle {className}"
	class:ondark={dark}
	role="switch"
	aria-checked={dark}
	aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
	title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
	onclick={() => store.toggle()}
>
	<span class:active={!dark} aria-hidden="true">
		<Sun />
	</span>
	<span class:active={dark} aria-hidden="true">
		<Moon />
	</span>
</button>

<style lang="sass">

.modeToggle
	position: relative
	display: inline-flex
	align-items: center
	gap: 8px
	padding: 4px
	height: 22px
	background: var(--bg-raised, #F4F4F5)
	border: 1px solid var(--border-strong)
	border-radius: var(--radius-full, 9999px)
	span
		color: var(--text-muted)
		&.active
			color: var(--text-primary)
</style>
