# sveltemodular

sveltemodular
Pure Svelte 5 dockable fractal workspace with tab DnD, splits, popouts, and runes reactivity
sveltekit
gitlink - https://github.com/fractalmandala/sveltemodular

Dockable, fractal workspace components for Svelte 5 (runes).

- **Pure Svelte 5 Reactivity**: State is a recursive `$state` document tree — zero imperative DOM engine, no canvas hacks, no reconcilers.
- **Interactive Tab Drag & Drop**: Drag tabs to reorder, drag to any pane edge (top, bottom, left, right) with live drop overlays to split dynamically, or drop in the center to merge into tabs.
- **Detached Popout Windows**: Pop out any view into an independent OS browser window. The view moves into the window and comes back to its panel when the window closes.
- **View Maximization**: Toggle any pane or view to full-bleed workspace view and back with one click or shortcut.
- **Draggable Floating Panels**: Move and resize floating panels by their title bar and corner grip; clicking one brings it to the front.
- **Hidden Panel Tray**: Hidden panels are listed in the workspace, one click away from being restored.
- **Declarative Workspace DSL**: Expressive `<Workspace>`, `<Split>`, `<Panel>`, `<View>`, `<ViewType>`, `<Stage>`, `<Floating>`, `<Backdrop>`, `<Chrome>` components.
- **Fractalstyler & Design Tokens**: Built-in support for Fractal design tokens, high-density layouts, custom styling, and themes.
- **Keyboard Shortcuts & Commands**: A programmable keymap and a command set you can extend.

## Commands

```bash
# run dev
pnpm dev

# run build
pnpm build

# preview
pnpm preview

# typecheck
pnpm check

# tests
pnpm test

# lint
pnpm lint

# desktop / native (when packaged with Tauri / Wails)
pnpm run desktop

# build .dmg (when configured with Tauri / Electron)
pnpm run build:dmg
```

## Quick Start

```svelte
<script lang="ts">
	import { Workspace, ViewType, Split, Panel, View, Stage } from 'sveltemodular';
	import 'sveltemodular/style.css';
</script>

<Workspace theme="dark">
	<ViewType id="notes" title="Notes">
		{#snippet render()}
			<textarea placeholder="Write notes here..."></textarea>
		{/snippet}
	</ViewType>

	<ViewType id="editor" title="Editor" placement="stage">
		{#snippet render()}
			<div>Code editor</div>
		{/snippet}
	</ViewType>

	<Split axis="x" weights={[0.3, 0.7]}>
		<Panel id="sidebar">
			<View type="notes" />
		</Panel>
		<Stage id="main">
			<View type="editor" />
		</Stage>
	</Split>
</Workspace>
```

## Layout model

The workspace is a serializable document: a tree of `split` and `panel` nodes, a
`stage` node for the main area, plus floating and hidden panels. `model.getDocument()`
returns a detached copy you can store, diff, or send to a server; `model.adopt(doc)`
loads one back.

```ts
const doc = workspace.getDocument(); // plain JSON
workspace.adopt(doc); // restore it
```

Regions matter when a view type restricts where it may live:

- `stage` — inside the `<Stage>` area.
- `side` — docked next to the stage.
- `floating` — a floating panel.

```svelte
<ViewType id="palette" title="Palette" allow={{ stage: false }} />
```

A type with `allow: { stage: false }` is never dropped into the stage, and
`open()` falls back to a region the type allows.

## Workspace props

| Prop                 | What it does                                                                       |
| -------------------- | ---------------------------------------------------------------------------------- |
| `workspace`          | Bindable handle to the model (`bind:workspace`).                                   |
| `document`           | Controlled document. Changes are adopted.                                          |
| `defaultLayout`      | Layout used when nothing else is given.                                            |
| `storageKey`         | Persists the document in `localStorage` (writes are debounced).                    |
| `keymap`             | Overrides the default shortcuts.                                                   |
| `panelMenu`          | `false`, or a function that rewrites the panel menu entries.                       |
| `renderMenu`         | Renders the menu yourself instead of using the built-in one.                       |
| `floating`           | `false` disables floating panels; `'stage'` or `'overlay'` sets the default layer. |
| `showSplitRatio`     | Shows the split ratio pill while resizing.                                         |
| `disableDragAndDrop` | Turns off tab dragging.                                                            |
| `onDocumentChange`   | Called with the new document whenever the layout changes.                          |

## Keeping hidden views cheap

Every view of a panel stays mounted while another tab is selected, so iframes
keep their state. Views that should not hold on to timers and effects while
hidden can opt out:

```svelte
<ViewType id="logs" title="Logs" unmountWhenHidden />
```

Unmounting loses the view's local state when the tab is selected again. Use the
workspace-level `unmountInactive` to apply it to every view.

## Hooks

```svelte
<script lang="ts">
	import { useView, useViewTitle, useViewBadge, useCloseGuard } from 'sveltemodular';

	const view = useView();
	useViewTitle(() => `Untitled ${count}`);
	useViewBadge(() => (dirty ? 1 : null));
	useCloseGuard(() => confirm('Discard changes?'));
</script>
```

`useViewTitle` and `useViewBadge` update the tab live. `useCloseGuard` can veto a
close.

## Keyboard

| Command                                                                                                                           | Default                   |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `panel.next` / `panel.previous`                                                                                                   | `F6` / `Shift+F6`         |
| `tab.next` / `tab.previous`                                                                                                       | `Mod+Alt+]` / `Mod+Alt+[` |
| `view.close`                                                                                                                      | `Mod+Alt+W`               |
| `view.maximize`                                                                                                                   | `Mod+Alt+M`               |
| `tab.closeOthers`, `panel.float`, `panel.hide`, `panel.splitRight`, `panel.splitBelow`, `view.moveToStage`, `view.moveToFloating` | unbound                   |

Bind them yourself with the `keymap` prop:

```svelte
<Workspace keymap={{ 'view.close': 'Mod+W', 'panel.splitRight': 'Mod+Enter' }} />
```

## License

MIT
