---
name: Pit Wall
description: F1 26 telemetry analysis on a graphite console, built to say where a lap lost its time.
colors:
  graphite-ground: "#0d1117"
  graphite-panel: "#151a22"
  graphite-raised: "#1b212b"
  seam: "#262c36"
  seam-strong: "#353d49"
  ink: "#e6edf3"
  ink-muted: "#9aa4b0"
  ink-dim: "#808a96"
  focus-blue: "#79c0ff"
  control-blue: "#1f6feb"
  gained-green: "#56d364"
  lost-red-text: "#ff7b72"
  lost-red-mark: "#f85149"
  session-purple: "#d2a8ff"
  aero-amber: "#e3b341"
  slot-tangerine: "#ffa657"
  slot-teal: "#2dd4bf"
  slot-pink: "#f472b6"
  slot-citron: "#e9e26b"
  slot-tan: "#c8a27a"
  slot-seafoam: "#8bd5ca"
  energy-harvest: "#58a6ff"
  energy-medium: "#9e6a03"
  energy-hotlap: "#f0883e"
  energy-boost: "#ffb3c6"
typography:
  display:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  headline-figure:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "22px"
    fontWeight: 600
    fontFeature: "tnum"
  title:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.06em"
  body:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  body-sm:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  data:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "tnum"
  chart-label:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
  chart-figure:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 500
    fontFeature: "tnum"
rounded:
  swatch: "2px"
  mark: "3px"
  control: "6px"
  pill: "999px"
spacing:
  hair: "2px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  rail: "14px"
  lg: "16px"
  section: "20px"
components:
  button:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "4px 10px"
  button-selected:
    backgroundColor: "rgba(31, 111, 235, 0.18)"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  button-quiet:
    textColor: "{colors.ink-muted}"
    padding: "4px 10px"
  segmented:
    backgroundColor: "{colors.graphite-ground}"
    rounded: "{rounded.control}"
    padding: "2px"
  segmented-on:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.ink}"
    rounded: "4px"
    padding: "3px 10px"
  tab:
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    padding: "6px 12px 8px"
  tab-on:
    textColor: "{colors.ink}"
  lap-check:
    backgroundColor: "{colors.graphite-ground}"
    rounded: "{rounded.mark}"
    size: "16px"
  rail-row:
    height: "32px"
    padding: "0 14px 0 10px"
  rail-row-on:
    backgroundColor: "rgba(121, 192, 255, 0.06)"
  zone-row:
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    padding: "8px"
  zone-row-on:
    backgroundColor: "rgba(248, 81, 73, 0.08)"
  zone-number:
    textColor: "{colors.lost-red-text}"
    rounded: "{rounded.mark}"
    size: "20px"
  table-header:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    padding: "7px 10px"
---

# Design System: Pit Wall

## Overview

**Creative North Star: "The Graphite Console"**

Pit Wall reads like a developer console that happens to know racing. A graphite ground carries panels tiled edge to edge, split by one-pixel seams rather than floated as cards. Nothing glows, nothing lifts: depth is one tonal step and a hairline. Colour is withheld from chrome entirely and spent only on state, so when red, green or purple appears it means something the driver must read.

The system is built for a seated, unhurried reading in a dim room on a second screen, and for a one-second glance from the cockpit. Density is high but ordered: compact 32px rows, tabular figures that never jitter, small sentence-case labels in the UI face, and every number in the mono face. The answer comes first in plain words; the charts underneath let you verify it, all on one shared distance axis that zooms together.

Motion is a single grammar: a range easing along one axis (220ms, cubic ease-out, no overshoot), and short 0.12 to 0.2s colour transitions on hover. Reduced-motion turns all of it off.

**Key Characteristics:**
- Graphite ground, tiled panels, one-pixel seams; no drop shadows and no rounded floating cards.
- Accents are state, never decoration: purple session best, green gained, red lost, amber active aero, blue focus and selection.
- Geist for words, Geist Mono with tabular figures for every number.
- Six lap-slot colours deliberately avoid the state hues; the reference lap is always neutral grey and dashed.
- One distance axis, one zoom: loss zones are bracketed ranges that drive every chart at once.

## Colors

A cool, near-neutral graphite scale with a GitHub-dark lineage, punctuated by syntax-derived accents that each own exactly one meaning.

### Primary
- **Focus Blue** (focus-blue): focus rings (2px outline, 2px offset), the active tab underline, the default checkbox fill, selected presets' border, the battery trace. The system's only "primary" colour, and it means attention, not brand.
- **Control Blue** (control-blue): reserved for a filled primary control; in the shipped build it appears only as the 18% tint behind a selected preset button.

### Secondary
- **Gained Green** (gained-green): time gained, personal bests, the throttle trace, the faster side of the delta fill.
- **Lost Red, text** (lost-red-text): loss figures in text, loss-zone numbers and brackets. The lighter red keeps small text legible on graphite.
- **Lost Red, mark** (lost-red-mark): the brake trace, the slower side of the delta fill, alerts and the live dot.

### Tertiary
- **Session Purple** (session-purple): session-best lap and sector, F1's own convention. Nothing else is purple.
- **Aero Amber** (aero-amber): active-aero zones (a 5% wash with an amber edge on charts) and warnings such as a full comparison set.
- **Lap slots** (slot-tangerine, slot-teal, slot-pink, slot-citron, slot-tan, slot-seafoam): fixed-order colours for up to six compared laps. A lap keeps its slot while selected. Swatches, checkbox fills and traces all take the slot colour.
- **Energy ramp** (energy-harvest, energy-medium, energy-hotlap, energy-boost): harvesting is blue; deployment is one warm ramp that gets lighter as it gets stronger (Medium, Hotlap, Boost). Validated for colour-blind separation on the dark surface. "No flow" uses graphite-raised with a seam-strong inset ring.

### Neutral
- **Graphite Ground** (graphite-ground): the page, segmented-control wells, unchecked checkboxes, the checkmark stroke.
- **Graphite Panel** (graphite-panel): tiled panels, the rail, the header and tab bar, the verdict section, the canvas background.
- **Graphite Raised** (graphite-raised): hover rows, buttons, table headers, selected segments, level cells in the mini-sector table.
- **Seam** (seam): every one-pixel divider between tiles, sections, rows and table cells.
- **Seam Strong** (seam-strong): control borders, checkbox borders, scrollbar thumbs, separators inside text.
- **Ink** (ink): primary text and the delta line.
- **Ink Muted** (ink-muted): section titles, secondary text, the reference lap's trace (7:1 on the ground).
- **Ink Dim** (ink-dim): tertiary text, gaps in the rail, axis labels (5:1 on the ground, 4.6:1 on panels).

### Named Rules
**The State-Only Rule.** An accent hue appears only to carry the state it owns. Chrome, headings, borders and backgrounds stay in the graphite scale; if a colour is not answering "best, gained, lost, aero or focus", it does not belong.

**The Slot Separation Rule.** Lap-slot colours never borrow a state hue, and the reference lap is never coloured: it is drawn in ink-muted, dashed (6px on, 4px off), whatever slot it holds.

## Typography

**Display Font:** Geist Variable (with system-ui)
**Body Font:** Geist Variable (with system-ui)
**Label/Mono Font:** Geist Mono Variable (with ui-monospace), tabular figures

**Character:** One neutral grotesque for words and its mono sibling for figures, both self-hosted through @fontsource so the app runs offline. The contrast between the two faces is how a reader finds the numbers in a sentence.

### Hierarchy
- **Display** (500, 20px, 1.35, -0.01em, balanced wrap): the verdict sentence, the one line that answers the tab. Drops to 17px under 860px.
- **Headline figure** (mono 600, 22px): the gap figure inside the verdict.
- **Title** (600, 12px, 0.06em, uppercase, ink-muted): section heads sitting inline with their controls (Compare, Your laps, Telemetry) and table group rows.
- **Body** (400, 14px): base text and tabs.
- **Body small** (400, 13px, 1.45): zone rows, rail rows, notes, table cells.
- **Label** (500, 12px): buttons, segmented controls, table headers, fact labels.
- **Data** (mono 400, 13px, tabular): lap times, gaps, distances, every figure in a row.
- **Chart label / figure** (500, 11px, Geist for panel labels, Geist Mono for axis ticks; zone numbers mono 600): canvas text, set on a ground-coloured plate at 85% so it stays legible over traces.

### Named Rules
**The Figures-In-Mono Rule.** Every number is set in Geist Mono with tabular figures, including numbers inside sentences ("0.42–1.31 km · S1"). Words around them stay in Geist.

**The Quiet Weight Rule.** Weights stay between 400 and 600 on the analysis surface. Emphasis comes from colour state and the mono switch, not from black weights.

## Layout

The analysis tab is a two-column grid: a 320px rail tiled against a fluid main column by a single seam (280px under 1180px). The rail and main column scroll independently inside a full-height app; the main column is a stack of full-width sections, each separated by a bottom seam, with 16px 20px 18px padding. The rail's blocks pad at 14px, and list rows run full-bleed (negative 14px margin) so hover fills reach the seam.

Rows are 32px minimum. Gaps follow a tight 6 / 8 / 12 / 16px rhythm; facts are separated by vertical seams rather than whitespace. Charts share a 64px left margin so labels in the energy rows line up with the canvas plot area, and stacked chart panels sit 18px apart on one distance axis.

Under 860px the grid becomes a single column ordered answer first: verdict, then the lap rail (list capped at 260px and scrolling), then the charts. Sections pad 14px 16px; the compare canvas drops from 560px to 480px; keyboard hints hide.

## Elevation & Depth

Flat. Depth is tonal: ground, panel, raised, each one step lighter, divided by a one-pixel seam. There are no drop shadows on the analysis surface. The only box-shadow uses are one-pixel inset rings that act as borders (the selected segment, an empty swatch, the "no flow" legend block). Canvas washes (aero at 5%, loss zones at 7%, delta fill at 14%) are translucent state, not lighting.

### Named Rules
**The Seam Rule.** Separate with a one-pixel seam or a tonal step, never with a shadow or a gap that floats a card. If two regions need distinguishing, tile them and draw the line.

## Shapes

Small, functional radii. Controls and segmented wells take 6px; inner segments 4px; checkboxes, zone numbers and the reference tag 3px; swatches 2px; count badges and filter chips are full pills (999px). Sections and the rail are square-edged tiles; they meet seams, not corners. The recurring geometry is the bracket: a loss zone is drawn as a red line across the top of its distance range with 6px downstrokes at each end and its number above, echoed in the verdict list by the 20px outlined number box. Dashes mean "reference" everywhere: a dashed trace, a dashed swatch (a 14 by 3px repeating gradient), a dashed tag border.

## Components

### Buttons
Compact and quiet; they look like console controls, not calls to action.
- **Shape:** gently squared (6px).
- **Default:** graphite-raised fill, seam-strong border, ink text, label type, 4px 10px.
- **Hover / Focus:** border lifts to ink-muted (0.15s); focus is the global 2px focus-blue outline at 2px offset.
- **Selected:** focus-blue border over an 18% control-blue tint.
- **Quiet:** no fill, transparent border, ink-muted text; gains a seam-strong border on hover.
- **Disabled:** 45% opacity.

### Segmented controls
- **Style:** a graphite-ground well, seam-strong border, 2px inner padding and gap.
- **State:** off segments are ink-muted on nothing; the on segment is graphite-raised with ink text and a one-pixel seam-strong inset ring. Carries `aria-pressed`.

### Chips
- **Style:** pill, seam-strong border, ink-muted 11px text, used as energy-map filters.
- **State:** on raises the text to ink and border to ink-muted; off drops to 45% opacity, restored on hover.

### Tabs
- **Style:** text-only on the panel bar, 14px 500, ink-muted; hover to ink.
- **Active:** ink text with a 2px focus-blue bottom border. A mono pill count sits beside the label.

### Lap rail
The signature list. Each 32px row holds a real checkbox, a slot swatch, the lap name, a mono time and a mono gap to the reference.
- **Checkbox:** 16px, 3px radius, 1.5px seam-strong border on the ground; checked fills with the lap's slot colour and a ground-coloured check.
- **Row states:** hover graphite-raised; selected a 6% focus-blue wash.
- **Ref toggle:** hidden until row hover or focus (always shown for compared laps on touch); when on, ink text in a dashed ink-muted border on graphite-raised.

### Verdict and loss zones
The answer line in display type, the gap in mono and coloured by state, then a seam-ruled list of up to three loss zones, biggest first. Each zone is a full-width button: outlined red number box, mono distance range with sector and minis in dim, the mono loss figure in lost-red-text, and the reason in ink-muted. Hover is graphite-raised; the active zone takes an 8% red wash and a filled number box. Activating a zone eases every chart to its range.

### Data table
- **Header:** sticky, graphite-raised, label type in ink-muted; sortable headers brighten to ink.
- **Rows:** seam-ruled, right-aligned mono figures, hover graphite-raised; group rows use title type in ink-dim on the panel.

### Charts
Canvas panels on graphite-panel, grid lines at 10% ink-muted, zero line at 50%. Compared laps draw in slot colours, the reference in dashed ink-muted. Loss zones are bracketed red ranges; aero zones are amber washes with an amber edge. The cursor is a 55% ink hairline and the readout below the chart lists each lap's values in mono.

## Do's and Don'ts

### Do:
- **Do** tile panels edge to edge and divide them with a one-pixel seam (seam), stepping tone from ground to panel to raised.
- **Do** reserve purple for session best, green for gained, red for lost, amber for active aero and blue for focus and selection.
- **Do** set every figure in Geist Mono with tabular figures, including figures inside prose.
- **Do** draw the reference lap in ink-muted with a 6/4 dash, and give compared laps fixed slot colours that never borrow a state hue.
- **Do** lead an analysis surface with its answer in plain words, then let one shared zoom carry every chart to the range in question.
- **Do** keep controls compact (4px 10px, 6px radius) and make every control reachable and visibly focused by keyboard.

### Don't:
- **Don't** use drop shadows or glows for depth; one-pixel inset rings standing in for borders are the only box-shadow the surface uses.
- **Don't** use decorative gradients; repeating gradients that draw dashes are the only gradients the world uses.
- **Don't** float rounded cards with gaps between them on the analysis surface.
- **Don't** spend an accent hue on chrome, headings or emphasis that carries no state.
- **Don't** set display or heading text at black weights (800 to 900); the analysis surface tops out at 600.
- **Don't** style with team liveries or logos; team colour appears only as an 8px identification dot beside a driver.
