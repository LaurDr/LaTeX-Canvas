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
import {
	PLACEHOLDER,
	placeholderOffsets,
	previewLatex,
	SLOT_CLASS_PREFIX,
	tagPlaceholders,
} from '../math/latex';
import {
	CATEGORIES,
	MathTemplate,
	MatrixKind,
	matrixTemplate,
	MAX_MATRIX_SIZE,
	SLOT,
} from '../math/templates';

export const PALETTE_VIEW_TYPE = 'latex-canvas-palette';

/** The equation under the cursor, as shown in the palette's preview. */
export interface PreviewedEquation {
	source: string;
	// Offset of `source` in the note, used to map preview slots back to it.
	contentFrom: number;
	selectionFrom: number;
	selectionTo: number;
}

interface PreviewSlot {
	el: HTMLElement;
	// Offset of the placeholder within the equation's source.
	offset: number;
}

/**
 * Sidebar palette (in the spirit of Grapher's equation palette): a grid of
 * rendered templates that insert LaTeX into the active note, plus a live
 * preview of the equation under the cursor whose empty slots can be clicked.
 */
export class PaletteView extends ItemView {
	private previewEl?: HTMLElement;
	private sourceEl?: HTMLElement;
	private equation: PreviewedEquation | null = null;
	private shownSource: string | null | undefined;
	private slots: PreviewSlot[] = [];
	private matrixSize = { rows: 2, columns: 2 };

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
		this.keepEditorFocus(this.previewEl);
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
			if ('matrices' in category) {
				this.drawMatrices(details, category.matrices);
			} else {
				const grid = details.createDiv({
					cls: category.wide ? 'latex-canvas-grid mod-wide' : 'latex-canvas-grid',
				});
				for (const template of category.templates) {
					this.drawButton(grid, template);
				}
			}
		}
		await finishRenderMath();

		this.showEquation(null);
	}

	/** Shows the equation under the cursor, or a hint when there is none. */
	showEquation(equation: PreviewedEquation | null): void {
		if (!this.previewEl || !this.sourceEl) return;

		this.equation = equation;
		const source = equation?.source.trim() ? equation.source : null;
		if (source !== this.shownSource) {
			this.shownSource = source;
			this.renderPreview(this.previewEl, this.sourceEl, source);
		}
		this.highlightSelectedSlot();
	}

	private renderPreview(
		previewEl: HTMLElement,
		sourceEl: HTMLElement,
		source: string | null,
	): void {
		previewEl.empty();
		this.slots = [];

		if (source === null) {
			previewEl.setText('Click inside an equation to preview it here.');
			sourceEl.setText('');
			return;
		}

		let math = renderMath(tagPlaceholders(source), true);
		if (math.querySelector('mjx-merror, [data-mml-node="merror"]')) {
			// The equation has an error (or tagging is unsupported): show it
			// as is, without clickable slots.
			math = renderMath(source, true);
		} else {
			placeholderOffsets(source).forEach((offset, n) => {
				const el = math.querySelector<HTMLElement>(`.${SLOT_CLASS_PREFIX}${n}`);
				if (!el) return;
				el.addClass('latex-canvas-slot');
				el.addEventListener('click', () => this.selectSlot(offset));
				this.slots.push({ el, offset });
			});
		}
		previewEl.appendChild(math);
		if (this.slots.length > 0) {
			previewEl.createDiv({
				cls: 'latex-canvas-hint',
				text: 'Click a box to fill it in.',
			});
		}
		sourceEl.setText(source);
		void finishRenderMath();
	}

	/** Selects the placeholder at `offset` (within the equation) in the note. */
	private selectSlot(offset: number): void {
		const equation = this.equation;
		if (!equation) return;

		this.withEditor((editor) => {
			const from = editor.offsetToPos(equation.contentFrom + offset);
			const to = editor.offsetToPos(equation.contentFrom + offset + PLACEHOLDER.length);
			if (editor.getRange(from, to) !== PLACEHOLDER) {
				new Notice('The equation has changed. Click the box again.');
				return;
			}
			editor.setSelection(from, to);
			editor.focus();
		});
	}

	private highlightSelectedSlot(): void {
		const equation = this.equation;
		for (const slot of this.slots) {
			const from = equation ? equation.contentFrom + slot.offset : -1;
			slot.el.toggleClass(
				'is-selected',
				equation?.selectionFrom === from &&
					equation.selectionTo === from + PLACEHOLDER.length,
			);
		}
	}

	/**
	 * A size picker (click a cell to choose rows × columns) and one
	 * button per bracket style, which inserts a matrix of the chosen size.
	 */
	private drawMatrices(parent: HTMLElement, kinds: MatrixKind[]): void {
		const picker = parent.createDiv({ cls: 'latex-canvas-size-picker' });
		const sizeLabel = picker.createDiv({ cls: 'latex-canvas-size-label' });
		const grid = picker.createDiv({ cls: 'latex-canvas-size-grid' });
		grid.setCssProps({ '--latex-canvas-size': String(MAX_MATRIX_SIZE) });
		this.keepEditorFocus(grid);

		const cells: { el: HTMLElement; row: number; column: number }[] = [];
		const paint = (rows: number, columns: number) => {
			for (const cell of cells) {
				cell.el.toggleClass('is-selected', cell.row <= rows && cell.column <= columns);
			}
			sizeLabel.setText(`Size: ${rows} × ${columns} (rows × columns)`);
		};

		for (let row = 1; row <= MAX_MATRIX_SIZE; row++) {
			for (let column = 1; column <= MAX_MATRIX_SIZE; column++) {
				const el = grid.createDiv({
					cls: 'latex-canvas-size-cell',
					attr: { 'aria-label': `${row} × ${column}` },
				});
				el.addEventListener('click', () => {
					this.matrixSize = { rows: row, columns: column };
					paint(row, column);
				});
				cells.push({ el, row, column });
			}
		}
		paint(this.matrixSize.rows, this.matrixSize.columns);

		const buttons = parent.createDiv({ cls: 'latex-canvas-grid mod-wide' });
		for (const kind of kinds) {
			this.drawButton(buttons, matrixTemplate(kind, 2, 2), () =>
				matrixTemplate(kind, this.matrixSize.rows, this.matrixSize.columns),
			);
		}
	}

	/**
	 * Draws a button showing `template`. Clicking inserts `insert()`, which
	 * defaults to the template itself (matrices insert the picked size).
	 */
	private drawButton(
		parent: HTMLElement,
		template: MathTemplate,
		insert: () => MathTemplate = () => template,
	): void {
		const button = parent.createEl('button', { cls: 'latex-canvas-button' });
		// Braces make the preview one unit, which MathJax 4 never line-breaks.
		const preview = `{${previewLatex(template.latex, template.placeholder)}}`;
		button.appendChild(renderMath(preview, false));
		// Show the code behind each button so users pick up LaTeX as they go.
		const code = template.latex.split(SLOT).join('…');
		setTooltip(button, template.label === template.latex ? code : `${template.label}: ${code}`);

		this.keepEditorFocus(button);
		button.addEventListener('click', () =>
			this.withEditor((editor) => insertTemplate(editor, insert())),
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
