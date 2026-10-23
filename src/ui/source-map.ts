/** A range of an equation's LaTeX source. */
export interface SourceRange {
	from: number;
	to: number;
}

/** A rendered element and the part of the source it was drawn from. */
export interface MappedElement {
	el: HTMLElement;
	range: SourceRange;
}

/**
 * Maps the elements of a rendered equation back to ranges of its `source`.
 *
 * MathJax 4 labels each element it draws with the LaTeX it came from
 * (`data-latex`, e.g. `\frac{ a }{b}`), so each element is found as a
 * substring of its parent's range. Labels are mostly verbatim, but some drop
 * whitespace (`\lim_{x\to0}`), so matching ignores whitespace. The drawing order is not the source
 * order (superscripts and upper limits come first), so pieces with identical
 * text, as in `x_{i}^{i}`, are told apart by the `^`/`_` in front of them.
 *
 * Returns null when the renderer adds no labels (MathJax 3).
 */
export function mapRenderedSource(
	math: HTMLElement,
	source: string,
): Map<HTMLElement, SourceRange> | null {
	const root = math.querySelector<HTMLElement>('[data-latex]');
	const index = new SourceIndex(source);
	const all = { from: 0, to: source.length };
	const rootRange = root && locate(index, root.getAttribute('data-latex') ?? '', all, [], 0, null);
	if (!root || !rootRange) return null;

	const ranges = new Map<HTMLElement, SourceRange>();
	ranges.set(root, rootRange);

	// Places the labelled children of `parent` within `range`. `state` is
	// shared with the caller when `parent` is transparent (see below).
	const place = (
		parent: HTMLElement,
		range: SourceRange,
		state = { taken: [] as SourceRange[], cursor: range.from },
	) => {
		for (const child of labelledChildren(parent)) {
			const latex = child.getAttribute('data-latex') ?? '';
			const marker = scriptMarker(child, parent);
			const found = locate(index, latex, range, state.taken, state.cursor, marker);
			if (found) {
				ranges.set(child, found);
				place(child, found);
				if (allPlaced(child)) {
					state.taken.push(found);
					state.cursor = found.to;
					continue;
				}
				unplace(child);
			}
			// A blank label (table rows) or one too short to hold its content
			// (`{cases}` for a whole `cases` environment): look for the
			// child's content in this range instead.
			place(child, range, state);
		}
	};
	const allPlaced = (el: HTMLElement) =>
		Array.from(el.querySelectorAll<HTMLElement>('[data-latex]')).every(
			(d) => ranges.has(d) || !d.getAttribute('data-latex')?.trim(),
		);
	const unplace = (el: HTMLElement) => {
		ranges.delete(el);
		el.querySelectorAll<HTMLElement>('[data-latex]').forEach((d) => ranges.delete(d));
	};

	place(root, rootRange);
	return ranges;
}

/** The mapped elements that contain no other mapped element, in source order. */
export function leaves(ranges: Map<HTMLElement, SourceRange>): MappedElement[] {
	return [...ranges]
		.filter(([el]) => ![...ranges.keys()].some((other) => other !== el && el.contains(other)))
		.map(([el, range]) => ({ el, range }))
		.sort((a, b) => a.range.from - b.range.from);
}

/**
 * Where to draw a caret for the source `offset`: at the edge of the smallest
 * element that starts or ends exactly there (a symbol, or a structure like
 * `x^{2}` when the cursor is right after it), else at the nearest symbol edge
 * (for offsets in whitespace or inside markup like `\frac{`).
 */
export function caretAnchor(
	offset: number,
	symbols: MappedElement[],
	structures: MappedElement[],
): { el: HTMLElement; side: 'left' | 'right' } | null {
	const area = (el: HTMLElement) => {
		const r = el.getBoundingClientRect();
		return r.width * r.height;
	};
	const exact = [...symbols, ...structures]
		.filter(({ range }) => range.from === offset || range.to === offset)
		.sort((a, b) => area(a.el) - area(b.el))[0];
	if (exact) {
		return { el: exact.el, side: exact.range.from === offset ? 'left' : 'right' };
	}

	let best: { el: HTMLElement; side: 'left' | 'right'; distance: number } | null = null;
	for (const { el, range } of symbols) {
		for (const [edge, side] of [[range.from, 'left'], [range.to, 'right']] as const) {
			const distance = Math.abs(edge - offset);
			if (!best || distance < best.distance) best = { el, side, distance };
		}
	}
	return best && { el: best.el, side: best.side };
}

/** The nearest descendants of `parent` that carry a `data-latex` label. */
function labelledChildren(parent: HTMLElement): HTMLElement[] {
	const found: HTMLElement[] = [];
	const visit = (el: Element) => {
		for (const child of Array.from(el.children)) {
			if (!child.instanceOf(HTMLElement)) continue;
			if (child.hasAttribute('data-latex')) found.push(child);
			else visit(child);
		}
	};
	visit(parent);
	return found;
}

/**
 * `^` or `_` if `child` is drawn as a superscript/upper limit or a
 * subscript/lower limit of `parent`, otherwise null.
 */
function scriptMarker(child: HTMLElement, parent: HTMLElement): '^' | '_' | null {
	for (let el: HTMLElement | null = child; el && el !== parent; el = el.parentElement) {
		const container = el.parentElement;
		if (!container) break;
		switch (container.localName) {
			case 'mjx-over':
				return '^';
			case 'mjx-under':
				return '_';
			case 'mjx-script': {
				// Inline limits and `x_a^b`: superscript, spacer, subscript.
				const parts = Array.from(container.children);
				const spacer = parts.findIndex((part) => part.localName === 'mjx-spacer');
				if (spacer !== -1) return parts.indexOf(el) < spacer ? '^' : '_';
				if (parent.localName === 'mjx-msub' || parent.localName === 'mjx-munder') return '_';
				if (parent.localName === 'mjx-msup' || parent.localName === 'mjx-mover') return '^';
				return null;
			}
		}
	}
	return null;
}

/** The source without whitespace, to match labels that drop whitespace. */
class SourceIndex {
	compact = '';
	// Source offset of each character of `compact`.
	positions: number[] = [];

	constructor(readonly source: string) {
		for (let i = 0; i < source.length; i++) {
			if (!/\s/.test(source[i] ?? '')) {
				this.compact += source[i];
				this.positions.push(i);
			}
		}
	}

	/** Ranges of `source` within `within` that equal `latex`, ignoring whitespace. */
	find(latex: string, within: SourceRange): SourceRange[] {
		const needle = latex.replace(/\s+/g, '');
		if (!needle) return [];
		const lo = this.positions.findIndex((p) => p >= within.from);
		if (lo === -1) return [];
		const found: SourceRange[] = [];
		for (let k = this.compact.indexOf(needle, lo); k !== -1; k = this.compact.indexOf(needle, k + 1)) {
			const from = this.positions[k] ?? 0;
			const to = (this.positions[k + needle.length - 1] ?? 0) + 1;
			if (to > within.to) break;
			found.push({ from, to });
		}
		return found;
	}
}

/** Finds `latex` within `parent`, avoiding ranges already `taken`. */
function locate(
	index: SourceIndex,
	latex: string,
	parent: SourceRange,
	taken: SourceRange[],
	cursor: number,
	marker: '^' | '_' | null,
): SourceRange | null {
	const { source } = index;
	const candidates = index
		.find(latex, parent)
		.filter(
			(range) =>
				!splitsCommand(source, range) &&
				!taken.some((t) => range.from < t.to && t.from < range.to),
		);
	if (marker) {
		const marked = candidates.find((r) =>
			source.slice(parent.from, r.from).trimEnd().endsWith(marker),
		);
		if (marked) return marked;
	}
	return candidates.find((r) => r.from >= cursor) ?? candidates[0] ?? null;
}

/**
 * Whether `range` starts or ends inside a command name, like the `a` in
 * `\frac` or `\in` at the start of `\int`.
 */
function splitsCommand(source: string, range: SourceRange): boolean {
	const isLetter = (c: string | undefined) => c !== undefined && /[a-zA-Z]/.test(c);
	if (isLetter(source[range.to - 1]) && isLetter(source[range.to])) {
		// Ends mid-word: only fine if that word is not a command (`ab` in `abc`).
		if (inCommandName(source, range.to)) return true;
	}
	if (source[range.from] !== '\\' && isLetter(source[range.from])) {
		return inCommandName(source, range.from);
	}
	return false;
}

/** Whether the letter at `index` belongs to a command name (any letter of `\frac`). */
function inCommandName(source: string, index: number): boolean {
	let i = index;
	while (i > 0 && /[a-zA-Z]/.test(source[i - 1] ?? '')) i--;
	return source[i - 1] === '\\';
}
