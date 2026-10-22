# LaTeX Canvas: research notes

Status: October 2026, Obsidian 1.14.4 (API package `obsidian@1.14.4`).

Goal: a desktop-first Obsidian plugin for building and editing math with a GUI.
It is for LaTeX beginners and occasional users, and it must not get in the way
of people who type LaTeX directly.

---

## 1. Minimal plugin template

The official starting point is
[`obsidianmd/obsidian-sample-plugin`](https://github.com/obsidianmd/obsidian-sample-plugin).
This repo is now based on it.

| File | Purpose |
| --- | --- |
| `manifest.json` | `id` (never change it after release), `name`, `version`, `minAppVersion`, `isDesktopOnly` |
| `src/main.ts` | `export default class … extends Plugin`, with `onload()` registering everything |
| `esbuild.config.mjs` | Bundles to a single `main.js`. `obsidian`, `electron` and `@codemirror/*` stay external because Obsidian provides them at runtime. |
| `styles.css` | Loaded automatically while the plugin is enabled |
| `eslint.config.mts` | Uses `eslint-plugin-obsidianmd`, which enforces review-guideline rules such as sentence-case UI text and no `innerHTML` |
| `version-bump.mjs`, `versions.json` | Maps each plugin version to its minimum Obsidian version |

A release is a GitHub release that contains `main.js`, `manifest.json` and
`styles.css`. Listing in the community store means opening a PR on
`obsidianmd/obsidian-releases`.

Everything a plugin registers through `this.register*` or `this.add*` is
cleaned up automatically on unload. That is the main lifecycle rule to follow.

## 2. How well-known plugins integrate with Obsidian

### Highlightr: context menu and a cursor-anchored menu
- Adds items to the editor's right-click menu with
  `workspace.on('editor-menu', (menu, editor) => menu.addItem(...))`.
- Its "Open Highlightr" command builds an `obsidian.Menu` and calls
  `showAtPosition()` at the cursor's screen coordinates (`editor.cursorCoords`
  or `coordsAtPos`). This is how it gets a popup next to the text.
  Getting those coordinates relies on **undocumented** internals (`editor.cm`,
  `menu.dom`).
- Every action is also a command, so users can bind hotkeys to it.
- It edits text through `editor.replaceSelection()` and `getRange()`.

### Advanced Tables: sidebar toolbar and editor extension
- `registerView()` adds an `ItemView` in the right sidebar, which is a panel of
  icon buttons. The ribbon icon toggles it.
- **Key detail:** clicking the sidebar takes focus away from the note. The
  buttons find their editor with `workspace.getMostRecentLeaf()` rather than
  `getActiveViewOfType`.
- Tab and Enter are bound through a CodeMirror 6 extension
  (`registerEditorExtension(Prec.highest(keymap.of(...)))`). The bindings fire
  only when the cursor is in a table, and settings can turn them off.
- `metadataCache.getFileCache(file).sections` tells it whether the cursor is in
  a table, code block or `math` section.
- The table logic lives in a separate library (`md-advanced-tables`). A thin
  adapter class (`ObsidianTextEditor`) is the only code that talks to
  Obsidian. That separation is worth copying.

### MathLive: the closest existing tool
- A `Modal` hosts a MathLive `<math-field>`, a WYSIWYG math editor with a
  virtual keyboard. Commands are "Add inline math" and "Add full-line math".
- It edits an existing equation by finding the `$…$` around the cursor, loading
  it into the field and writing the result back.
- It also replaces math in the editor with live math fields through CM6
  decorations, has image-to-LaTeX OCR (cloud or local), and is
  `isDesktopOnly: true`.
- **What this means for LaTeX Canvas:** a plain WYSIWYG modal already exists.
  We should set ourselves apart through teaching and transparency (the LaTeX
  source is always visible, and the GUI shows the code behind every action),
  through a palette that stays open, and through structured editing of what is
  already in the note.

### Latex Suite and Quick Latex: the typing-first users we must not disturb
- Snippets, auto-fractions, tabout and conceal, all through CM6 keymaps and
  extensions.
- Latex Suite finds math by walking the CM6 syntax tree (`syntaxTree(state)`)
  and looking for node names such as `formatting-math-begin`.
- Consequence: **LaTeX Canvas binds no keys by default.** Everything is a
  command or a click, and users opt in to hotkeys.

## 3. Which LaTeX "flavor" does Obsidian use?

Obsidian does not run real LaTeX. It renders math with **MathJax**, using TeX
input and **math mode only**.

- Delimiters: `$…$` for inline math and `$$…$$` for display math.
- There is no preamble and no `\usepackage`. The AMS environments work
  (`align`, `aligned`, `pmatrix`, `bmatrix`, `cases`, and so on), and so does
  `\ce{}` from mhchem.
- Engine history:
  - MathJax 3 up to Obsidian 1.13.
  - 1.14.0 (early access, Sept 2026) briefly switched to **Temml**. That broke
    `\require{physics}`, `\DeclareMathOperator` and similar commands.
  - 1.14.1 moved to **MathJax 4.1.3**, which is in the public 1.14 release
    (5 Oct 2026). Some symbols (`\oiint`) render in the wrong font.
- Plugin API, unchanged in 1.14.4: `loadMathJax()`, then
  `renderMath(source, display)`, which returns an `HTMLElement`, then
  `finishRenderMath()`.
- **Design rules that follow from this:**
  1. Generate plain AMS-style math LaTeX. Avoid commands from optional
     packages (`physics` and similar).
  2. Render every preview through `renderMath`, so the palette shows exactly
     what the note will show, whatever engine version is running.
  3. Never ship our own MathJax.

> These version facts come from search summaries of the official changelog
> pages. obsidian.md was not reachable from the build environment. Check
> <https://obsidian.md/changelog/> before relying on them.

## 4. GUI options

| Option | Obsidian API | Strengths | Weaknesses |
| --- | --- | --- | --- |
| **Sidebar panel** (like Advanced Tables) | `ItemView` + `registerView` | Stays open next to the note. Room for a large palette and a live preview. Users can drag the tab into its own window, which on desktop gives a floating palette like **Grapher's** for free. Works on mobile. | Takes sidebar space. Needs `getMostRecentLeaf()` to reach the note. |
| **Right-click menu** (like Highlightr) | `editor-menu` event, `Menu` | Users find it without being told. Context-aware ("Edit this equation…"). | Flat lists only (submenus are not in the public API). Poor for previews or many symbols. Closes after one action. |
| **Cursor popup menu** | `Menu.showAtPosition()` | Appears where the user is looking. | Same limits as above. Positioning relies on internals. |
| **Modal dialog** (like MathLive) | `Modal` | Focused editing of one equation. Insert or Cancel semantics. | Blocks the note. One equation at a time. Already done by MathLive. |
| **Floating panel** (Grapher style) | No public API. Use custom absolutely positioned DOM, or `workspace.openPopoutLeaf()` | Exactly the Grapher feel. | Custom DOM means managing focus, z-index and theming yourself. Popout windows are desktop only. |
| **Inline widgets** | CM6 decorations and `showTooltip` via `registerEditorExtension` | Controls right on the equation, for example a toolbar above the `$$` block. | The most complex option. Clashes with Live Preview and other math plugins. |
| **Autocomplete popup** | `EditorSuggest` | Bridges GUI to typing: type `\fr` and see a rendered "fraction" suggestion. Teaches the commands. | Only for people who already type. |
| Ribbon, commands, status bar | `addRibbonIcon`, `addCommand`, `addStatusBarItem` | Entry points only. | — |

### Recommendation

1. **Main surface: a sidebar palette.** It covers the Grapher use case, since
   the panel can be popped out into a floating window, and it never takes over
   the keyboard. It also shows the source behind every button.
   *A first version is implemented in this repo.*
2. **Entry points:** a ribbon icon, the command palette, and a right-click
   "Equation palette" item. Later, make that item "Edit this equation…" when
   the cursor is inside math.
3. **Later:** a modal or inline "structure editor" for changing existing
   equations, such as resizing a matrix, swapping bracket types, or editing
   integral bounds as fields.
4. **Later:** an `EditorSuggest` that offers palette entries while typing,
   which turns GUI users into typists over time.

## 5. The hard part: editing existing equations

Inserting is easy. Editing an existing equation through a GUI means:
LaTeX source, then parse to a tree, then show the node under the cursor as a
GUI, then write back **only that node**, so the user's own formatting is never
rewritten.

Options:
- **Placeholders and text edits** (prototype): templates insert `\square`
  slots, and "Next empty slot" walks through them. This is simple and robust,
  and the result is ordinary LaTeX.
- **Parse with a LaTeX AST library**, for example `@unified-latex/*`, which
  keeps exact source positions. This enables "edit this fraction or matrix"
  without regenerating the whole equation.
- **WYSIWYG with MathLive.** It is powerful, but it is a large dependency,
  duplicates the MathLive plugin, and converts the source back to LaTeX in
  its own way.

Suggested path: keep the LaTeX in the note as the single source of truth. Add
an AST parser once the palette is solid, starting with matrices and
environments, where a GUI helps beginners most.

## 6. What the prototype in this repo does

- **Equation palette** in the right sidebar (`src/ui/palette-view.ts`). It has
  categorized buttons (structures, big operators, brackets, accents, matrices
  and cases, functions, Greek letters, operators, relations, arrows and logic),
  each rendered with Obsidian's own MathJax. Hovering a button shows its LaTeX.
- **Clicking a button inserts at the cursor.**
  - Outside math, the result is wrapped in `$…$`.
  - A selection becomes the first slot: select `x+1`, click Fraction, and you
    get `\frac{x+1}{\square}` with the box selected.
  - The empty slots are selected one after another (`\square`), so typing
    replaces them.
- **"Next empty slot"** button and command. The command has no default
  hotkey.
- **Live preview** of the equation under the cursor, with its source, updated
  through a CM6 `updateListener`.
- **Clickable slots in the preview.** Each `\square` is rendered as
  `\mmlToken{mi}[class="mjx-latex-canvas-slot-N"]{◻}` (base TeX in MathJax 3
  and 4), so the n-th rendered box can be found and mapped back to the n-th
  `\square` in the note. The DOM order cannot be used for this: MathJax draws
  superscripts before subscripts and upper bounds before lower ones. If tagging
  fails, the preview falls back to plain, non-clickable rendering.
- **Matrix size picker.** Click a cell of a 6 × 6 grid to choose rows ×
  columns, then click a bracket style (`pmatrix`, `bmatrix`, `Bmatrix`,
  `vmatrix`, `Vmatrix`, `matrix`, `cases`).
- Rendered math in the palette ignores the mouse except for the slots.
  MathJax 4 can attach its own click handling, which otherwise swallows clicks
  on the buttons.
- The pure logic is in `src/math/` (templates, a `$`/`$$` scanner and slot
  handling), which can be unit-tested without Obsidian.

Known limitations:
- The `$` scanner is a heuristic. It handles escaped dollars, code fences and
  inline code, but it is not Obsidian's parser. A later version should use the
  CM6 syntax tree, as Latex Suite does.
- Display math (`$$`) is never inserted automatically. Put the cursor inside a
  `$$` block first.
- It has not yet been run inside a live Obsidian vault.

## 7. Suggested next steps

1. Try the palette in a test vault and decide on button size, categories and
   ordering.
2. Detect math through the CM6 syntax tree instead of the text scanner.
3. Add settings: inline or display by default, which categories to show,
   recently used symbols.
4. Make the right-click item context-aware ("Edit this equation…").
5. Structured editing of existing matrices (add or remove rows and columns,
   change bracket type). Today the size is only chosen before inserting.
6. Add `EditorSuggest`-based learning hints.
7. Pick a license, add a test runner (for example vitest) for `src/math/`, and
   set up a release workflow.

## Sources

- [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin), [obsidian-api `obsidian.d.ts`](https://github.com/obsidianmd/obsidian-api)
- [Highlightr](https://github.com/chetachiezikeuzor/Highlightr-Plugin), [Advanced Tables](https://github.com/tgrosinger/advanced-tables-obsidian), [MathLive plugin](https://github.com/danzilberdan/obsidian-mathlive), [Latex Suite](https://github.com/artisticat1/obsidian-latex-suite), [Quick Latex](https://github.com/joeyuping/quick_latex_obsidian)
- [Obsidian 1.14.0 changelog](https://obsidian.md/changelog/2026-09-02-desktop-v1.14.0/), [1.14.1](https://obsidian.md/changelog/2026-09-08-desktop-v1.14.1/), [1.14 public](https://obsidian.md/changelog/2026-10-05-desktop-v1.14.4/)
- [Forum: 1.14.0 math compatibility issue](https://forum.obsidian.md/t/obsidian-1-14-0-math-compatibility-issue/118065), [Forum: what is supported in Obsidian MathJax](https://forum.obsidian.md/t/what-exactly-is-supported-in-obsidian-mathjax/96813), [Forum: `\oiint` font issue](https://forum.obsidian.md/t/some-math-symbols-do-not-display-correctly-oiint-and-oiiint-incorrect-font-used/118850)
