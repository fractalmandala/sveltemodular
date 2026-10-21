// sveltemodular — Pure Svelte 5 dockable fractal workspace components
export { default as Workspace } from './Workspace.svelte';
export { default as WorkspaceProvider } from './WorkspaceProvider.svelte';
export { default as ViewType } from './ViewType.svelte';
export { default as Split } from './Split.svelte';
export { default as Panel } from './Panel.svelte';
export { default as View } from './View.svelte';
export { default as Stage } from './Stage.svelte';
export { default as Floating } from './Floating.svelte';
export { default as Backdrop } from './Backdrop.svelte';
export { default as StageEmpty } from './StageEmpty.svelte';
export { default as Empty } from './Empty.svelte';
export { default as Chrome } from './Chrome.svelte';

// Hooks
export {
	useWorkspace,
	useOptionalWorkspace,
	useWorkspaceState,
	useWorkspaceSelector,
	useView,
	useOptionalView,
	useViewTitle,
	useViewBadge,
	useCloseGuard
} from './hooks.svelte';

export { ViewApi } from './view-api.svelte';
export { WorkspaceModel } from './workspace-model.svelte';
export type { WorkspaceHandle, WorkspaceSnapshot } from './workspace-model.svelte';

export type {
	WorkspaceProps,
	ViewTypeProps,
	SplitProps,
	PanelProps,
	ViewProps,
	StageProps,
	FloatingProps,
	MenuItem,
	MenuEntry,
	MenuRequest,
	PanelMenuContext,
	BuiltInMenuId,
	Command,
	Keymap,
	Placement,
	PlacementRegion,
	OpenOptions,
	ViewInfo,
	ViewRules,
	Theme,
	DropZone,
	DragViewData
} from './types';

export { DEFAULT_KEYMAP, formatCombo, matchesCombo } from './types';

export { layout, createDocument, emptyDocument, sanitize, normalize } from './document';

export type {
	Axis,
	Edge,
	FloatSpec,
	FloatingLayer,
	FloatingPanel,
	HiddenPanel,
	LayoutDocument,
	LayoutNode,
	LayoutSpec,
	PanelNode,
	PanelSpec,
	Params,
	Rect,
	RestoreTarget,
	SplitNode,
	SplitSpec,
	StageNode,
	StageSpec,
	ViewRecord,
	ViewSpec
} from './document';
