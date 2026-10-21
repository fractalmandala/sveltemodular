import type { Snippet } from 'svelte';
import type {
	Axis,
	Edge,
	FloatingLayer,
	LayoutDocument,
	LayoutSpec,
	Params,
	PlacementRegion,
	Rect
} from './document';
import type { ViewApi, WorkspaceHandle } from './workspace-model.svelte';

export type { ViewApi, WorkspaceHandle };
export type { PlacementRegion };

// ------------------------------------------------------------------ drag & drop

export type DropZone = 'left' | 'right' | 'top' | 'bottom' | 'center';

export interface DragViewData {
	viewId: string;
	sourcePanelId: string;
}

// ------------------------------------------------------------------ popouts

export interface PopoutWindowEntry {
	viewId: string;
	window: Window;
	handleClose: () => void;
}

// ------------------------------------------------------------------ menus & keymap

export interface MenuItem {
	/** Identifies the item, e.g. to find or remove it in a `panelMenu` function. */
	id?: string;
	label: string;
	/** A hint shown right-aligned, e.g. "⌘S". Display only: it doesn't bind the key. */
	shortcut?: string;
	disabled?: boolean;
	checked?: boolean;
	danger?: boolean;
	run?(): void;
	items?: MenuEntry[];
}

export type MenuEntry = MenuItem | 'separator';

/** Ids of the built-in panel menu items. */
export type BuiltInMenuId =
	| 'float'
	| 'dock'
	| 'move'
	| 'split-right'
	| 'split-below'
	| 'hide'
	| 'close'
	| 'close-others'
	| 'maximize'
	| 'popout';

/** What a `panelMenu` function knows about the menu being opened. */
export interface PanelMenuContext {
	panelId: string;
	/** The panel's selected view, whose `menu` items lead the menu. */
	view: ViewApi;
	region: 'stage' | 'side' | 'floating';
}

/** A menu for `renderMenu` to show in place of the built-in one. */
export interface MenuRequest {
	/** The final entries, with leading, trailing and repeated separators removed. */
	entries: MenuEntry[];
	/** Where to show it, in viewport (client) pixels. */
	x: number;
	y: number;
	/** "end" when opened from the panel menu button: align the menu's right edge to `x`. */
	align: 'start' | 'end';
	/** The panel menu button, when the menu was opened from it. */
	anchor: HTMLElement | null;
	panelId: string;
	/** Call when your menu closes. */
	close(): void;
}

export type Command =
	| 'panel.next'
	| 'panel.previous'
	| 'tab.next'
	| 'tab.previous'
	| 'tab.closeOthers'
	| 'view.close'
	| 'panel.float'
	| 'panel.hide'
	| 'panel.splitRight'
	| 'panel.splitBelow'
	| 'view.maximize'
	| 'view.moveToStage'
	| 'view.moveToFloating';

export type Keymap = Partial<Record<Command, string | null>>;

export const DEFAULT_KEYMAP: Record<Command, string | null> = {
	'panel.next': 'F6',
	'panel.previous': 'Shift+F6',
	'tab.next': 'Mod+Alt+]',
	'tab.previous': 'Mod+Alt+[',
	'tab.closeOthers': null,
	'view.close': 'Mod+Alt+W',
	'panel.float': null,
	'panel.hide': null,
	'panel.splitRight': null,
	'panel.splitBelow': null,
	'view.maximize': 'Mod+Alt+M',
	'view.moveToStage': null,
	'view.moveToFloating': null
};

/** Physical key codes for keys whose `event.key` shifts under Alt on macOS. */
const KEY_CODES: Record<string, string> = {
	'[': 'BracketLeft',
	']': 'BracketRight',
	'-': 'Minus',
	'=': 'Equal',
	';': 'Semicolon',
	"'": 'Quote',
	',': 'Comma',
	'.': 'Period',
	'/': 'Slash',
	'\\': 'Backslash',
	'`': 'Backquote'
};

const isMac = (): boolean =>
	typeof navigator !== 'undefined' &&
	/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Human-readable shortcut, e.g. "⌘⌥←" on macOS or "Ctrl+Alt+←" elsewhere. */
export function formatCombo(combo: string): string {
	const mac = isMac();
	return combo
		.split('+')
		.map((part) => {
			switch (part) {
				case 'Mod':
					return mac ? '⌘' : 'Ctrl';
				case 'Alt':
					return mac ? '⌥' : 'Alt';
				case 'Shift':
					return mac ? '⇧' : 'Shift';
				case 'Ctrl':
					return mac ? '⌃' : 'Ctrl';
				default:
					return part;
			}
		})
		.join(mac ? '' : '+');
}

/** Does this keyboard event match a combo like "Mod+Alt+]"? `Mod` is ⌘ on macOS, Ctrl elsewhere. */
export function matchesCombo(event: KeyboardEvent, combo: string): boolean {
	const mac = isMac();
	const parts = combo.split('+').map((p) => p.trim());
	const key = parts.pop() ?? '';
	const want = {
		mod: parts.includes('Mod') ? (mac ? event.metaKey : event.ctrlKey) : undefined,
		ctrl: parts.includes('Ctrl') ? event.ctrlKey : undefined,
		meta: parts.includes('Meta') ? event.metaKey : undefined,
		alt: parts.includes('Alt') ? event.altKey : undefined,
		shift: parts.includes('Shift') ? event.shiftKey : undefined
	};
	if (want.mod === undefined && (mac ? event.metaKey : event.ctrlKey)) return false;
	if (want.ctrl === undefined && event.ctrlKey && !want.mod) return false;
	if (want.meta === undefined && event.metaKey && !want.mod) return false;
	if (want.alt === undefined && event.altKey) return false;
	if (want.mod !== undefined && want.mod !== (mac ? event.metaKey : event.ctrlKey)) return false;
	if (want.ctrl !== undefined && want.ctrl !== event.ctrlKey) return false;
	if (want.meta !== undefined && want.meta !== event.metaKey) return false;
	if (want.alt !== undefined && want.alt !== event.altKey) return false;
	if (want.shift !== undefined && want.shift !== event.shiftKey) return false;
	if (key.length === 1) {
		if (event.key.toLowerCase() === key.toLowerCase()) return true;
		// Alt rewrites `event.key` on macOS ("[" becomes "{"), so match the physical key too.
		const code = KEY_CODES[key];
		return !!code && event.code === code;
	}
	return event.key === key || event.code === key;
}

// ------------------------------------------------------------------ view types & placement

export type Placement =
	| 'stage'
	| 'float'
	| 'side'
	| 'tab'
	| { beside: string; edge: Edge; share?: number }
	| { into: string; index?: number }
	| { float: Rect; layer?: FloatingLayer };

export interface ViewRules {
	/** Where `open()` puts a view of this type unless the caller says otherwise. */
	placement?: Placement;
	/** Where users may drop it. Every region is allowed by default. */
	allow?: { stage?: boolean; side?: boolean; floating?: boolean };
	/** At most one instance; `open()` focuses the existing one. */
	singleton?: boolean;
	closable?: boolean;
	/**
	 * Tab bar: "always" (default) sits above the content; "auto" hides it while the view is alone
	 * in its panel; "never" always hides it.
	 */
	tabbar?: 'always' | 'auto' | 'never';
	/**
	 * Unmount the view while another tab of the same panel is selected. Stops timers
	 * and effects of hidden views, at the cost of losing their state. Overrides the
	 * workspace-level `unmountInactive` when set.
	 */
	unmountWhenHidden?: boolean;
}

export type Theme = 'light' | 'medium' | 'dark' | 'darker' | 'system';

export interface OpenOptions {
	params?: object;
	id?: string;
	title?: string;
	placement?: Placement;
	reuse?: 'none' | 'type' | 'params' | ((view: ViewInfo) => boolean);
	focus?: boolean;
}

export interface ViewInfo {
	id: string;
	type: string;
	params: Params;
	title: string;
	panelId: string;
	placement: 'docked' | 'stage' | 'floating' | 'hidden' | 'popout';
	selected: boolean;
}

// ------------------------------------------------------------------ component props

export interface ViewTypeProps<P extends object = Params> extends ViewRules {
	/** Unique type name. `<View type>` and `open(type)` refer to it. */
	id: string;
	title?: string | ((view: ViewApi<P>) => string);
	/** Trusted SVG/HTML markup for the tab icon, or a snippet rendered into the tab. */
	icon?: string | Snippet;
	/** Content for each view. Use `useView()` inside it. */
	children?: Snippet;
	/** Alternative to children: content that receives the view's API. */
	render?: Snippet<[ViewApi<P>]>;
	/** Rendered in the tab bar while this view is selected. */
	accessory?: Snippet;
	/** Iframe content instead of a component. Its element survives tab switches within its panel. */
	iframe?:
		| string
		| { src?: string; srcdoc?: string; sandbox?: string; allow?: string; title?: string }
		| ((
				view: ViewApi<P>
		  ) =>
				| string
				| { src?: string; srcdoc?: string; sandbox?: string; allow?: string; title?: string });
	/** Vanilla mount instead of content. */
	mount?: (
		element: HTMLElement,
		view: ViewApi<P>,
		parts: { icon: HTMLElement; accessory: HTMLElement }
	) => void | (() => void);
	menu?: MenuEntry[] | ((view: ViewApi<P>) => MenuEntry[]);
	className?: string;
}

export interface SplitProps {
	axis?: Axis;
	weights?: number[];
	id?: string;
	children?: Snippet;
}

export interface PanelProps {
	id?: string;
	/** Index of the initially selected view. */
	selected?: number;
	children?: Snippet;
}

export interface ViewProps {
	type: string;
	id?: string;
	params?: object;
	title?: string;
}

export interface StageProps {
	id?: string;
	backdrop?: Snippet;
	empty?: Snippet;
	children?: Snippet;
}

export interface FloatingProps {
	/** Position and size as fractions (0–1) of the layer. */
	rect: Rect;
	layer?: FloatingLayer;
	children?: Snippet;
}

export interface WorkspaceProps {
	children?: Snippet;
	workspace?: WorkspaceHandle | null;
	floating?: false | FloatingLayer;
	theme?: Theme;
	tokens?: Record<string, string>;
	keymap?: Keymap;
	panelMenu?: boolean | ((entries: MenuEntry[], context: PanelMenuContext) => MenuEntry[]);
	renderMenu?(request: MenuRequest): void;
	tabs?: { fill?: boolean; inset?: number };
	label?: string;
	storageKey?: string;
	version?: string | number;
	defaultLayout?: LayoutDocument | LayoutSpec | null;
	document?: LayoutDocument;
	showSplitRatio?: boolean;
	disableDragAndDrop?: boolean;
	/**
	 * Unmount views that are not the selected tab of their panel. Views whose type
	 * sets `unmountWhenHidden` keep their own setting.
	 */
	unmountInactive?: boolean;
	onDocumentChange?(document: LayoutDocument): void;
	onOpen?(view: ViewInfo): void;
	onClose?(view: ViewInfo): void;
	onFocus?(viewId: string | null): void;
	onPopoutOpen?(viewId: string): void;
	onPopoutClose?(viewId: string): void;
	class?: string;
}
