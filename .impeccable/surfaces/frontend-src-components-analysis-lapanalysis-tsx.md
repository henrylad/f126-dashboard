---
version: 1
slug: "frontend-src-components-analysis-lapanalysis-tsx"
primary_target: "frontend/src/components/analysis/LapAnalysis.tsx"
related_targets: ["frontend/src/components/analysis"]
---

# Lap analysis tab

Mode: Operate. Audience: the driver, seated between sessions on a second screen in a dim sim room. Job: find where a lap loses time to the reference, and why. Proof: decoded 2026 telemetry (traces, mini sectors, energy/Boost), every car's fastest lap. Constraints: React + canvas, self-hosted fonts (runs offline in Docker), keyboard-complete, 1280–1600 desktop first, usable at 390.

Critique backlog this build closes: answer-first layout + delta fill bug, legible overlaid traces, one baseline (the ref lap), density/progressive disclosure, keyboard/a11y, contrast/type size.

## Direction contract

THESIS: The tab is a graphite working surface whose first job is the answer: "your lap vs ref, where the time went, and why". It refuses the category default of KPI cards over wide tables over a buried chart.

OWN-WORLD: Graphite ground #0D1117 with panels #151A22 tiled edge to edge and split by one-pixel seams #262C36, with no shadows, gradients or rounded cards. Geist for UI and Geist Mono tabular figures for every number. Syntax-derived accents carry state only: purple = session best, green = gained, red = lost, amber = active-aero zones, blue = focus/primary. Six lap-slot colours avoid those semantics.

STORY: The driver sees the gap and its three biggest loss zones in plain words ("0.42–1.31 km · S1 · +0.183 s · brakes 9 m earlier, ref used Boost"). Clicking a zone zooms every trace to it; they read the braking difference and leave knowing what to change next stint.

FIRST VIEWPORT: Left, a 320px lap rail tiled against the main column by a seam: your laps and drivers' fastest laps as compact rows with real checkboxes, slot swatches, gap to ref and a Ref toggle. Main column, top: the verdict line and a three-item loss-zone list. Directly below: a full-width delta strip with red/green fill and numbered zone brackets. Then the zoomable traces start above the fold.

FORM: Graphite Console (dealt challenger, digital-design-canon-dark-first-developer-console), chosen by the user over the assigned Pit Board (#4 of my list); seed 4ece3ed1. Signature move: loss zones as bracketed distance ranges that drive one shared zoom across delta, traces, mini sectors and energy. Motion is a panel expanding along one axis, plus the zoom easing to its range.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
