# LaTeX-Canvas

Obsidian plugin for building and editing LaTeX math equations with a GUI.
It is for LaTeX beginners and occasional users, and it stays out of the way
of people who type LaTeX directly: no default hotkeys, no key remapping.

> Early prototype. Research and design notes are in [`docs/research.md`](docs/research.md).

## What it does today

- **Equation palette** in the right sidebar. Open it from the ribbon (Σ), the
  command palette ("Open equation palette") or the editor's right-click menu.
- Click a button to insert its LaTeX at the cursor. Outside math, the result is
  wrapped in `$…$`. A selection becomes the first slot of the template.
- Empty slots are shown as `□` (`\square`) and selected in turn. Use
  **Next empty slot** to jump to the next one (also available as a command you
  can bind to a hotkey).
- Hover a button to see the LaTeX behind it.
- Live preview of the equation under the cursor. **Click a `□` in the preview**
  to select that slot in the note, then type to fill it. The selected slot is
  highlighted.
- **Matrices of any size up to 6 × 6:** pick rows × columns on the size grid,
  then click a bracket style. Cases use the row count only.

## Development

```bash
npm install
npm run dev     # watch build -> main.js
npm run build   # type-check + production build
npm run lint
```

To try it, copy `main.js`, `manifest.json` and `styles.css` into
`<your vault>/.obsidian/plugins/latex-canvas/`. Then enable **LaTeX Canvas**
under *Settings → Community plugins*.

Layout:

```
src/
  main.ts               plugin lifecycle: view, commands, menu, editor listener
  ui/palette-view.ts    sidebar palette (ItemView)
  math/templates.ts     palette catalog
  math/latex.ts         pure logic: template expansion, $…$ detection, slots
  math/editor-actions.ts  glue between the logic and Obsidian's Editor
```
