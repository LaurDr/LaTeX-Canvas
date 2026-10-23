import { SourceRange } from './source-map';

export interface Box {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

/** A rendered part of the preview, with where it is drawn. */
export interface HitSymbol {
	range: SourceRange;
	box: Box;
	isSlot: boolean;
	// A single symbol, not a structure like `x^{2}` or a whole fraction.
	isLeaf: boolean;
	// Its source is followed by `^` or `_` (the `\sum` of `\sum_{i=1}^{n}`).
	scriptFollows?: boolean;
}

/** What a click at a point means: select a box, or put the caret somewhere. */
export type Hit =
	| { kind: 'slot'; range: SourceRange }
	| { kind: 'caret'; offset: number; x: number; top: number; bottom: number };

// Boxes accept clicks this far (px) outside their outline.
export const SLOT_PADDING = 8;

// Vertical distance counts more than horizontal, so a click level with a
// superscript or a numerator stays on that level.
const VERTICAL_WEIGHT = 2;

// Extra distance (px) for the spot between a base and its `^`/`_`, so a
// click beside `\sum_{i=1}^{n}` lands after the limits rather than between
// `\sum` and `_`, where typing would detach them.
const BEFORE_SCRIPT_PENALTY = 6;

/**
 * Resolves a click like a text editor does: every point means something.
 * 1. A point on or near a box (`\square`) selects the box.
 * 2. A point on a symbol puts the caret on that symbol's nearer side.
 * 3. Any other point puts the caret at the nearest edge of a symbol or of a
 *    structure. Structures matter beside them: right of `x²` means after
 *    `x^{2}`, not inside the exponent.
 */
export function hitTest(
	symbols: HitSymbol[],
	x: number,
	y: number,
	canPlaceCursor: boolean,
): Hit | null {
	const slot = nearest(
		symbols.filter((s) => s.isSlot && contains(s.box, x, y, SLOT_PADDING)),
		x,
		y,
	);
	if (slot) return { kind: 'slot', range: slot.range };
	if (!canPlaceCursor) return null;

	const on = symbols
		.filter((s) => s.isLeaf && contains(s.box, x, y, 0))
		.sort((a, b) => area(a.box) - area(b.box))[0];
	if (on) {
		const left = x < (on.box.left + on.box.right) / 2;
		return caretAt(on, left ? 'left' : 'right');
	}

	let best: Hit | null = null;
	let bestDistance = Infinity;
	for (const symbol of symbols) {
		for (const side of ['left', 'right'] as const) {
			const edge = symbol.box[side];
			const dy = Math.max(0, symbol.box.top - y, y - symbol.box.bottom);
			const penalty = side === 'right' && symbol.scriptFollows ? BEFORE_SCRIPT_PENALTY : 0;
			const distance = Math.hypot(x - edge, dy * VERTICAL_WEIGHT) + penalty;
			if (distance < bestDistance) {
				bestDistance = distance;
				best = caretAt(symbol, side);
			}
		}
	}
	return best;
}

function caretAt(symbol: HitSymbol, side: 'left' | 'right'): Hit {
	return {
		kind: 'caret',
		offset: side === 'left' ? symbol.range.from : symbol.range.to,
		x: symbol.box[side],
		top: symbol.box.top,
		bottom: symbol.box.bottom,
	};
}

function contains(box: Box, x: number, y: number, padding: number): boolean {
	return (
		x >= box.left - padding &&
		x <= box.right + padding &&
		y >= box.top - padding &&
		y <= box.bottom + padding
	);
}

function area(box: Box): number {
	return (box.right - box.left) * (box.bottom - box.top);
}

function nearest(symbols: HitSymbol[], x: number, y: number): HitSymbol | undefined {
	const distance = (s: HitSymbol) =>
		Math.hypot(x - (s.box.left + s.box.right) / 2, y - (s.box.top + s.box.bottom) / 2);
	return [...symbols].sort((a, b) => distance(a) - distance(b))[0];
}
