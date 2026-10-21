<script lang="ts" module>
	export type PageKind = 'intro' | 'usage' | 'architecture' | 'document' | 'editor' | 'terminal';
</script>

<script lang="ts">
	import type { WorkspaceHandle } from '#lib/index';

	let {
		kind,
		model
	}: {
		kind: PageKind;
		model: () => WorkspaceHandle | null;
	} = $props();

	let editorContent = $state(`// Svelte 5 Runes Example
import { Workspace, ViewType, Split, Panel, Stage } from 'sveltemodular';
import '#lib/style.css';

let ws = $state(null);

function addNote() {
  ws?.open('notes', { params: { title: 'New Note' } });
}
`);

	let terminalInput = $state('');
	let terminalLines = $state<string[]>([
		'sveltemodular v0.1.0 ready',
		'Type "help" or click layout action buttons in the sidebar.'
	]);

	function handleTerminalSubmit(e: KeyboardEvent) {
		if (e.key === 'Enter' && terminalInput.trim()) {
			const cmd = terminalInput.trim();
			terminalLines = [...terminalLines, `$ ${cmd}`];
			if (cmd === 'help') {
				terminalLines = [
					...terminalLines,
					'Available commands: open <type>, float, maximize, popout, clear'
				];
			} else if (cmd.startsWith('open ')) {
				const type = cmd.split(' ')[1];
				const w = model();
				if (w) {
					w.open(type);
					terminalLines = [...terminalLines, `Opened view of type "${type}".`];
				}
			} else if (cmd === 'clear') {
				terminalLines = [];
			} else {
				terminalLines = [...terminalLines, `Unknown command: ${cmd}. Type "help" for info.`];
			}
			terminalInput = '';
		}
	}

	const usageCode = `<script lang="ts">
  import {
    Workspace,
    ViewType,
    Split,
    Panel,
    View,
    Stage,
    type WorkspaceHandle
  } from 'sveltemodular';
  import 'sveltemodular/style.css';

  let ws = $state<WorkspaceHandle | null>(null);
</${'script'}>

<Workspace bind:workspace={ws} theme="dark">
  <ViewType id="editor" title="Editor" placement="stage">
    {#snippet render()}
      <textarea class="editor"></textarea>
    {/snippet}
  </ViewType>

  <ViewType id="terminal" title="Terminal">
    {#snippet render()}
      <div class="terminal">Terminal Output</div>
    {/snippet}
  </ViewType>

  <Split axis="x" weights={[0.65, 0.35]}>
    <Stage id="main">
      <View type="editor" />
    </Stage>
    <Panel id="sidebar">
      <View type="terminal" />
    </Panel>
  </Split>
</Workspace>`;
</script>

<div class="page-container">
	{#if kind === 'intro'}
		<div class="intro-box">
			<h2 class="text-heading-lg">Interactive Fractal Workspace</h2>
			<p class="text-secondary text-body">
				Every panel is a tab group rendered recursively as a pure Svelte 5 <code>$state</code> tree.
			</p>

			<div class="feature-grid">
				<div class="feature-card">
					<div class="feature-icon">⇄</div>
					<strong>Drag & Drop Docking</strong>
					<p class="text-secondary text-body-sm">
						Drag tabs to reorder them, or drag to any pane edge (top, bottom, left, right) with
						visual overlays to split dynamically.
					</p>
				</div>
				<div class="feature-card">
					<div class="feature-icon">⧉</div>
					<strong>Detached Popouts</strong>
					<p class="text-secondary text-body-sm">
						Click the <code>⧉</code> icon in any tab bar to pop the view into an independent OS browser
						window.
					</p>
				</div>
				<div class="feature-card">
					<div class="feature-icon">❐</div>
					<strong>View Maximization</strong>
					<p class="text-secondary text-body-sm">
						Click <code>□</code> or press <kbd>Mod+Alt+M</kbd> to toggle a pane to full-bleed view and
						back.
					</p>
				</div>
				<div class="feature-card">
					<div class="feature-icon">❖</div>
					<strong>Fractalstyler & Tokens</strong>
					<p class="text-secondary text-body-sm">
						Strictly adheres to Fractalstyler design tokens, 4px/8px max border radius, and theme
						modes.
					</p>
				</div>
			</div>
		</div>
	{:else if kind === 'usage'}
		<div class="code-box">
			<p class="text-secondary text-body-sm">Declarative DSL in Svelte 5:</p>
			<pre><code>{usageCode}</code></pre>
		</div>
	{:else if kind === 'architecture'}
		<div class="arch-box">
			<h3 class="text-heading-md">Architecture Comparison</h3>
			<table class="arch-table">
				<thead>
					<tr>
						<th>Dimension</th>
						<th>trellis-svelte</th>
						<th>sveltefractals</th>
						<th>sveltemodular</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Reactivity</td>
						<td>Imperative DOM Core</td>
						<td>Custom Runes tree</td>
						<td><strong>Pure Svelte 5 Runes ($state)</strong></td>
					</tr>
					<tr>
						<td>Tab DnD Docking</td>
						<td>Underlying core</td>
						<td>HTML5 DnD</td>
						<td><strong>5-Zone Edge Drop Overlays</strong></td>
					</tr>
					<tr>
						<td>Popout Windows</td>
						<td>No</td>
						<td>Yes</td>
						<td><strong>Auto-synced Popout Windows</strong></td>
					</tr>
					<tr>
						<td>Declarative DSL</td>
						<td>Wrapper</td>
						<td>Flat config</td>
						<td><strong>Full &lt;Workspace&gt; DSL</strong></td>
					</tr>
					<tr>
						<td>License</td>
						<td>Commercial restrictions</td>
						<td>Internal</td>
						<td><strong>MIT</strong></td>
					</tr>
				</tbody>
			</table>
		</div>
	{:else if kind === 'document'}
		<div class="doc-box">
			<p class="text-secondary text-body-sm">
				Live serializable <code>LayoutDocument</code> state:
			</p>
			<pre><code>{JSON.stringify(model()?.getDocument() ?? {}, null, 2)}</code></pre>
		</div>
	{:else if kind === 'editor'}
		<div class="editor-box">
			<textarea class="editor-textarea" bind:value={editorContent} spellcheck="false"></textarea>
		</div>
	{:else if kind === 'terminal'}
		<div class="terminal-box">
			<div class="terminal-output">
				{#each terminalLines as line, i (i)}
					<div class="terminal-line">{line}</div>
				{/each}
			</div>
			<div class="terminal-input-row">
				<span class="prompt">$</span>
				<input
					class="terminal-input"
					type="text"
					bind:value={terminalInput}
					placeholder="Type command..."
					onkeydown={handleTerminalSubmit}
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	.page-container {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 12px;
		overflow: auto;
		display: flex;
		flex-direction: column;
	}

	.intro-box,
	.arch-box,
	.code-box,
	.doc-box {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 8px;
		margin-top: 8px;
	}

	.feature-card {
		padding: 10px;
		background: var(--modular-tab-hover);
		border-radius: var(--modular-radius);
		border: 1px solid var(--modular-border);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.feature-icon {
		font-size: 16px;
		color: var(--modular-accent);
	}

	.arch-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 11.5px;
		margin-top: 8px;
	}

	.arch-table th,
	.arch-table td {
		padding: 6px 10px;
		border: 1px solid var(--modular-border);
		text-align: left;
	}

	.arch-table th {
		background: var(--modular-tabbar);
	}

	pre {
		margin: 0;
		padding: 10px;
		background: var(--modular-bg);
		border: 1px solid var(--modular-border);
		border-radius: var(--modular-radius);
		overflow: auto;
		font-family: ui-monospace, monospace;
		font-size: 11px;
		line-height: 1.45;
	}

	.editor-box {
		width: 100%;
		height: 100%;
		display: flex;
	}

	.editor-textarea {
		width: 100%;
		height: 100%;
		border: none;
		outline: none;
		resize: none;
		background: transparent;
		color: inherit;
		font-family: ui-monospace, monospace;
		font-size: 12px;
		line-height: 1.5;
	}

	.terminal-box {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: #0d0e11;
		color: #22c55e;
		font-family: ui-monospace, monospace;
		font-size: 12px;
		padding: 8px;
		border-radius: var(--modular-radius);
	}

	.terminal-output {
		flex: 1 1 0%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.terminal-input-row {
		display: flex;
		align-items: center;
		gap: 6px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding-top: 6px;
	}

	.terminal-input {
		flex: 1 1 0%;
		background: transparent;
		border: none;
		outline: none;
		color: #f4f4f6;
		font-family: inherit;
		font-size: inherit;
	}
</style>
