// sveltemodular — Pure Svelte 5 dockable fractal workspace components
export { default as Workspace } from './components/Workspace.svelte';
export { default as WorkspaceProvider } from './components/WorkspaceProvider.svelte';
export { default as ViewType } from './components/ViewType.svelte';
export { default as Split } from './components/Split.svelte';
export { default as Panel } from './components/Panel.svelte';
export { default as View } from './components/View.svelte';
export { default as Stage } from './components/Stage.svelte';
export { default as Floating } from './components/Floating.svelte';
export { default as Backdrop } from './components/Backdrop.svelte';
export { default as StageEmpty } from './components/StageEmpty.svelte';
export { default as Empty } from './components/Empty.svelte';
export { default as Chrome } from './components/Chrome.svelte';

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
} from './state/hooks.svelte';

export { ViewApi } from './state/view-api.svelte';
export { WorkspaceModel } from './state/workspace-model.svelte';
export type { WorkspaceHandle, WorkspaceSnapshot } from './state/workspace-model.svelte';

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

export { layout, createDocument, emptyDocument, sanitize, normalize } from './utils/document';

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
} from './utils/document';
