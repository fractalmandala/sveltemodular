<script lang="ts">
	import type { MenuEntry, MenuItem } from '../types';

	let {
		entries,
		x,
		y,
		align = 'start',
		onclose
	}: {
		entries: MenuEntry[];
		x: number;
		y: number;
		align?: 'start' | 'end';
		onclose: () => void;
	} = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (dialogEl && !dialogEl.open) dialogEl.showModal();
	});

	function pick(item: MenuItem) {
		if (item.disabled) return;
		dialogEl?.close();
		item.run?.();
	}
</script>

<dialog
	bind:this={dialogEl}
	class="modular-menu"
	style:left={align === 'end' ? undefined : `${x}px`}
	style:right={align === 'end' ? `${Math.max(0, window.innerWidth - x)}px` : undefined}
	style:top={`${y}px`}
	{onclose}
	onclick={(e) => {
		if (e.target === dialogEl) dialogEl?.close();
	}}
>
	<ul role="menu">
		{#each entries as entry, i (i)}
			{#if entry === 'separator'}
				<li role="separator" class="modular-menu-separator"></li>
			{:else if entry.items}
				<li class="modular-menu-group">
					<span class="modular-menu-label">{entry.label}</span>
					<ul>
						{#each entry.items as sub, j (j)}
							{#if sub === 'separator'}
								<li role="separator" class="modular-menu-separator"></li>
							{:else}
								<li>
									<button
										type="button"
										role={sub.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
										class="modular-menu-item"
										disabled={sub.disabled}
										aria-checked={sub.checked}
										onclick={() => pick(sub)}
									>
										<span>{sub.label}</span>
										{#if sub.shortcut}<kbd>{sub.shortcut}</kbd>{/if}
									</button>
								</li>
							{/if}
						{/each}
					</ul>
				</li>
			{:else}
				<li>
					<button
						type="button"
						role={entry.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
						class="modular-menu-item"
						class:danger={entry.danger}
						disabled={entry.disabled}
						aria-checked={entry.checked}
						onclick={() => pick(entry)}
					>
						<span>{entry.label}</span>
						{#if entry.checked}<span aria-hidden="true">✓</span>{/if}
						{#if entry.shortcut}<kbd>{entry.shortcut}</kbd>{/if}
					</button>
				</li>
			{/if}
		{/each}
	</ul>
</dialog>
