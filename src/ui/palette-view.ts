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
import { caretAnchor, leaves, MappedElement, mapRenderedSource } from './source-map';

export const PALETTE_VIEW_TYPE = 'latex-canvas-palette';

/** The equation under the cursor, as shown in the palette's preview. */
export interface PreviewedEquation {
	source: string;
	// Offset of `source` in the note, used to map preview slots back to it.
	contentFrom: number;
	selectionFrom: number;
	selectionTo: number;
}

/**
 * Sidebar palette (in the spirit of Grapher's equation palette): a grid of
 * rendered templates that insert LaTeX into the active note, plus a live
 * preview of the equation under the cursor.
 *
 * The note stays the only copy of the equation: clicking the preview moves
 * the note's cursor (and keeps the keyboard in the note), and the preview
 * draws a caret wherever that cursor is. Typing, arrows and backspace are
 * ordinary Obsidian editing, so the sidebar and the note never disagree.
 */
export class PaletteView extends ItemView {
	private previewEl?: HTMLElement;
	private sourceEl?: HTMLElement;
	private caretEl?: HTMLElement;
	private selectionEls: HTMLElement[] = [];
	private equation: PreviewedEquation | null = null;
	private shownSource: string | null | undefined;
	// Rendered symbols and their source ranges (relative to the equation).
	private symbols: MappedElement[] = [];
	// Every mapped element, including compound ones like a whole fraction.
	private mapped = new Map<HTMLElement, MappedElement>();
	// Whether symbols can be mapped (MathJax 4), so the cursor can be placed.
	private canPlaceCursor = false;
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
		// Capture phase: the preview handles clicks itself, before MathJax 4's
		// own handlers on the rendered math (which would take the focus).
		this.previewEl.addEventListener(
			'mousedown',
			(evt) => {
				evt.preventDefault();
				evt.stopPropagation();
			},
			{ capture: true },
		);
		this.previewEl.addEventListener('click', (evt) => this.onPreviewClick(evt), {
			capture: true,
		});
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
		this.showSelection();
	}

	private renderPreview(
		previewEl: HTMLElement,
		sourceEl: HTMLElement,
		source: string | null,
	): void {
		previewEl.empty();
		this.selectionEls = [];
		this.symbols = [];
		this.mapped.clear();
		this.canPlaceCursor = false;

		if (source === null) {
			previewEl.setText('Click inside an equation to preview it here.');
			sourceEl.setText('');
			return;
		}

		let math = renderMath(source, true);
		const ranges = mapRenderedSource(math, source);
		if (ranges) {
			this.canPlaceCursor = true;
			for (const [el, range] of ranges) this.mapped.set(el, { el, range });
			this.symbols = leaves(ranges);
		} else {
			// No source labels (MathJax 3): only the boxes can be clicked,
			// found through classes added to the source.
			math = this.renderTaggedPlaceholders(source);
		}
		for (const symbol of this.symbols) {
			if (source.slice(symbol.range.from, symbol.range.to) === PLACEHOLDER) {
				symbol.el.addClass('latex-canvas-slot');
			}
		}

		previewEl.appendChild(math);
		this.caretEl = previewEl.createDiv({ cls: 'latex-canvas-caret' });
		const hasSlots = this.symbols.some((s) => s.el.hasClass('latex-canvas-slot'));
		if (this.canPlaceCursor || hasSlots) {
			previewEl.createDiv({
				cls: 'latex-canvas-hint',
				text: this.canPlaceCursor
					? 'Click to place the cursor, then type. Click a box to fill it in.'
					: 'Click a box to fill it in.',
			});
		}
		sourceEl.setText(source);
		void finishRenderMath();
	}

	/** Renders `source` with each placeholder tagged so it can be found. */
	private renderTaggedPlaceholders(source: string): HTMLElement {
		const math = renderMath(tagPlaceholders(source), true);
		if (math.querySelector('mjx-merror, [data-mml-node="merror"]')) {
			// The equation has an error (or tagging is unsupported).
			return renderMath(source, true);
		}
		placeholderOffsets(source).forEach((offset, n) => {
			const el = math.querySelector<HTMLElement>(`.${SLOT_CLASS_PREFIX}${n}`);
			if (!el) return;
			const symbol = { el, range: { from: offset, to: offset + PLACEHOLDER.length } };
			this.symbols.push(symbol);
			this.mapped.set(el, symbol);
		});
		return math;
	}

	/**
	 * A click on a box selects it; a click anywhere else in the equation puts
	 * the note's cursor before or after the clicked symbol (by which half of
	 * it was clicked).
	 */
	private onPreviewClick(evt: MouseEvent): void {
		evt.stopPropagation();
		const source = this.shownSource;
		// `targetNode`/`instanceOf` also work when the palette is in a popout window.
		const target = evt.targetNode;
		let el = target?.instanceOf(HTMLElement) ? target : target?.parentElement ?? null;
		while (el && el !== this.previewEl && !this.mapped.has(el)) el = el.parentElement;
		const symbol = el && this.mapped.get(el);
		if (!symbol || source == null) return;

		const { from, to } = symbol.range;
		if (source.slice(from, to) === PLACEHOLDER) {
			this.selectInNote(from, to);
		} else if (this.canPlaceCursor) {
			const rect = symbol.el.getBoundingClientRect();
			const offset = evt.clientX < rect.left + rect.width / 2 ? from : to;
			this.selectInNote(offset, offset);
		}
	}

	/** Selects `from`..`to` (offsets within the equation) in the note. */
	private selectInNote(from: number, to: number): void {
		const equation = this.equation;
		if (!equation) return;

		this.withEditor((editor) => {
			const start = editor.offsetToPos(equation.contentFrom);
			const end = editor.offsetToPos(equation.contentFrom + equation.source.length);
			if (editor.getRange(start, end) !== equation.source) {
				new Notice('The equation has changed. Click again.');
				return;
			}
			editor.setSelection(
				editor.offsetToPos(equation.contentFrom + from),
				editor.offsetToPos(equation.contentFrom + to),
			);
			editor.focus();
		});
	}

	/** Mirrors the note's selection: shaded symbols, or a caret. */
	private showSelection(): void {
		const previewEl = this.previewEl;
		const caret = this.caretEl;
		if (!previewEl || !caret) return;
		const equation = this.equation;
		const from = equation ? equation.selectionFrom - equation.contentFrom : -1;
		const to = equation ? equation.selectionTo - equation.contentFrom : -1;

		// Shade the outermost elements inside the selection, so a fully
		// selected fraction is shaded as a whole (bar included). Shading is
		// drawn on top: backgrounds on MathJax's inline elements only cover
		// part of a glyph's height.
		this.selectionEls.forEach((el) => el.remove());
		this.selectionEls = [];
		const inSelection = (el: HTMLElement) => {
			const range = this.mapped.get(el)?.range;
			return !!range && from < to && from <= range.from && range.to <= to;
		};
		const shaded: DOMRect[] = [];
		for (const el of this.mapped.keys()) {
			let outermost = inSelection(el);
			for (let p = el.parentElement; outermost && p && p !== previewEl; p = p.parentElement) {
				if (inSelection(p)) outermost = false;
			}
			// Boxes have their own, stronger style for "selected".
			const isSlot = el.hasClass('latex-canvas-slot');
			el.toggleClass('is-selected', outermost && isSlot);
			if (outermost && !isSlot) shaded.push(lineRect(el));
		}
		// One band for the whole selection, like text selection in an editor.
		const top = Math.min(...shaded.map((r) => r.top));
		const bottom = Math.max(...shaded.map((r) => r.bottom));
		for (const rect of shaded) {
			const shade = previewEl.createDiv({ cls: 'latex-canvas-selection' });
			this.overlay(shade, new DOMRect(rect.left, top, rect.width, bottom - top));
			this.selectionEls.push(shade);
		}

		const inEquation = equation !== null && from === to && from >= 0 && from <= equation.source.length;
		const anchor = this.canPlaceCursor && inEquation ? caretAnchor(from, this.symbols) : null;
		const rect = anchor && lineRect(anchor.el);
		if (!anchor || !rect || rect.height === 0) {
			caret.toggleClass('is-hidden', true);
			return;
		}
		const x = anchor.side === 'left' ? rect.left : rect.right;
		this.overlay(caret, new DOMRect(x, rect.top, 0, rect.height));
		caret.toggleClass('is-hidden', false);
		// Restart the blink so the caret is visible right after it moves.
		caret.removeClass('is-blinking');
		void caret.offsetWidth;
		caret.addClass('is-blinking');
	}

	/** Positions an absolutely placed `el` of the preview over `rect`. */
	private overlay(el: HTMLElement, rect: DOMRect): void {
		const previewEl = this.previewEl;
		if (!previewEl) return;
		const box = previewEl.getBoundingClientRect();
		el.setCssProps({
			left: `${rect.left - box.left + previewEl.scrollLeft}px`,
			top: `${rect.top - box.top + previewEl.scrollTop}px`,
			height: `${rect.height}px`,
		});
		if (rect.width > 0) el.setCssProps({ width: `${rect.width}px` });
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
		const named = !template.latex.includes(template.label);
		setTooltip(button, named ? `${template.label}: ${code}` : code);

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

/**
 * The box of a rendered symbol, grown upward to at least the height of a
 * capital letter: MathJax boxes are tight around the glyph, so `m` would get
 * a short caret and a thin selection.
 */
function lineRect(el: HTMLElement): DOMRect {
	const rect = el.getBoundingClientRect();
	if (rect.height === 0) return rect;
	const ascent = 0.75 * (parseFloat(getComputedStyle(el).fontSize) || rect.height);
	const top = Math.min(rect.top, rect.bottom - ascent);
	return new DOMRect(rect.left, top, rect.width, rect.bottom - top);
}
