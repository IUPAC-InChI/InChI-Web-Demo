# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: InChI algorithm developers and maintainers.** Their job is comparing what different
InChI versions produce for the same structure — across shipped releases (1.06, 1.07.5), the `dev`
branch, and unreleased feature branches and open pull requests. When two users' needs conflict,
this workflow wins. Confirmed by the user.

Also real, not privileged:
- **Bench chemists** — have a structure, need its identifier, convert occasionally, don't track versions.
- **Database curators** — batch work through SD files; need reproducible option sets and tabular output.

Contact route for all of them: `inchi@ac.rwth-aachen.de` (RWTH Aachen), plus GitHub issues on
`IUPAC-InChI/InChI-Web-Demo`.

## Product Purpose

Generate and interconvert IUPAC chemical identifiers — InChI, InChIKey, AuxInfo, RInChI and the
three RInChIKey variants — from drawn structures, pasted molfiles, AuxInfo, or uploaded SD files.

**This is a tool people depend on, not a demonstration.** Confirmed by the user: it is cited from
papers and used in real curation workflows. "Demo" in the repository and page title is historical
baggage, and the surface should not present itself as a toy.

**Open decision — the public name.** The largest type on the page still reads "InChI Web Demo",
which restates the very thing this section flags. Renaming is not a design call: the name is what
papers cite, what the repository is called, and what the deployed URL implies, so changing it is
the maintainers' decision and needs a redirect story. Recorded here rather than silently changed.
Until it is decided, the tagline carries the honest description ("Chemical identifiers generated in
your browser, never on a server") and the page title spells out what the tool does.

Success means a user gets a correct identifier they can trust, attribute to a specific algorithm
version, and reproduce later.

## Positioning

Multiple InChI algorithm versions — including unreleased dev branches and open PRs — runnable
side by side, in the browser, with no install and no server. No neighbouring tool offers output
from an open pull request against a released version for the same structure.

Second, inseparable claim: **structures never leave the machine.** The C libraries are compiled to
WebAssembly and run locally. The single exception is the report form, which sends a structure the
user explicitly chooses to report.

## Operating Context

- Pure client-side static site on GitHub Pages. Deployment is a manual workflow trigger.
- Users arrive from published papers and supporting information, from InChI Trust material, and
  from the GitHub repository.
- Four input routes: draw in the embedded Ketcher editor, paste a molfile, paste AuxInfo, upload
  an SD file. Reactions are RInChI-only; the InChI paths reject structures with reaction arrows.
- 3D structure display and atom annotations (index, canonical index, equivalence class, hydrogen
  group, hydrogen group class) via NGL.
- **Option checkboxes map one-to-one onto real InChI command-line flags.** Users need to reproduce
  a run in a pipeline later, so the assembled flag set is part of the output, not a UI preference.
- Version metadata (`pages/inchi_versions.json`) carries the upstream commit and a URL per version,
  so a result is traceable to a specific source revision.

## Capabilities and Constraints

- **No backend of any kind.** No accounts, no server-side storage, no server-side compute.
- One Emscripten WASM module per InChI version (~1 MB each, ~410 KB gzipped), loaded on demand;
  RInChI is a separate ~1.4 MB module. Eight InChI versions are currently published.
- **All eight versions must stay selectable** — including dev branches and open PRs. They may be
  grouped or relabelled; none may be hidden or dropped. (Confirmed constraint.)
- **Every InChI option flag must stay reachable.** Flags may be reorganised, grouped, or
  progressively disclosed; capability may not shrink. (Confirmed constraint.)
- **Ketcher stays as the structure editor**, embedded as an iframe. Its internal appearance is not
  ours to change and swapping editors is off the table. (Confirmed constraint.)
- Errors from the WASM bridge surface as fields on the result object (`return_code`, `error`), not
  as exceptions — the UI is responsible for turning them into something a human can act on.
- Matomo analytics (`matomo.beilstein.org`, site 10) is loaded on the page.

## Brand Commitments

- `--inchi-brand: #00612c` is institutional colour, not a style choice. A palette may be built
  around it; it may not be replaced. (Confirmed constraint.)
- The InChI Trust logo and the seven funder logos on the About surface stay. (Confirmed constraint.)
- Funders that must remain credited: Volkswagen Foundation, the German Research Foundation via
  NFDI4Chem (project 441958208), BMBF, the European Union / NextGenerationEU, DALIA, and the
  Beilstein-Institut.
- **Voice, as already evidenced in the product's own error copy:** domain-fluent, plain, and
  non-blaming — it names the state, the cause and the fix in the user's own vocabulary
  ("This drawing is not a reaction yet. Add a reaction arrow to convert it to a RInChI."). This is
  the product's strongest existing asset and future copy should match it.

## Evidence on Hand

- Real, well-written error and hint copy throughout `pages/index.js` and `pages/components/`.
- Real funder logos and links in `pages/components/about.html` and `pages/img/`.
- Real version provenance: upstream commits and release/PR URLs per version in
  `pages/inchi_versions.json` (e.g. PR #251, #230, #258).
- Real dependency credits with DOIs (NGL: `doi:10.1093/bioinformatics/bty419`; Ketcher).
- **Absent, and not to be fabricated:** user counts, download or usage statistics, testimonials,
  named institutional adopters, citation counts, performance benchmarks, and any claim about how
  many people rely on the tool.

## Product Principles

1. **Provenance is part of the answer.** An identifier without the version that produced it is
   incomplete. Every result should be attributable and reproducible.
2. **Comparison is the job, not a feature.** The primary user is here to see how versions differ;
   a design that shows one answer at a time is fighting the product.
3. **Nothing leaves the browser — and the one exception is disclosed where it happens,** not on
   another tab.
4. **Expert vocabulary is correct vocabulary.** Chemists' terms stay; the fix for an intimidating
   interface is structure and explanation, never dumbing down the language.
5. **Full capability stays reachable.** Progressive disclosure is welcome; removal is not.

## Accessibility & Inclusion

Working target: **WCAG 2.1 AA**. The user confirmed there is no formally binding standard on the
table, and that the accessibility findings should be fixed properly rather than to a checkbox.

**Open question, recorded rather than answered:** whether EU / NextGenerationEU, BMBF and DFG
funding brings EN 301 549 or BITV 2.0 obligations. Designing to WCAG 2.1 AA keeps either answer
viable.

Known user needs from the audit: keyboard-only and screen-reader access to every explanation in
the app (currently hover-only), grouped radio sets, accessible names on icon-only controls, a real
heading structure on the tool surface, and touch-adequate targets on stylus devices that report a
fine pointer.
