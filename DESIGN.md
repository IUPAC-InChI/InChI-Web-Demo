---
name: InChI Web App
description: A chemical-identifier tool built on lifted surfaces and quiet rules, where the answer reads as notation rather than text.
colors:
  ground: "#f4f7f5"
  field: "#ffffff"
  field-sunken: "#f0f4f1"
  ink: "#16201b"
  ink-muted: "#4c5a52"
  ink-faint: "#5e6c64"
  rule-hairline: "#dbe3dd"
  rule: "#7e8b84"
  rule-stroke: "#59665f"
  brand: "#0b7440"
  brand-hover: "#085a32"
  brand-quiet: "#e6f5ec"
  on-brand: "#ffffff"
  focus-ring: "rgb(11 116 64 / 0.3)"
  selection-bg: "#c8ecd8"
  selection-text: "#0d1a12"
  error: "#c02b1d"
  error-quiet: "#fdecea"
  annotation-index: "#e2e5e7"
  annotation-equivalence-class: "#e6d093"
  annotation-canonical-index: "#87cbab"
  annotation-hydrogen-group: "#8aaad4"
  annotation-hydrogen-group-class: "#ae7bbe"
  annotation-ink: "#0b120e"
typography:
  display:
    fontFamily: "system-ui stack (inherited; no display face)"
    fontSize: "clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "system-ui stack (inherited)"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  identifier:
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  secondary:
    fontFamily: "system-ui stack (inherited)"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  fine:
    fontFamily: "system-ui stack (inherited)"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  apparatus:
    fontFamily: "system-ui stack (inherited)"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.09em"
    textTransform: "uppercase"
  apparatus-micro:
    fontFamily: "system-ui stack (inherited)"
    fontSize: "0.5625rem"
    fontWeight: 500
    letterSpacing: "0.09em"
    lineHeight: 1.2
    textTransform: "uppercase"
rounded:
  sm: "8px"
  md: "12px"
spacing:
  tight: "0.35rem"
  cell: "0.5rem"
  row: "0.5rem"
  head: "0.75rem"
  gutter: "1rem"
  block: "1rem"
  plate-gap: "1rem"
components:
  notation-plate:
    backgroundColor: "{colors.field}"
    rounded: "{rounded.md}"
    shadow: "0 1px 2px rgb(16 32 24 / 0.06), 0 12px 28px -16px rgb(16 32 24 / 0.35)"
  plate-head:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.apparatus}"
    padding: "0.75rem 1rem"
  version-stamp:
    textColor: "{colors.brand}"
    typography: "{typography.apparatus}"
  layer-key:
    backgroundColor: "{colors.field-sunken}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.apparatus}"
    padding: "0.5rem 1rem"
  layer-value:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.identifier}"
    padding: "0.5rem 1rem"
  panel:
    backgroundColor: "{colors.field-sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.75rem"
  status-line:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.secondary}"
    padding: "0.5rem 0.75rem"
  status-line-error:
    backgroundColor: "{colors.error-quiet}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.sm}"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
    textColor: "{colors.on-brand}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
  button-outline-hover:
    backgroundColor: "{colors.field-sunken}"
    textColor: "{colors.ink}"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "0.4rem 0.7rem"
  nav-link-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
  annotation-chip:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.fine}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  option-help:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    size: "1.15rem"
  dialog:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "20px"
---

# Design System: InChI Web App

## Overview

**Creative North Star: "Soft Modern"**

A thing on this surface is bounded by the surface it sits on, not by a line drawn around it. A
plate is a white card lifted off a faintly green-grey ground by a soft shadow and a 12px radius;
rules retreat to hairlines that separate rows inside a card and do nothing else. Hierarchy comes
from elevation, surface and space, with a type scale that has real steps; colour is held back for
three jobs and used nowhere else. The identifier, which is the whole point of the tool, is not
printed as a line of text but *drawn* as a keyed stack of its real layers — version, formula, `/c`
connections, `/h` hydrogens, `/t` tetrahedral, `/m` parity — one row per layer, keyed in the
margin, in a monospace where characters align column-for-column so two versions can be read
against each other.

Softness is a surface treatment, not a licence to spread out: the plates are roomier than a
drawn-rule world would allow, but the information density is unchanged, and small tracked
uppercase labels — *apparatus*, in the reference-book sense of a running head or a plate number —
still name a layer, a panel or a stamp without competing with the content they sit on.

The one line that stays a line is a control boundary. WCAG 1.4.11 holds it to 3:1, so the rule
scale splits by job rather than by weight: a decorative hairline that may be quiet, and a control
rule that may not. Getting this wrong is the characteristic failure of a soft interface — inputs
that dissolve into the card behind them — and it is the reason there are two rule tokens here
instead of one.

What this world refuses, explicitly: the category default of four identical cards holding the
answer, the derived answer, a diagnostic dump and an error channel as visual peers. The answer
gets a plate; the evidence gets a collapsed hairline summary. It also refuses hue as a carrier of
difference — a layer that moved between two versions is marked with a hashed-bond glyph, a 3px
gutter stroke and heavier ink, never with red and green.

**Key Characteristics:**
- Elevation is the bounding device: a plate is a lifted card, not a box drawn with a rule.
- The rule scale splits by job, not by weight: hairline separates (decorative, may be quiet), rule bounds a control (3:1, never quiet), stroke marks the active or divergent thing (3px).
- Colour is scarce by rule, not by accident: one institutional green, one error hue, five categorical atom chips.
- No display typeface — the voice is in the surfaces, not in a face. Monospace only where alignment is data.
- Light and dark are both first-class, defined in full rather than derived from each other. In dark the shadow stops carrying the lift and the lighter surface takes over.
- Difference is carried by mark and weight, so it survives greyscale, print and colour-vision deficiency.

## Colors

A deliberately short palette: two neutral families (ground/field and ink), a three-step rule
scale, one institutional green, one error hue, and a five-step categorical key for atom
annotations. Every colour token is defined for light on bare `:root` and redefined once for dark;
none has its only definition inside a media block. Canonical values are in the frontmatter — the
dark-theme counterparts are in `.impeccable/design.json`.

### Primary
- **Institutional Green** (`brand`): the InChI Trust green. Carries links, the primary button, the checked state of a checkbox or radio, the version stamp on every plate, and the whole focus system. In dark it lifts to a paler tint of the same hue, because the light value is 1.6:1 on a dark field and unusable. It is a brand commitment, not a style choice — a palette may be built around it, it may not be replaced.
- **Green Tint** (`brand-quiet`): a fill that carries ink on top; not used for text.
- **Focus Ring** (`focus-ring`): the translucent halo behind the focus outline, and the value behind Bootstrap's `--bs-btn-focus-shadow-rgb`.

### Secondary
- **Struck Red** (`error`): the one outcome hue. Appears on the status line's left stroke and its mark, and as text ink on failure. `error-quiet` tints the failed status line's field.
- Success has **no colour of its own** — it aliases the brand green, so a working conversion and an institutional link speak with one voice.

### Tertiary
The five atom-annotation chips are a **categorical set, not a scale**: each marks a different kind
of index in the 3D viewer and they stack on one atom.

- **Slate** (`annotation-index`) — L 0.78
- **Ochre** (`annotation-equivalence-class`) — L 0.64
- **Green** (`annotation-canonical-index`) — L 0.51
- **Nitrogen Blue** (`annotation-hydrogen-group`) — L 0.39
- **Violet** (`annotation-hydrogen-group-class`) — L 0.27
- **Annotation Ink** (`annotation-ink`) — the dark label that sits on any of them.

They step through relative luminance as well as hue, with no two closer than 0.119, so the key
stays readable in greyscale and under colour-vision deficiency; each carries dark ink at 5.7:1 or
better.

### Neutral
- **Ground** (`ground`): the page. A faintly green-grey the white field lifts off.
- **Field** (`field`): the surface of a plate, an input, the status line.
- **Sunken Field** (`field-sunken`): a control panel and the layer-key column; where something sits *into* the page rather than on it.
- **Ink** (`ink`): body text and every drawn mark. 15.8:1 on the ground.
- **Muted Ink** (`ink-muted`): real secondary text — apparatus labels, inactive tabs, hints. 7.4:1.
- **Faint Ink** (`ink-faint`): placeholders, empty-state copy, separators, disabled labels. 4.6:1 on the sunken panel, its worst case.
- **Hairline / Rule / Stroke** (`rule-hairline`, `rule`, `rule-stroke`): three line *jobs*, and only two are held to 3:1. The hairline separates rows inside a surface whose own edge already bounds it, so it is deliberately near-invisible and is not a 1.4.11 boundary. The rule bounds a control — every input, select and chip border — so it clears 3:1 against both the field it sits on and the ground behind it. The stroke marks rather than bounds, and keeps a 3px weight where the other two are hairlines.
- **Selection** (`selection-bg`, `selection-text`): ink on a brand tint. This page's whole job is text you select and copy, so selection is a legibility requirement.

### Named Rules

**The Three Jobs Rule.** Colour does exactly three jobs on this surface: the institutional brand,
an outcome (error or success), and the categorical atom key. A new element that wants a fourth
job gets a surface, a type step or the stroke instead. Audit test: cover the annotation chips and the
status line — any remaining hue on screen other than brand green is a violation.

**The Mark-Not-Hue Rule.** Divergence is never carried by colour. A layer that differs between two
versions gets the hashed-bond mark, a 3px gutter stroke and weight 600; the superseded value is
struck through, not deleted. The comparison must remain fully readable in greyscale.

**The Fixed-Key Rule.** The five annotation chips deliberately do **not** change between themes. A
categorical key has to mean the same colour in both; only the surroundings change. They clear
5.2:1 against the dark field as drawn.

**The Quiet-Hairline Exception.** `rule-hairline` is the one token allowed below 3:1, because the
boundary it marks is already carried by a surface change. Nothing that bounds a control may take
its border from it. `test/check_contrast.py` encodes this: the hairline pairs are reported as
deliberate deviations, everything else must pass.

**The Both-Themes-First Rule.** Every colour is defined on bare `:root` for light, redefined under
`@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`, and redefined
again under `:root[data-theme="dark"]` so an explicit choice wins in both directions. Never give a
colour its only definition inside a media block.

## Typography

**Display Font:** none. The system stack, inherited.
**Body Font:** the system stack, inherited (no `font-family` is declared on `body`).
**Identifier Font:** `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`.

**Character:** This world has no typographic costume. Identity comes from the surfaces, the
spacing and the locants, so UI text stays on the system stack where it belongs for a dense tool, and
the one deliberate typographic choice is the identifier itself. Monospace is *earned* here rather
than worn: an InChI is measurement data whose characters must align column-for-column for a diff
to be readable.

### Hierarchy

The audit found nine sizes spanning 2.0:1 — Bootstrap's defaults, a flat hierarchy pretending to
be a rich one. The replacement scale spans 3.6:1 (2.5rem down to 0.6875rem) and every step has a
job.

- **Display** (600, `clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem)`, lh 1.1, ls -0.02em): the `<h1>` in the masthead. One per page.
- **Body** (400, 1rem, lh 1.5): running text and form labels.
- **Identifier** (400, 0.9375rem, mono): layer values and InChIKey blocks — the answer. A slightly smaller sibling (0.875rem mono) sets the raw `<pre>` result text, and 0.8125rem mono sets paste areas, where the placeholder is a format example rather than prose.
- **Secondary** (400, 0.875rem): the status line, the comparison summary, the masthead tagline, hints.
- **Fine** (400, 0.8125rem): empty-state copy, annotation chip labels, the "clear comparison" link.
- **Apparatus** (500–600, 0.6875rem, ls 0.09em, uppercase): section headings, layer keys, version stamps, plate titles, the demoted-plate summary. Weight 600 when it is a real heading or a stamp, 500 when it is a caption.
- **Apparatus Micro** (0.5625rem, lh 1.2, `ink-faint`): the label under each InChIKey block. The only step below apparatus, and it exists solely to name three blocks without pushing them apart.

`font-variant-numeric: tabular-nums` on the options changed-count, so a number that ticks between
1 and 2 digits does not shift the label beside it.

### Named Rules

**The Earned Monospace Rule.** `--inchi-font-identifier` is for identifier values only — layer
values, InChIKey blocks, result text, paste areas. Monospace on UI chrome, headings or prose is a
costume and is not permitted.

**The No-Face Rule.** No display or brand typeface is loaded, ever. If a surface needs more
presence, it gets elevation, space or a type step — not a face. A webfont added for
identity is a violation of the world, not an extension of it.

**The Apparatus Rule.** Anything that *names* a thing rather than being the thing is set in
apparatus: 0.6875rem, 0.09em tracking, uppercase, `ink-muted`. This is the only place tracking and
uppercasing are allowed.

## Layout

The page is a single Bootstrap `container-md` with a 2rem tail. The masthead sits on the page
grid — logo, then `<h1>` and tagline on one baseline — with a `rule` hairline under it. Below it, pill
tabs (InChI / RInChI / About), then per-tool tab rows.

The tool grid is `col-xl-8` + `col-xl-4`: editor or paste box left, version selector and options
right as margin apparatus. **That means the layout is single-column below 1200px**, not below
992px. Within one column the order is: status line, answer plate, derived answer plate,
comparison controls, comparison plate, then a collapsed `<details>` holding AuxInfo and the
library log.

Spacing rhythm is a small reused set rather than a formal scale: 0.5rem/1rem inside a layer cell,
0.75rem/1rem in a plate head, 0.5rem/0.75rem in a status line or key block, 0.75rem of panel
padding, and 1rem both between comparison items and above a plate. The cell and head paddings are
a step more generous than a drawn-rule world would allow — a lifted card needs its content to sit
*inside* the card, not against its edge — but the row count is unchanged. Bootstrap's `mt-1`/`mt-2`
utilities carry the rest.

Responsive behaviour that is load-bearing:

- **1200px** — the only real layout breakpoint. The grid stacks, the paste area relaxes from 7rem to 12rem, and the comparison stack drops from two columns to one.
- **768px** — the NGL viewport goes from a viewport-relative share to a fixed 420px.
- **~855px and below** — the editor's and paste box's `min-height` floors (`min(530px, 62vh)` / `min(530px, 34vh)`) take over from the aspect ratio, so a phone does not get a 530px editor pushing the results two screens down.
- **Coarse pointer** (`pointer: coarse` **or** `any-pointer: coarse`) — every interactive target reaches 44px. Keyed to the pointer, not the viewport, because a stylus 2-in-1 reports a fine primary pointer and still needs the targets, while a narrow desktop window does not.
- `env(safe-area-inset-left/right)` padding on `body`, with `viewport-fit=cover`, so landscape on a notched phone does not run text under the cutout.

### Named Rules

**The One Breakpoint Rule.** The stacking breakpoint is 1200px and it lives in three places that
must stay in step: `INCHI_STACK_BREAKPOINT` in `pages/index.js`, the `@media (min-width: 1200px)`
rules in `pages/css/index.css`, and the `col-xl-*` classes in the markup. **These have already
drifted apart once** — the options panel checked 991.98px while the grid stacks below 1200px, so
between 992 and 1199.98px the layout was single-column and the panel opened itself expanded
anyway, which is the exact regression its own comment claimed to prevent. Anything reasoning about
"is the layout stacked?" reads the constant. Changing the grid to `col-lg-*` means changing all
three.

**The Answer-Above-Evidence Rule.** In one column the order is status, then answer, then evidence.
AuxInfo and the library log are collapsed by default behind one hairline summary; they are never
given a container equal to the identifier's. The status line sits **above** the plate (a cited
deviation from the direction contract, which first put it beneath): it answers "did that work?",
which is read before the answer, and on a failure there is no plate to read under.

**The Never-Blank-Then-Fill Rule.** A result being replaced stays readable at 0.45 opacity with
its version stamp suffixed "· superseded", while the new one loads. Blanking a field and waiting
several seconds on a cold ~1 MB WebAssembly module is not a loading state.

## Elevation & Depth

**Depth is the bounding device.** There are exactly three ground levels — `ground` (the page),
`field` (a plate, an input, the status line), `field-sunken` (a control panel, the layer-key
column) — and a plate reads as a discrete object because it is lifted off the ground, not because
a line is drawn around it. Two elevations only: a plate at rest, and a modal dialog genuinely
above the page over a dimmed backdrop. Nothing lifts on hover, and there is no third step.

In dark the shadow stops doing the work — a soft black blur on a near-black ground is invisible —
so the lighter field surface carries the lift and the shadow only deepens the separation. This is
why the plate shadow is redefined per theme rather than reused.

### Shadow Vocabulary
- **Plate** (`--inchi-shadow-plate`, `0 1px 2px rgb(16 32 24 / 0.06), 0 12px 28px -16px rgb(16 32 24 / 0.35)` light, deepened for dark): every `.notation-frame`. A tight contact shadow plus a wide soft one — the contact shadow is what stops the card looking pasted on.
- **Dialog** (`--inchi-shadow-dialog`, `0 12px 32px -8px rgb(12 16 14 / 0.35)` light / `rgb(0 0 0 / 0.6)` dark): only on `.inchi-dialog`.
- **Backdrop** (`--inchi-backdrop`): the `::backdrop` wash behind a modal.
- **Scroll affordance** (`linear-gradient(to top, rgb(0 0 0 / 0.05), transparent 1.5rem)` on a non-empty `.inchi-result-text`): a bottom fade signalling that a capped result scrolls. A gradient, not a shadow, and the one depth cue outside a dialog.
- **Gutter stroke** (`box-shadow: inset 3px 0 0 var(--inchi-rule-stroke)`): `box-shadow` used as a *drawn inset rule*, not as elevation. Same device marks the active nav tab (`inset 0 -3px 0`).

### Named Rules

**The Two-Elevation Rule.** There are exactly two elevations: the plate and the dialog. Panels,
chips, buttons, inputs and popovers are flat, and nothing lifts on hover or focus — a surface that
rises when touched is a third elevation nobody declared. `box-shadow: inset` is a different device
— a rule the layout engine can draw inside a cell — and is unrestricted.

## Shapes

Two radii and nothing between them: `--inchi-radius-sm` is `8px` (buttons, inputs, panels, chips,
tabs, the status line, the logo mount) and `--inchi-radius-md` is `12px` (a plate, a dialog).
Bootstrap's `--bs-border-radius`, `-sm` and `-lg` hooks are wired to them so the framework's own
components inherit the decision rather than being overridden selector by selector. Small round
marks — the option-help badge, the outcome dialog's glyph, the theme knob — are full circles, and
the theme switch's track is a pill.

Form language is the **three line jobs**, which are no longer a weight scale:

| Token | Weight | Job | Contrast |
| --- | --- | --- | --- |
| `rule-hairline` | 1px | separates rows *inside* one surface | decorative, exempt |
| `rule` | 1px | bounds a control | 3:1 (1.4.11) |
| `rule-stroke` | 3px | marks the active or divergent thing | 3:1 |

The recurring silhouette is the **plate**: a `field`-coloured card on the ground, 12px corners,
`--inchi-shadow-plate`, and a hairline border that keeps the edge from dissolving where a shadow
is hard to see — a dark theme, forced colours, or a printout. It carries `overflow: hidden`,
which is what lets the corner actually clip the key column and the plate head, both of which paint
their own background out to the plate's edge.

Icons are one authored 16×16 set at 1.5px stroke, `currentColor`, no fill, square joins and mitre
corners — the same hand as the chemistry marks. Chemistry marks are a separate 12×12 family in the
same weight: a filled wedge for confirmed, crossed strokes for refused, an open square for in
progress, a hashed bond for a layer that differs. The disclosure triangle on a `<summary>` is
drawn the same way, with `clip-path` on a 0.5rem square.

### Named Rules

**The Two-Radii Rule.** `8px` for a control, `12px` for a plate or dialog, `50%` for a small round
mark. No third value, and no literal pixel radius in a rule that could name a token.

**The Clip-The-Card Rule.** Any container with `--inchi-radius-md` whose children paint their own
background to its edge needs `overflow: hidden`, or the children square off the corners the
container just rounded. This is why `.notation-frame`, the Ketcher iframe and the NGL viewport all
carry it.

**The One-Hand Rule.** Every glyph on the surface is authored in `ICON_PATHS` / `notationMark()` at
one stroke weight. The Bootstrap Icons webfont was removed entirely (121 KB woff2 plus a 95 KB
stylesheet declaring ~1800 icons, serving eight glyphs) — not subsetted, removed. Two icon systems
on one surface is the defect; a second icon dependency is not permitted. `pages/inchi-layers.js`
carries a self-check that fails if a glyph the interface uses is not authored there.

## Components

### Buttons
- **Shape:** 8px corners, no shadow, no transform — a button is on the plate, not above it.
- **Primary:** brand green field with `on-brand` ink; hover and active both go to `brand-hover`. Disabled drops to the sunken field with a hairline border and faint ink. Branded through Bootstrap's `--bs-btn-*` hooks on `.btn-primary` rather than by overriding selectors.
- **Outline / secondary:** transparent field, `ink-muted` ink, `rule` border — a control boundary, so never the hairline. Hover fills with the sunken field and promotes the border to `rule`; active promotes it to `rule-stroke`. This is the default for result-plate actions (copy, download) and for "Pin this result".
- **Focus:** one system for everything — a 1px `brand` outline at 2px offset, the element's own border promoted to `rule-stroke`, and `box-shadow: none`. Bootstrap's blue focus glow is neutralised at the token level via `--bs-btn-focus-shadow-rgb`, because a green button flashing blue on focus is two systems arguing.
- **Link button** (`.link-button`): a real `<button>` that reads as body text in brand green, underlining on hover. Used where an action must be keyboard-operable but must not look like a control.
- **Touch:** 44px minimum height on any coarse pointer.

### Chips
- **Style:** the five annotation toggles are chips, each carrying its own **swatch at rest** — a 0.85rem 3px-cornered square in the annotation colour with a `rule` border. The control *is* the legend: the colour-to-meaning mapping is readable before anything is pressed. Field background, `rule` border, 8px corners, `ink` label at 0.8125rem.
- **State:** `aria-pressed="true"` fills with `brand-quiet`, promotes the border to `brand`, and takes the label to weight 600. The pressed state used to be read off a heavier border; both rule weights are 1px in this world, so fill carries it instead — fill *and* weight, so it does not rest on hue alone. Hover promotes the border colour only. Disabled drops the label to faint ink and the swatch to 0.4 opacity.
- These previously read as a tab strip of white boxes whose colour appeared only once pressed. The swatch-at-rest is the fix and is not optional.

### Cards / Containers
There are no cards. There are two container kinds.

- **Notation plate** (`.notation-frame`): `field` background, 12px corners, `--inchi-shadow-plate`, a hairline border, and `overflow: hidden` so the corner clips. Internally divided by hairlines only. Carries a head (apparatus title left, version stamp and actions right, hairline underneath, 0.75rem/1rem padding) and a body.
- **Panel** (`.bounding-box`): 1px hairline border, `field-sunken` background, 0.75rem padding. Groups controls — version selector, options, viewer. Often a `<details>`, whose `<summary>` gets the authored triangle because `display: flex` kills the native `::marker` in Blink and WebKit.

### Inputs / Fields
- **Style:** `field` background, `ink` text, `rule` border — the token that clears 3:1, because this is exactly the boundary 1.4.11 is about — and 8px corners. Placeholders in faint ink. Checkboxes keep Bootstrap's own small radius; checked state is brand green, overridden explicitly because Bootstrap 5.2.3 hardcodes it.
- **Focus:** the shared brand outline at 2px offset.
- **Select caret:** Bootstrap bakes `#343a40` into the caret's data URI, which is 1.5:1 on the dark field — a 1.4.11 failure on the version selector, the most important control here. A data URI cannot read a custom property, so the caret stroke is written literally once per theme.
- **Paste areas:** identifier mono at 0.8125rem, 12rem tall stacked and 7rem on the wide layout, `resize: none` where the container sizes them.
- **Option help** (`.option-help`): a 1.15rem round bordered badge, 44px on touch. The option explanations used to hang on a non-focusable `<i>` with the text in `data-bs-title` — no accessible name, no keyboard path. They are real buttons.

### Navigation
Tabs in the world's vocabulary: a hairline baseline under the row with 0.35rem of inset, tabs at
0.4rem/0.7rem in `ink-muted`, and the active tab marked by a **3px inset stroke** under it plus
weight 600 — not a filled pill. Hover previews the mark at hairline colour. Transitions on
box-shadow and colour at `--inchi-transition`. The plain `.nav-link` colour is re-asserted for
inactive buttons because Bootstrap's own rule would otherwise paint every inactive tab brand
green, which is why a wrapped tab row once read as three green links and one white box.

### The Keyed Notation Stack (signature)
The centre of the system. An InChI is rendered as a two-column CSS grid — `minmax(6.5rem,
max-content) 1fr` — one row per layer, hairline-separated, with the first row's top border
suppressed.

- **Key column:** sunken field, apparatus type, `ink-muted`, `white-space: nowrap`, 0.5rem/1rem padding. Contains the layer's InChI letter (`/t`) in full-strength ink at weight 600 with tracking reset — the letter is the *locant* of the notation, the thing you cite when you say "the /t layer differs" — followed by its name.
- **Value column:** field background, `ink`, identifier mono, `word-break: break-all`, `white-space: pre-wrap`.
- **Divergence:** a changed row gets `box-shadow: inset 3px 0 0 rule-stroke` in the key gutter, weight 600 on both cells, the hashed-bond mark inline, the previous value struck through in `ink-muted` (struck, not deleted — a lab notebook never erases a reading), the word "to", then the new value. A layer only one side emits reads "not emitted" in faint italic. Rows that agree are still shown but recede to faint ink, because knowing the formula and connections are identical is what makes "only the stereo layer moved" mean anything.
- **Version stamp:** apparatus type in brand green at weight 600, top-right of every plate head. Provenance is part of the answer — a string copied out without its version is not reproducible, and a selector 600px away is not provenance.
- **InChIKey blocks:** the 27-character key is split into skeleton (14) / stereo and isotopes (8–10) / protonation (1), each block a flex column with its own micro-apparatus label under it, hyphens as separate flex items so they sit on the identifier's baseline rather than stretching the column.
- **Empty state:** one faint-ink line of prose inside the plate naming what will appear there, never a blank box.

### Conversion Status Line
Always says what happened. A hairline-bordered `field` strip whose **left border is the 3px
stroke**, coloured to the outcome: hairline while neutral, brand on success, error hue on failure
(where the field also takes the error tint). A 12×12 chemistry mark leads — wedge for success,
crossed strokes for failure, open square pulsing at 1.1s for busy. The pulse is disabled under
`prefers-reduced-motion` in favour of a static 0.7 opacity.

The visible strip hides itself freely; the announcement it drives is written into a **separate,
never-hidden, never-moved** `role="status"` region, because a hidden node is out of the
accessibility tree and text written into one is not reliably announced — which would have made
this line invisible to exactly the users who most need it.

### Comparison Plate
A second notation plate, headed "Comparison" with a stamp reading `<pinned> to <current>` (or
`<version>, options differ` when the same version is pinned against itself with different flags),
a plain-language summary sentence, then the layer diff grid. Pinned results accumulate rather than
destroying the baseline. Two columns at 1200px and up, one below.

### Motion
Deliberately spare. One token, `--inchi-transition` (140ms `cubic-bezier(0.22, 1, 0.36, 1)`), used
on three things: the disclosure triangle's quarter turn, the nav tab's underline and colour, and
the annotation chip's border colour. Plus one keyframed pulse on the busy mark, and the theme
switch — a pill track across which ink sweeps at 320ms while a round knob slides and inverts as it
crosses into the inked half. The track's paper and ink are deliberately literal rather than
tokens: they *depict* light and dark rather than participating in the current theme. The triangle,
the pulse and the sweep are all guarded by `prefers-reduced-motion`. Nothing lifts, and no surface
animates its elevation.

## Do's and Don'ts

### Do:
- **Do** reach for a semantic token (`--inchi-field`, `--inchi-brand`) rather than a hex value. If no token fits, the value is probably one-off — keep it local to the rule that needs it instead of inventing a token for it.
- **Do** express hierarchy with surface and elevation first, then the line jobs: a hairline separates rows inside a card, `rule` bounds a control at 3:1, the 3px stroke marks the active or divergent thing.
- **Do** define a new colour for light on bare `:root` and redefine it in **both** dark blocks (`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and `:root[data-theme="dark"]`).
- **Do** brand Bootstrap through its `--bs-*` hooks; override a Bootstrap selector only where 5.2.3 hardcodes a value, and say so in a comment when you must.
- **Do** stamp every result with the version that produced it, and keep the stale result readable while a new one loads.
- **Do** give every plate an empty state that names what will appear there.
- **Do** pair every icon with a real accessible name on the control; icons are always `aria-hidden="true"` and `focusable="false"`.
- **Do** key touch sizing to `(pointer: coarse), (any-pointer: coarse)` — a stylus 2-in-1 reports a fine primary pointer and still needs 44px targets.
- **Do** read `INCHI_STACK_BREAKPOINT` when code needs to know whether the layout is stacked; never hardcode a width.
- **Do** run `node pages/inchi-layers.js` after touching the layer grammar or the icon set — it self-checks both.
- **Do** run `python3 test/check_contrast.py` after touching a colour token; it fails on anything below its threshold and lists the hairline exemption separately.
- **Do** give a control its border from `--inchi-rule`, never from `--inchi-rule-hairline` — the hairline is exempt from 3:1 precisely because nothing bounding a control uses it.

### Don't:
- **Don't** invent a third radius. 8px for a control, 12px for a plate or dialog, 50% for a small round mark.
- **Don't** add a third elevation. Plates and dialogs lift; nothing else does, and nothing lifts on hover or focus. Inset shadows used as drawn rules are a different device and are fine.
- **Don't** round a container whose children paint to its edge without `overflow: hidden`.
- **Don't** load a display, brand or icon webfont. Icons are authored in `ICON_PATHS`; chemistry marks in `notationMark()`.
- **Don't** use monospace for anything but identifier values.
- **Don't** carry difference, state or severity with hue alone — the comparison must read in greyscale. Mark, weight and position first; colour at most as reinforcement.
- **Don't** re-theme the annotation chips per theme; the categorical key means the same colour in both.
- **Don't** give the diagnostic evidence (AuxInfo, library log) a container equal to the identifier's, or expand it by default.
- **Don't** blank a result field and wait — mark it superseded at 0.45 opacity instead.
- **Don't** write a status message only into a node that can be hidden; the live region must be always present and must not move.
- **Don't** put uppercase or letter-spacing on anything that is not an apparatus label.
- **Don't** invent a second focus treatment. One brand outline at 2px offset, for every focusable thing.

---

## Known open, recorded as-is

These are the build's own gaps, not rules to inherit.

- **The masthead is partial.** It is bounded by a single rule and carries no elevation of its own, so it reads as a heading above the page rather than as part of the same lifted system. Not yet resolved either way.
- **Native devices of this world that go unused:** no hover or focus elevation anywhere (deliberate, but it means the plates never respond), no tonal surface between `field` and `ground`, and the answer plate begins below a 900px fold on the wide layout.
- **RInChI has no layer grammar.** The RInChI and its three key variants inherit the world (tokens, plates, nav, focus) but render as single runs of text. `pages/inchi-layers.js` parses InChI only.
- **Comparison handles two results, not three.** Pinning diffs one pinned result against the current one; three-way or a persistent column layout is not built.
- **No URL state.** A result is not addressable, so a comparison cannot be linked to a colleague or cited from a paper.
- **Two dialog stylesheets were never migrated to these tokens.** `pages/css/report-mask.css` and `pages/css/report-feedback.css` reference seven custom properties that do not exist anywhere in the project — `--inchi-text-muted`, `--inchi-border-strong`, `--inchi-surface-muted`, `--inchi-success-fg`, `--inchi-success-surface`, `--inchi-error-fg`, `--inchi-error-surface` — so those colours silently fall back to inherited values. The correct tokens are `ink-muted`, `rule`, `field-sunken`, `brand`/`brand-quiet` and `error`/`error-quiet`. **This is a defect, not a system rule.**
- A comment in `pages/css/index.css` refers to "`--inchi-stack-breakpoint` in index.js"; the actual name is the JS constant `INCHI_STACK_BREAKPOINT`. There is no such CSS custom property.

## Verification in-repo

- `node pages/inchi-layers.js` — self-check on the layer parser, the diff, the InChIKey split, HTML escaping and the icon set.
- `cd test && npx jest` — 3 suites (`inchi`, `rinchi`, `inchi-layers`), ~80 parameterised cases. Requires the WASM build to have run.
- `python3 test/check_contrast.py` — every text pair at 4.5:1 and every boundary pair at 3:1, in both themes, with the hairline exemption reported separately.
- `node <impeccable>/scripts/detect.mjs --json pages/index.html pages/components` — returns `[]`.
