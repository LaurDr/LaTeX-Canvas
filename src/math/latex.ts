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

/**
 * Turns a template into the text to insert. The first slot is filled with
 * `selection` (if any), the remaining slots become placeholders, and the
 * first placeholder is selected so typing replaces it.
 */
export function expandTemplate(
	template: string,
	selection = '',
	placeholder = PLACEHOLDER,
): Expansion {
	const parts = template.split(SLOT);
	if (parts.length === 1) {
		// A plain symbol: keep `\alpha` from merging with a following letter.
		const text = /\\[a-zA-Z]+$/.test(template) ? template + ' ' : template;
		return { text, selectFrom: text.length, selectTo: text.length };
	}

	let text = parts[0] ?? '';
	let first: number | undefined;
	for (let i = 1; i < parts.length; i++) {
		if (i === 1 && selection) {
			text += selection;
		} else {
			first ??= text.length;
			text += placeholder;
		}
		text += parts[i];
	}

	if (first === undefined) {
		return { text, selectFrom: text.length, selectTo: text.length };
	}
	return { text, selectFrom: first, selectTo: first + placeholder.length };
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
	const source = doc.slice(region.contentFrom, region.contentTo);
	const offsets = [...source.matchAll(PLACEHOLDER_RE)].map(
		(m) => region.contentFrom + m.index,
	);
	return offsets.find((o) => o >= offset) ?? offsets[0] ?? -1;
}
