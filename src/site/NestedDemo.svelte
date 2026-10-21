<script lang="ts">
	import { Workspace, ViewType, Split, Panel, Stage, View } from '#lib/index';
</script>

<div class="nested-wrapper">
	<Workspace theme="dark">
		<ViewType id="sub_a" title="Sub-Pane A">
			{#snippet render()}
				<div class="sub-view">
					<strong>Sub-Pane A (Nested)</strong>
					<p class="text-secondary text-body-sm">
						This is an independent <code>&lt;Workspace&gt;</code> running recursively inside a view!
					</p>
				</div>
			{/snippet}
		</ViewType>

		<ViewType id="sub_b" title="Sub-Pane B">
			{#snippet render()}
				<div class="sub-view">
					<strong>Sub-Pane B (Nested)</strong>
					<p class="text-secondary text-body-sm">
						True fractal panes: splits within splits within workspaces.
					</p>
				</div>
			{/snippet}
		</ViewType>

		<Split axis="y" weights={[0.5, 0.5]}>
			<Panel id="sub_panel_1">
				<View type="sub_a" />
			</Panel>
			<Stage id="sub_stage">
				<View type="sub_b" />
			</Stage>
		</Split>
	</Workspace>
</div>

<style>
	.nested-wrapper {
		width: 100%;
		height: 100%;
		min-height: 200px;
		display: flex;
		overflow: hidden;
	}

	.sub-view {
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
</style>
