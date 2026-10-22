import { Editor } from 'obsidian';
import {
	expandTemplate,
	findMathAt,
	findNextPlaceholder,
	PLACEHOLDER,
} from './latex';

/**
 * Inserts a palette template at the cursor. Outside of an equation the result
 * is wrapped in `$…$` so a single click always produces rendered math.
 */
export function insertTemplate(editor: Editor, template: string): void {
	const from = editor.posToOffset(editor.getCursor('from'));
	const inMath = findMathAt(editor.getValue(), from) !== null;
	const expansion = expandTemplate(template, editor.getSelection());

	const text = inMath ? expansion.text : `$${expansion.text}$`;
	const shift = inMath ? 0 : 1;
	editor.replaceSelection(text);
	editor.setSelection(
		editor.offsetToPos(from + shift + expansion.selectFrom),
		editor.offsetToPos(from + shift + expansion.selectTo),
	);
	editor.focus();
}

/**
 * Selects the next empty slot of the equation under the cursor.
 * Returns false when the cursor is not in an equation or nothing is left.
 */
export function selectNextPlaceholder(editor: Editor): boolean {
	const doc = editor.getValue();
	const cursor = editor.posToOffset(editor.getCursor('to'));
	const region = findMathAt(doc, cursor);
	if (!region) return false;

	const next = findNextPlaceholder(doc, region, cursor);
	if (next === -1) return false;

	editor.setSelection(
		editor.offsetToPos(next),
		editor.offsetToPos(next + PLACEHOLDER.length),
	);
	editor.focus();
	return true;
}
