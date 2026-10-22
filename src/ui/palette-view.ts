import {
	Editor,
	finishRenderMath,
	ItemView,
	loadMathJax,
	MarkdownView,
	Notice,
	renderMath,
	setTooltip,
} from 'obsidian';
import { insertTemplate, selectNextPlaceholder } from '../math/editor-actions';
import { previewLatex } from '../math/latex';
import { CATEGORIES, MathTemplate, SLOT } from '../math/templates';

export const PALETTE_VIEW_TYPE = 'latex-canvas-palette';

/**
 * Sidebar palette (in the spirit of Grapher's equation palette): a grid of
 * rendered templates that insert LaTeX into the active note, plus a live
 * preview of the equation under the cursor.
 */
export class PaletteView extends ItemView {
	private previewEl?: HTMLElement;
	private sourceEl?: HTMLElement;
	private shownSource: string | null | undefined;

	getViewType(): string {
		return PALETTE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Equation palette';
	}

	getIcon(): string {
		return 'sigma';
	}

	async onOpen(): Promise<void> {
		await loadMathJax();

		const root = this.contentEl;
		root.empty();
		root.addClass('latex-canvas-palette');

		const current = root.createDiv({ cls: 'latex-canvas-current' });
		this.previewEl = current.createDiv({ cls: 'latex-canvas-current-preview' });
		this.sourceEl = current.createEl('code', { cls: 'latex-canvas-current-source' });
		const nextButton = current.createEl('button', { text: 'Next empty slot' });
		this.keepEditorFocus(nextButton);
		nextButton.addEventListener('click', () =>
			this.withEditor((editor) => {
				if (!selectNextPlaceholder(editor)) {
					new Notice('No empty slot left in this equation.');
				}
			}),
		);

		for (const category of CATEGORIES) {
			const details = root.createEl('details', { cls: 'latex-canvas-category' });
			details.open = true;
			details.createEl('summary', { text: category.name });
			const grid = details.createDiv({ cls: 'latex-canvas-grid' });
			for (const template of category.templates) {
				this.drawButton(grid, template);
			}
		}
		await finishRenderMath();

		this.showEquation(null);
	}

	/** Shows the LaTeX `source` of the equation under the cursor, or a hint. */
	showEquation(source: string | null): void {
		if (!this.previewEl || !this.sourceEl || source === this.shownSource) {
			return;
		}
		this.shownSource = source;
		this.previewEl.empty();

		if (source === null || source.trim() === '') {
			this.previewEl.setText('Click inside an equation to preview it here.');
			this.sourceEl.setText('');
			return;
		}
		this.previewEl.appendChild(renderMath(source, true));
		this.sourceEl.setText(source);
		void finishRenderMath();
	}

	private drawButton(parent: HTMLElement, template: MathTemplate): void {
		const button = parent.createEl('button', { cls: 'latex-canvas-button' });
		button.appendChild(renderMath(previewLatex(template.latex, template.placeholder), false));
		// Show the code behind each button so users pick up LaTeX as they go.
		const code = template.latex.split(SLOT).join('…');
		setTooltip(button, template.label === template.latex ? code : `${template.label}: ${code}`);

		this.keepEditorFocus(button);
		button.addEventListener('click', () =>
			this.withEditor((editor) => insertTemplate(editor, template)),
		);
	}

	/** Clicking the palette must not steal the note's cursor and selection. */
	private keepEditorFocus(el: HTMLElement): void {
		el.addEventListener('mousedown', (evt) => evt.preventDefault());
	}

	private withEditor(fn: (editor: Editor) => void): void {
		const view = this.app.workspace.getMostRecentLeaf()?.view;
		if (view instanceof MarkdownView) {
			fn(view.editor);
		} else {
			new Notice('Open a note to insert math.');
		}
	}
}
