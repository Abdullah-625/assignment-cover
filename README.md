# Assignment Cover Maker (Dhrubok 59)

Static site — works on GitHub Pages. Folder layout:

- `index.html`, `style.css`, `app.js`, `cover.js` — the app
- `data/l3s2/` — `students.csv`, `teachers.csv`, `courses.csv`, `config.json`, optional `assignments.csv` (columns: `code,no,title`)
- `photos/` — teacher photos as `<name>.webp` (e.g. `ZA.webp`); run `python tools/convert_photos.py <your-jpg-folder>`
- `assets/` — `bau-logo.png` (rebuilt from your PDF; swap in a better file with the same name), optional `dhrubok59.png` (shows in the header)
- `fonts/` — Carlito / Tinos / Arimo (Calibri / Times New Roman / Arial look-alikes). Changa and Cairo load from Google Fonts.

For 4-1 / 4-2: copy `data/l3s2` to `data/l41`, edit the CSVs, and change `LEVEL` at the top of `app.js`.
Open it through GitHub Pages (or `python -m http.server`), not by double-clicking `index.html`.
