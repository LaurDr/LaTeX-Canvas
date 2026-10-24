# LaTeX Canvas

Build and edit LaTeX math in Obsidian with a point-and-click palette.

LaTeX Canvas is for LaTeX beginners and people who only write an equation now
and then. Instead of remembering commands, you click a fraction, a sum or a
matrix, and fill in the boxes. Every button shows the LaTeX it inserts, so you
pick up the syntax as you go. It stays out of the way of people who type LaTeX
directly: no default hotkeys and no key remapping.

Your notes only ever contain plain LaTeX (`$…$` and `$$…$$`), so they keep
working without the plugin.

Research and design notes are in [`docs/research.md`](docs/research.md).

## Features

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
- **Operators and relations adapt to the cursor:** each side gets a `□` only
  when it is empty. Nothing there yet gives `$□ \neq □$`; at the end of
  `$2+2$` you get `$2+2 \div □$`. `\forall`, `\exists` and `\neg` only take a
  `□` on the right.
- **Matrices of any size up to 6 × 6:** pick rows × columns on the size grid,
  then click a bracket style. Cases use the row count only.

## Installation

LaTeX Canvas needs Obsidian 1.7.2 or newer. It is built desktop-first.

### From Community plugins

Once the plugin is listed: open *Settings → Community plugins → Browse*,
search for **LaTeX Canvas**, then install and enable it.

### Beta versions with BRAT

1. Install and enable the
   [BRAT](https://obsidian.md/plugins?id=obsidian42-brat) plugin.
2. In BRAT's settings, choose **Add beta plugin** and enter
   `LaurDr/LaTeX-Canvas`.
3. Enable **LaTeX Canvas** under *Settings → Community plugins*.

### Manually

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/LaurDr/LaTeX-Canvas/releases/latest).
2. Put them in `<your vault>/.obsidian/plugins/latex-canvas/`. The
   `.obsidian` folder is hidden; on macOS, press **Cmd + Shift + .** in Finder
   to show it.
3. Reload Obsidian and enable **LaTeX Canvas** under
   *Settings → Community plugins*.

## Development

```bash
npm install
npm run dev     # watch build -> main.js
npm run build   # type-check + production build
npm run lint
```

To try a build, copy `main.js`, `manifest.json` and `styles.css` into
`<your vault>/.obsidian/plugins/latex-canvas/`, or link the repository folder
there and run `npm run dev`.

Layout:

```
src/
  main.ts               plugin lifecycle: view, commands, menu, editor listener
  ui/palette-view.ts    sidebar palette (ItemView)
  math/templates.ts     palette catalog
  math/latex.ts         pure logic: template expansion, $…$ detection, slots
  math/editor-actions.ts  glue between the logic and Obsidian's Editor
```

### Releasing

1. On `main`, set `minAppVersion` in `manifest.json` if newer Obsidian APIs are
   used, then run `npm version patch` (or `minor` / `major`). This updates
   `package.json`, `manifest.json` and `versions.json`, commits, and creates a
   tag named after the version (no `v` prefix).
2. Push the commit and the tag: `git push && git push --tags`.
3. The *Release Obsidian plugin* workflow builds the plugin and creates a
   **draft** release with `main.js`, `manifest.json` and `styles.css`
   attached. Review it on GitHub and publish it.

The community directory picks up new releases on its own once the plugin is
listed. The first listing is requested at
[community.obsidian.md](https://community.obsidian.md).

## License

[MIT](LICENSE)
