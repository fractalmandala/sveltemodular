<script lang="ts">
	import {
		Workspace,
		ViewType,
		Split,
		Panel,
		View,
		Stage,
		Floating,
		Chrome,
		type WorkspaceHandle,
		type Theme
	} from '#lib/index';
	import DemoPage from '$site/DemoPage.svelte';
	import NestedDemo from '$site/NestedDemo.svelte';
	import { mode } from '$site/mode/mode.svelte';

	const themeStore = mode();

	let ws = $state<WorkspaceHandle | null>(null);
	let showSplitRatio = $state(true);
	let disableDragAndDrop = $state(false);

	let currentTheme = $derived<Theme>(themeStore.resolved === 'dark' ? 'dark' : 'light');

	let noteCount = $state(1);
	let currentPreset = $state<'ide' | 'studio' | 'quad' | 'free' | null>(null);

	function openNewNote() {
		if (!ws) return;
		const id = `note_${noteCount++}`;
		ws.open('editor', {
			id,
			title: `Note ${noteCount}`,
			params: { created: Date.now() }
		});
	}

	function openTerminal() {
		if (!ws) return;
		ws.open('terminal', { title: 'Terminal', placement: 'stage' });
	}

	function applyPreset(name: 'ide' | 'studio' | 'quad' | 'free') {
		if (!ws) return;
		currentPreset = name;
		if (name === 'ide') {
			ws.adopt({
				schema: 1,
				root: {
					kind: 'split',
					id: 'split_root',
					axis: 'x',
					weights: [0.25, 0.5, 0.25],
					children: [
						{
							kind: 'panel',
							id: 'sidebar_panel',
							views: ['intro', 'files'],
							selected: 'intro'
						},
						{
							kind: 'stage',
							id: 'main_stage',
							child: {
								kind: 'split',
								id: 'stage_split',
								axis: 'y',
								weights: [0.65, 0.35],
								children: [
									{ kind: 'panel', id: 'editor_panel', views: ['editor'], selected: 'editor' },
									{
										kind: 'panel',
										id: 'terminal_panel',
										views: ['terminal'],
										selected: 'terminal'
									}
								]
							}
						},
						{
							kind: 'panel',
							id: 'tools_panel',
							views: ['architecture', 'document'],
							selected: 'architecture'
						}
					]
				},
				floating: [],
				hidden: [],
				views: {
					intro: { type: 'intro', title: 'Getting Started' },
					files: { type: 'usage', title: 'Usage' },
					editor: { type: 'editor', title: 'Editor' },
					terminal: { type: 'terminal', title: 'Terminal' },
					architecture: { type: 'architecture', title: 'Comparison' },
					document: { type: 'document', title: 'State Inspector' }
				}
			});
		} else if (name === 'studio') {
			ws.adopt({
				schema: 1,
				root: {
					kind: 'split',
					id: 'studio_root',
					axis: 'x',
					weights: [0.5, 0.5],
					children: [
						{ kind: 'panel', id: 'p_left', views: ['editor'], selected: 'editor' },
						{
							kind: 'stage',
							id: 'p_stage',
							child: { kind: 'panel', id: 'p_right', views: ['nested'], selected: 'nested' }
						}
					]
				},
				floating: [],
				hidden: [],
				views: {
					editor: { type: 'editor', title: 'Editor' },
					nested: { type: 'nested', title: 'Fractal Preview' }
				}
			});
		} else if (name === 'quad') {
			ws.adopt({
				schema: 1,
				root: {
					kind: 'split',
					id: 'quad_root',
					axis: 'x',
					weights: [0.5, 0.5],
					children: [
						{
							kind: 'split',
							id: 'quad_l',
							axis: 'y',
							weights: [0.5, 0.5],
							children: [
								{ kind: 'panel', id: 'qp1', views: ['intro'], selected: 'intro' },
								{ kind: 'panel', id: 'qp2', views: ['editor'], selected: 'editor' }
							]
						},
						{
							kind: 'split',
							id: 'quad_r',
							axis: 'y',
							weights: [0.5, 0.5],
							children: [
								{ kind: 'panel', id: 'qp3', views: ['architecture'], selected: 'architecture' },
								{ kind: 'panel', id: 'qp4', views: ['terminal'], selected: 'terminal' }
							]
						}
					]
				},
				floating: [],
				hidden: [],
				views: {
					intro: { type: 'intro', title: 'Intro' },
					editor: { type: 'editor', title: 'Code' },
					architecture: { type: 'architecture', title: 'Architecture' },
					terminal: { type: 'terminal', title: 'Console' }
				}
			});
		} else if (name === 'free') {
			ws.adopt({
				schema: 1,
				root: {
					kind: 'split',
					id: 'quad_root',
					axis: 'x',
					weights: [0.5, 0.5],
					children: [
						{
							kind: 'split',
							id: 'quad_l',
							axis: 'y',
							weights: [0.5, 0.5],
							children: [
								{ kind: 'panel', id: 'qp1', views: ['intro'], selected: 'intro' },
								{ kind: 'panel', id: 'qp2', views: ['editor'], selected: 'editor' }
							]
						},
						{
							kind: 'split',
							id: 'quad_r',
							axis: 'y',
							weights: [0.5, 0.5],
							children: [
								{ kind: 'panel', id: 'qp3', views: ['architecture'], selected: 'architecture' },
								{ kind: 'panel', id: 'qp4', views: ['terminal'], selected: 'terminal' }
							]
						}
					]
				},
				floating: [],
				hidden: [],
				views: {
					intro: { type: 'intro', title: 'Intro' },
					editor: { type: 'editor', title: 'Code' },
					architecture: { type: 'architecture', title: 'Architecture' },
					terminal: { type: 'terminal', title: 'Console' }
				}
			});
		}
	}
</script>

<div class="demo-layout">
	<!-- Control Toolbar -->
	<aside class="demo-sidebar box gap-bs py-md px-md">
		<div class="sidebar-section box gap-sm">
			<span class="nav-header text-xs text-secondary font-bold">PRESETS</span>
			<div class="row buttons-row" role="group">
				<button
					class="ingroup"
					class:selected={currentPreset === 'ide'}
					onclick={() => applyPreset('ide')}
				>
					IDE
				</button>
				<button
					class="ingroup"
					class:selected={currentPreset === 'studio'}
					onclick={() => applyPreset('studio')}
				>
					Studio
				</button>
				<button
					class="ingroup"
					class:selected={currentPreset === 'quad'}
					onclick={() => applyPreset('quad')}
				>
					Quad
				</button>
				<button
					class="ingroup"
					class:selected={currentPreset === 'free'}
					onclick={() => applyPreset('free')}
				>
					Freestyle
				</button>
			</div>
		</div>

		<div class="sidebar-section box gap-sm">
			<span class="nav-header text-xs text-secondary font-bold">ACTIONS</span>
			<div class="box gap-xs">
				<button class="btn btn-sm" onclick={openNewNote}>+ Open New Note</button>
				<button class="btn btn-sm" onclick={openTerminal}>+ Open Terminal</button>
				<button class="btn btn-sm" onclick={() => ws?.open('nested', { title: 'Fractal' })}>
					+ Open Nested
				</button>
				<button class="btn btn-sm" onclick={() => ws?.toggleMaximize()}>
					Toggle Maximize (Mod+Alt+M)
				</button>
				<button class="btn btn-sm" onclick={() => ws?.focusedView && ws.openPopout(ws.focusedView)}>
					Popout Focused View
				</button>
				<button class="btn btn-sm" onclick={() => ws?.reset()}>Reset Workspace</button>
			</div>
		</div>

		<div class="sidebar-section box gap-sm">
			<span class="nav-header text-xs text-secondary font-bold">OPTIONS</span>
			<label class="row gap-xs ycenter text-xs">
				<input type="checkbox" bind:checked={showSplitRatio} />
				Show Split Ratio %
			</label>
			<label class="row gap-xs ycenter text-xs">
				<input type="checkbox" bind:checked={disableDragAndDrop} />
				Disable Drag & Drop
			</label>
		</div>

		<div class="sidebar-section box gap-xs text-xs text-secondary">
			<strong>Tips:</strong>
			<span>• Drag tabs to reorder</span>
			<span>• Drag to edge to split</span>
			<span>• Click ⧉ for Popout</span>
			<span>• Click □ to Maximize</span>
		</div>
	</aside>

	<!-- Main Workspace Area -->
	<div class="workspace-area">
		<Workspace
			bind:workspace={ws}
			theme={currentTheme}
			{showSplitRatio}
			{disableDragAndDrop}
			storageKey="sveltemodular-demo-v1"
		>
			<ViewType id="intro" title="Getting Started">
				<DemoPage kind="intro" model={() => ws} />
			</ViewType>

			<ViewType id="usage" title="Usage">
				<DemoPage kind="usage" model={() => ws} />
			</ViewType>

			<ViewType id="architecture" title="Comparison">
				<DemoPage kind="architecture" model={() => ws} />
			</ViewType>

			<ViewType id="document" title="Document Inspector">
				<DemoPage kind="document" model={() => ws} />
			</ViewType>

			<ViewType id="editor" title="Editor" placement="stage">
				<DemoPage kind="editor" model={() => ws} />
			</ViewType>

			<ViewType id="terminal" title="Terminal">
				<DemoPage kind="terminal" model={() => ws} />
			</ViewType>

			<ViewType id="nested" title="Nested Fractal">
				<NestedDemo />
			</ViewType>

			<!-- Default layout on first run -->
			<Split axis="x" weights={[0.28, 0.46, 0.26]}>
				<Panel id="sidebar_nav">
					<View type="intro" />
					<View type="usage" />
				</Panel>

				<Stage id="stage_main">
					<View type="editor" />
				</Stage>

				<Panel id="sidebar_inspect">
					<View type="architecture" />
					<View type="document" />
					<View type="terminal" />
				</Panel>
			</Split>

			<Floating rect={{ x: 0.64, y: 0.6, w: 0.32, h: 0.34 }}>
				<Panel id="float_quick">
					<View type="terminal" />
				</Panel>
			</Floating>

			<Chrome>
				<div class="chrome-pill">
					sveltemodular • active view: {ws?.focusedView ?? 'none'}
				</div>
			</Chrome>
		</Workspace>
	</div>
</div>
