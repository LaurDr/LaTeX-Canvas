import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { debounce, Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { selectNextPlaceholder } from './math/editor-actions';
import { findMathAt } from './math/latex';
import { PALETTE_VIEW_TYPE, PaletteView } from './ui/palette-view';

export default class LatexCanvasPlugin extends Plugin {
	async onload() {
		this.registerView(PALETTE_VIEW_TYPE, (leaf) => new PaletteView(leaf));

		this.addRibbonIcon('sigma', 'Open equation palette', () => {
			void this.openPalette();
		});

		this.addCommand({
			id: 'open-palette',
			name: 'Open equation palette',
			callback: () => {
				void this.openPalette();
			},
		});

		// No default hotkey: typing-first users keep their keyboard untouched.
		this.addCommand({
			id: 'select-next-placeholder',
			name: 'Select next empty slot in equation',
			editorCallback: (editor) => {
				if (!selectNextPlaceholder(editor)) {
					new Notice('No empty slot left in this equation.');
				}
			},
		});

		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu) => {
				menu.addItem((item) =>
					item
						.setTitle('Equation palette')
						.setIcon('sigma')
						.onClick(() => {
							void this.openPalette();
						}),
				);
			}),
		);

		// Keep the palette's preview in sync with the equation under the cursor.
		this.registerEditorExtension(
			EditorView.updateListener.of((update) => {
				if (update.docChanged || update.selectionSet) {
					this.updatePreview(update.state);
				}
			}),
		);
	}

	private readonly updatePreview = debounce(
		(state: EditorState) => {
			const views = this.app.workspace
				.getLeavesOfType(PALETTE_VIEW_TYPE)
				.map((leaf) => leaf.view)
				.filter((view) => view instanceof PaletteView);
			if (views.length === 0) return;

			const doc = state.doc.toString();
			const { from, to, head } = state.selection.main;
			const region = findMathAt(doc, head);
			const equation = region && {
				source: doc.slice(region.contentFrom, region.contentTo),
				contentFrom: region.contentFrom,
				selectionFrom: from,
				selectionTo: to,
			};
			views.forEach((view) => view.showEquation(equation));
		},
		150,
		true,
	);

	private async openPalette(): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null | undefined =
			workspace.getLeavesOfType(PALETTE_VIEW_TYPE)[0];
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: PALETTE_VIEW_TYPE, active: true });
		}
		if (leaf) {
			await workspace.revealLeaf(leaf);
		}
	}
}
