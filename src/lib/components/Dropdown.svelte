<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { DropdownPlacement } from '../types';

	export interface DropdownMenuItem {
		id?: string;
		label?: string;
		icon?: string;
		shortcut?: string;
		danger?: boolean;
		disabled?: boolean;
		separator?: boolean;
		onclick?: () => void;
	}

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
		open?: boolean;
		placement?: DropdownPlacement;
		closeOnSelect?: boolean;
		items?: DropdownMenuItem[];

		class?: string;
		/** Trigger element snippet */
		trigger?: Snippet<[{ open: boolean; toggle: () => void }]>;
		/** Custom menu body content replacing items */
		children?: Snippet<[{ close: () => void }]>;
	}

	let {
		open = $bindable(false),
		placement = 'bottom-start',
		closeOnSelect = true,
		items = [],
		class: className = '',
		trigger,
		children,
		...restProps
	}: Props = $props();

	let containerEl: HTMLDivElement | undefined = $state();
	let menuEl: HTMLDivElement | undefined = $state();
	let focusedIndex = $state(-1);

	function toggle() {
		open = !open;
		if (open) {
			focusedIndex = -1;
		}
	}

	function close() {
		open = false;
		focusedIndex = -1;
	}

	function handleItemClick(item: DropdownMenuItem) {
		if (item.disabled || item.separator) return;
		item.onclick?.();
		if (closeOnSelect) {
			close();
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!open) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}

		if (items.length > 0) {
			const selectableItems = items.filter((i) => !i.separator && !i.disabled);
			if (selectableItems.length === 0) return;

			if (event.key === 'ArrowDown') {
				event.preventDefault();
				focusedIndex = (focusedIndex + 1) % items.length;
				while (items[focusedIndex]?.separator || items[focusedIndex]?.disabled) {
					focusedIndex = (focusedIndex + 1) % items.length;
				}
			} else if (event.key === 'ArrowUp') {
				event.preventDefault();
				focusedIndex = (focusedIndex - 1 + items.length) % items.length;
				while (items[focusedIndex]?.separator || items[focusedIndex]?.disabled) {
					focusedIndex = (focusedIndex - 1 + items.length) % items.length;
				}
			} else if ((event.key === 'Enter' || event.key === ' ') && focusedIndex >= 0) {
				event.preventDefault();
				const item = items[focusedIndex];
				if (item) handleItemClick(item);
			}
		}
	}

	$effect(() => {
		if (!open || typeof document === 'undefined') return;

		function handleClickOutside(event: MouseEvent) {
			const target = event.target as Node;
			if (containerEl && !containerEl.contains(target) && (!menuEl || !menuEl.contains(target))) {
				close();
			}
		}

		document.addEventListener('mousedown', handleClickOutside, true);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside, true);
		};
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

<div
	bind:this={containerEl}
	class="f-dropdown-container"
>
	{#if trigger}
		{@render trigger({ open, toggle })}
	{/if}

	{#if open}
		<div
			bind:this={menuEl}
			role="menu"
			tabindex="-1"
			class="f-dropdown-panel {className}"
			data-placement={placement}
			{...restProps}
		>
			{#if children}
				{@render children({ close })}
			{:else}
				{#each items as item, index}
					{#if item.separator}
						<div role="separator" class="f-dropdown-separator"></div>
					{:else}
						<button
							type="button"
							role="menuitem"
							class="f-dropdown-item"
							data-danger={item.danger ? 'true' : undefined}
							data-focused={focusedIndex === index ? 'true' : undefined}
							disabled={item.disabled}
							onclick={() => handleItemClick(item)}
						>
							{#if item.icon}
								<span class="f-dropdown-item-icon">{item.icon}</span>
							{/if}
							<span class="f-dropdown-item-label">{item.label}</span>
							{#if item.shortcut}
								<span class="f-dropdown-item-shortcut">{item.shortcut}</span>
							{/if}
						</button>
					{/if}
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	@layer fractalsvelte-ui.components {
		.f-dropdown-container {
			position: relative;
			display: inline-block;
		}

		.f-dropdown-panel {
			position: absolute;
			z-index: var(--f-z-dropdown, 1000);
			min-width: 180px;
			background: var(--f-surface);
			color: var(--f-text);
			border: 1px solid var(--f-border);
			border-radius: var(--f-radius-lg);
			box-shadow: var(--f-shadow-lg);
			padding: var(--f-space-3xs);
			box-sizing: border-box;
			outline: none;
			animation: f-dropdown-appear var(--f-duration-fast) var(--f-ease);
		}

		/* Placements */
		.f-dropdown-panel[data-placement='bottom-start'] {
			top: calc(100% + 4px);
			left: 0;
		}
		.f-dropdown-panel[data-placement='bottom-end'] {
			top: calc(100% + 4px);
			right: 0;
		}
		.f-dropdown-panel[data-placement='bottom'] {
			top: calc(100% + 4px);
			left: 50%;
			transform: translateX(-50%);
		}
		.f-dropdown-panel[data-placement='top-start'] {
			bottom: calc(100% + 4px);
			left: 0;
		}
		.f-dropdown-panel[data-placement='top-end'] {
			bottom: calc(100% + 4px);
			right: 0;
		}

		.f-dropdown-separator {
			height: 1px;
			margin: var(--f-space-3xs) 0;
			background: var(--f-border-subtle);
		}

		.f-dropdown-item {
			display: flex;
			align-items: center;
			width: 100%;
			padding: var(--f-space-xs) var(--f-space-sm);
			border: none;
			border-radius: var(--f-radius-sm);
			background: transparent;
			color: var(--f-text);
			font-family: inherit;
			font-size: var(--f-text-sm);
			text-align: left;
			cursor: pointer;
			user-select: none;
			box-sizing: border-box;
			gap: var(--f-space-sm);
			transition: background var(--f-duration-fast) var(--f-ease),
				color var(--f-duration-fast) var(--f-ease);
		}

		.f-dropdown-item:hover:not(:disabled),
		.f-dropdown-item[data-focused='true'] {
			background: var(--f-hover);
		}

		.f-dropdown-item:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.f-dropdown-item[data-danger='true'] {
			color: var(--f-danger);
		}

		.f-dropdown-item[data-danger='true']:hover:not(:disabled),
		.f-dropdown-item[data-danger='true'][data-focused='true'] {
			background: var(--f-danger-bg);
			color: var(--f-danger);
		}

		.f-dropdown-item-icon {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
			font-size: var(--f-text-sm);
		}

		.f-dropdown-item-label {
			flex: 1;
			min-width: 0;
		}

		.f-dropdown-item-shortcut {
			font-size: var(--f-text-xs);
			color: var(--f-text-muted);
			font-family: var(--f-font-mono);
			margin-left: auto;
		}

		@keyframes f-dropdown-appear {
			from {
				opacity: 0;
				transform: scale(0.96) translateY(-4px);
			}
			to {
				opacity: 1;
				transform: scale(1) translateY(0);
			}
		}
	}
</style>
