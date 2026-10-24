import { SLOT } from './templates';

// Empty slots are inserted as a visible box so beginners can see what is
// still missing, both in the rendered preview and in the source.
export const PLACEHOLDER = '\\square';

const PLACEHOLDER_RE = /\\square(?![a-zA-Z])/g;

export interface Expansion {
	text: string;
	// Offsets into `text` that should be selected after inserting it.
	selectFrom: number;
	selectTo: number;
}

/** The equation source around the insertion point (both empty outside math). */
export interface InsertContext {
	before: string;
	after: string;
}

const OUTSIDE_MATH: InsertContext = { before: '', after: '' };

/**
 * Turns a template into the text to insert. The first slot is filled with
 * `selection` (if any), the remaining slots become placeholders, and the
 * first placeholder is selected so typing replaces it.
 *
 * A bare slot at the edge of a template (`# \neq #`, the summand of
 * `\sum_{#}^{#} #`) is an operand: it is left out when the equation already
 * has an operand on that side of the cursor, so `2+2|` becomes
 * `2+2 \div \square` rather than `2+2\square \div \square`.
 */
export function expandTemplate(
	template: string,
	selection = '',
	placeholder = PLACEHOLDER,
	context: InsertContext = OUTSIDE_MATH,
): Expansion {
	const parts = template.split(SLOT);
	const slots = parts.length - 1;
	if (slots === 0) {
		const text = withSeparator(template, context.after);
		return { text, selectFrom: text.length, selectTo: text.length };
	}

	const last = slots - 1;
	const dropFirst =
		!selection &&
		parts[0] === '' &&
		/^\s/.test(parts[1] ?? '') &&
		hasOperandBefore(context.before);
	const dropLast =
		!(last === 0 && selection) &&
		parts[slots] === '' &&
		/\s$/.test(parts[last] ?? '') &&
		hasOperandAfter(context.after);
	// Keep exactly one space between the operator and the existing operand.
	if (dropFirst) {
		parts[1] = (/\s$/.test(context.before) ? '' : ' ') + (parts[1] ?? '').trimStart();
	}
	if (dropLast) {
		parts[last] = (parts[last] ?? '').trimEnd() + (/^\s/.test(context.after) ? '' : ' ');
	}

	let text = '';
	let first: number | undefined;
	for (let i = 0; i < slots; i++) {
		text += parts[i];
		if ((i === 0 && dropFirst) || (i === last && dropLast)) continue;
		if (i === 0 && selection) {
			text += selection;
		} else {
			first ??= text.length;
			text += placeholder;
		}
	}
	text = withSeparator(text + (parts[slots] ?? ''), context.after);

	if (first === undefined) {
		return { text, selectFrom: text.length, selectTo: text.length };
	}
	return { text, selectFrom: first, selectTo: first + placeholder.length };
}

/**
 * Adds a space only where one is needed: `\alpha` followed by `x` would
 * read as `\alphax`. A trailing space before the closing `$` would stop
 * Obsidian from rendering inline math, so none is added otherwise.
 */
function withSeparator(text: string, after: string): string {
	return /\\[a-zA-Z]+$/.test(text) && /^[a-zA-Z]/.test(after) ? text + ' ' : text;
}

// Commands that sit between operands (`a \leq b`).
const BINARY_COMMANDS = new Set([
	'pm', 'mp', 'cdot', 'times', 'div', 'circ', 'ast', 'star', 'cup', 'cap',
	'setminus', 'oplus', 'otimes', 'wedge', 'vee', 'land', 'lor',
	'neq', 'ne', 'leq', 'le', 'geq', 'ge', 'll', 'gg', 'approx', 'equiv',
	'sim', 'simeq', 'cong', 'propto', 'in', 'notin', 'ni', 'subset',
	'subseteq', 'supset', 'supseteq', 'to', 'gets', 'leftarrow',
	'rightarrow', 'Leftarrow', 'Rightarrow', 'leftrightarrow',
	'Leftrightarrow', 'mapsto', 'implies', 'impliedby', 'iff', 'mid',
]);

// Commands that still need something after them (`\sum x`, `\left( x`).
const OPENING_COMMANDS = new Set([
	'left', 'big', 'Big', 'bigg', 'Bigg', 'sum', 'prod', 'int', 'iint',
	'iiint', 'oint', 'lim', 'neg', 'lnot', 'forall', 'exists', 'nexists',
	'quad', 'qquad', 'langle', 'lvert', 'lVert', 'lbrace',
]);

/** Whether the equation text before the cursor ends with an operand. */
export function hasOperandBefore(before: string): boolean {
	const text = before.trimEnd();
	// `\begin{pmatrix}`, and `\left|` or `\left\{` (an opening, not a closing bar).
	if (/\\begin\{[^}]*\}$|\\left\\?.$/.test(text)) return false;
	const command = /\\([a-zA-Z]+)$/.exec(text)?.[1];
	if (command) {
		return !BINARY_COMMANDS.has(command) && !OPENING_COMMANDS.has(command);
	}
	// Digits, letters, closing brackets, `x'`, `n!`; not `+`, `=`, `{`, `&`, `^`…
	return /[a-zA-Z0-9)\]}|!'.]$/.test(text);
}

/** Whether the equation text after the cursor starts with an operand. */
export function hasOperandAfter(after: string): boolean {
	const text = after.trimStart();
	if (text.startsWith('\\\\')) return false;
	const command = /^\\([a-zA-Z]+)/.exec(text)?.[1];
	if (command) {
		return !BINARY_COMMANDS.has(command) && command !== 'right' && command !== 'end';
	}
	return /^[a-zA-Z0-9({[|.\\]/.test(text);
}

/** LaTeX used to draw a template on its palette button. */
export function previewLatex(template: string, placeholder = PLACEHOLDER): string {
	return template.split(SLOT).join(placeholder);
}

export interface MathRegion {
	// Range including the `$`/`$$` delimiters.
	from: number;
	to: number;
	// Range of the LaTeX source between the delimiters.
	contentFrom: number;
	contentTo: number;
	display: boolean;
}

const isSpace = (c: string | undefined): boolean =>
	c !== undefined && /\s/.test(c);

/**
 * Finds `$…$` and `$$…$$` math in a Markdown document. This is a deliberately
 * small scanner (escaped dollars, code fences and inline code are skipped);
 * it is good enough to decide whether the cursor sits inside an equation.
 */
export function findMathRegions(doc: string): MathRegion[] {
	const regions: MathRegion[] = [];
	let i = 0;
	while (i < doc.length) {
		const atLineStart = i === 0 || doc[i - 1] === '\n';
		if (atLineStart && (doc.startsWith('```', i) || doc.startsWith('~~~', i))) {
			const fence = doc.slice(i, i + 3);
			const end = doc.indexOf('\n' + fence, i + 3);
			i = end === -1 ? doc.length : end + 4;
			continue;
		}

		const c = doc[i];
		if (c === '\\') {
			i += 2;
		} else if (c === '`') {
			const end = doc.indexOf('`', i + 1);
			const isCode = end !== -1 && !doc.slice(i, end).includes('\n\n');
			i = isCode ? end + 1 : i + 1;
		} else if (c === '$') {
			const display = doc[i + 1] === '$';
			const delim = display ? 2 : 1;
			const close = findClosingDollar(doc, i + delim, display);
			if (close === -1) {
				i += delim;
				continue;
			}
			regions.push({
				from: i,
				to: close + delim,
				contentFrom: i + delim,
				contentTo: close,
				display,
			});
			i = close + delim;
		} else {
			i++;
		}
	}
	return regions;
}

function findClosingDollar(doc: string, start: number, display: boolean): number {
	// `$ 5 and $ 6` is not math: inline math must hug its delimiters.
	if (!display && (start >= doc.length || isSpace(doc[start]))) return -1;

	for (let j = start; j < doc.length; j++) {
		const c = doc[j];
		if (c === '\\') {
			j++;
		} else if (display) {
			if (doc.startsWith('$$', j)) return j;
		} else if (c === '\n' && doc[j + 1] === '\n') {
			// Inline math cannot span paragraphs.
			return -1;
		} else if (c === '$') {
			// The next dollar decides: `$ x $` and `$x $y$` don't open math.
			return isSpace(doc[j - 1]) ? -1 : j;
		}
	}
	return -1;
}

/** The equation whose source contains `offset`, if any. */
export function findMathAt(doc: string, offset: number): MathRegion | null {
	return (
		findMathRegions(doc).find(
			(r) => r.contentFrom <= offset && offset <= r.contentTo,
		) ?? null
	);
}

/**
 * Offset of the next placeholder in `region` after `offset`, wrapping around
 * to the start of the equation. Returns -1 when the equation is complete.
 */
export function findNextPlaceholder(
	doc: string,
	region: MathRegion,
	offset: number,
): number {
	const offsets = placeholderOffsets(
		doc.slice(region.contentFrom, region.contentTo),
	).map((o) => region.contentFrom + o);
	return offsets.find((o) => o >= offset) ?? offsets[0] ?? -1;
}

/** Offsets of every placeholder in an equation's `source`. */
export function placeholderOffsets(source: string): number[] {
	return [...source.matchAll(PLACEHOLDER_RE)].map((m) => m.index);
}

// The `mjx-` prefix keeps the class if MathJax's `safe` extension is active.
export const SLOT_CLASS_PREFIX = 'mjx-latex-canvas-slot-';

/**
 * Rewrites the placeholders so the n-th one renders with the class
 * `SLOT_CLASS_PREFIX + n` and can be found in the rendered output.
 * `\mmlToken` is part of MathJax's base TeX package (MathJax 3 and 4), unlike
 * `\class`, which needs the optional `html` extension. The rendered DOM order
 * cannot be used instead: MathJax draws superscripts before subscripts.
 */
export function tagPlaceholders(source: string): string {
	let n = 0;
	return source.replace(
		PLACEHOLDER_RE,
		() =>
			`{\\mmlToken{mi}[mathvariant="normal",class="${SLOT_CLASS_PREFIX}${n++}"]{\u25FB}}`,
	);
}
