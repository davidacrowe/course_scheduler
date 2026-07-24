# Course Scheduler

A browser-based tool for building and visualizing weekly course schedules. Upload a registrar
Excel/CSV export, see everything laid out on a Mon–Fri grid, drag courses to new time slots, and
export back to Excel in the original file format.

**Live app:** https://davidacrowe.github.io/course_scheduler/

## Features

- **Import** registrar schedule files (`.xlsx`, `.xls`, `.csv`). Supports both:
  - A single sheet with a `TERM` column (e.g. `2026SEM1`, `2026SEM2`) that gets split into
    semesters automatically.
  - Separate sheets per semester.
- **Weekly grid view** — courses are placed by day/time, color-coded by faculty.
- **Drag and drop** to move a course to a different time slot (respects MWF vs. TR day
  constraints).
- **Conflict detection**
  - Faculty overlaps: flags a faculty member teaching two overlapping courses.
  - Room overlaps: flags two courses sharing a room at the same time (rooms named
    "classroom" are ignored, since those are assigned by someone else).
  - "Enable TBA overlap checking" toggle — when off, TBA/TBD/Instructor-taught sections are
    excluded from faculty overlap checks (unassigned sections overlapping each other is normal
    and expected).
- **Faculty panel** — show/hide individual faculty, pick custom colors (saved in
  `localStorage`), and see each faculty member's total FTE.
- **Filter by course number** (e.g. `BIO1` to show only 100-level courses).
- **Manual editing** — add or edit a course's number, name, faculty, days, time, length, FTE,
  and room directly in the UI.
- **Export** back to `.xlsx`, preserving the original file's format (single-sheet-with-TERM or
  separate-sheets-per-semester).

## Running locally

The app is static HTML/CSS/JS, but it uses ES modules (`<script type="module">`), which browsers
block from loading over `file://`. Serve the folder over HTTP instead:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Project structure

```
index.html          Markup and layout
styles.css           Styling
js/
  app.js              App state, init, file-load orchestration
  fileHandler.js       Parsing uploaded CSV/Excel into a normalized row format
  scheduler.js         Course model, overlap detection, FTE calculation, time-slot logic
  grid.js              Renders the weekly grid
  controls.js          Faculty panel, options, edit/add course modal
  dragDrop.js          Drag-and-drop handling
  exporter.js          Exporting schedules back to Excel
```

Excel parsing/writing is done client-side with [SheetJS](https://sheetjs.com/) (loaded from a
CDN in `index.html`) — nothing is uploaded to a server.

## Deployment

The `main` branch is served directly via GitHub Pages, so pushing to `main` updates the live
site.
