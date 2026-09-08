"use strict";

/*
 * The InChI string is not opaque text — it is a layered notation, and this
 * splits it back into those layers.
 *
 *   InChI=1S / C6H6ClNO / c1-9-6-2-5(7)3-8-4-6 / h2-4H,1H3 / b... / t... / m1 / s1
 *   ^version   ^formula   ^connections           ^hydrogens
 *
 * After the version and the formula, every layer is identified by its leading
 * letter (IUPAC InChI Technical Manual, appendix 2). Two InChIs that describe
 * the same skeleton but disagree about stereochemistry differ in exactly one
 * layer, and a chemist wants to see *which* — so the UI renders these layers
 * as separate lines and marks the ones that diverge between versions.
 *
 * Used by index.js (result rendering, version diff) and by test/.
 */

/*
 * Keyed by the layer's letter prefix. `name` is what the interface calls the
 * layer; `hint` explains it in the vocabulary of someone reading a structure.
 * Order follows the canonical order layers appear in, so a rendered stack and
 * a diff both read top-to-bottom in InChI's own sequence.
 */
const INCHI_LAYERS = [
  ["formula", "Formula", "Molecular formula, Hill order."],
  ["c", "Connections", "Which atom is bonded to which, in canonical numbering."],
  ["h", "Hydrogens", "Where the mobile and fixed hydrogens sit."],
  ["q", "Charge", "Net charge of the structure."],
  ["p", "Protons", "Added or removed protons."],
  ["b", "Double bonds", "Cis/trans configuration around double bonds."],
  ["t", "Tetrahedral", "Parities at tetrahedral stereocentres."],
  ["m", "Parity", "Which enantiomer the parities are relative to."],
  ["s", "Stereo type", "Absolute, relative, or racemic stereochemistry."],
  ["i", "Isotopes", "Isotopic substitution."],
  ["f", "Fixed H", "Fixed-hydrogen layer (non-standard InChI)."],
  ["r", "Reconnected", "Reconnected-metal layer (non-standard InChI)."],
];

const INCHI_LAYER_NAMES = new Map(
  INCHI_LAYERS.map(([key, name, hint]) => [key, { name, hint }])
);

/*
 * Split an InChI into ordered layers.
 *
 * Returns `{ prefix, version, layers }`, where `layers` is an array of
 * `{ key, name, hint, value }` in canonical order. A string that does not
 * start with "InChI=" yields no layers rather than throwing: the caller is
 * often holding whatever the library just returned, including "".
 */
function parseInchiLayers(inchi) {
  const text = typeof inchi === "string" ? inchi.trim() : "";
  if (!text.startsWith("InChI=")) {
    return { prefix: "", version: "", layers: [] };
  }

  const segments = text.slice("InChI=".length).split("/");
  const version = segments.shift() ?? "";

  const found = new Map();

  /*
   * The formula is the one layer with no letter prefix, and it is always
   * first. Guard on the letter anyway: a charge-only InChI such as
   * "InChI=1S//q+1" has an empty formula segment.
   */
  if (segments.length > 0 && !/^[a-z]/.test(segments[0])) {
    const formula = segments.shift();
    // "InChI=1S//q+1" has no formula at all; an empty row is noise, not a layer.
    if (formula !== "") {
      found.set("formula", formula);
    }
  }

  for (const segment of segments) {
    if (segment === "") {
      continue;
    }
    const key = segment[0];
    const value = segment.slice(1);
    /*
     * Keep the first occurrence. A layer letter can legitimately repeat in a
     * multi-component InChI, and the first is the one the canonical order
     * refers to.
     */
    if (INCHI_LAYER_NAMES.has(key) && !found.has(key)) {
      found.set(key, value);
    }
  }

  const layers = INCHI_LAYERS.filter(([key]) => found.has(key)).map(
    ([key, name, hint]) => ({ key, name, hint, value: found.get(key) })
  );

  return { prefix: "InChI=", version, layers };
}

/*
 * Compare two InChIs layer by layer.
 *
 * Returns one row per layer present in either string, each marked `same`,
 * `changed`, `added` or `removed` relative to `left`. This is what makes the
 * version comparison readable: the answer is rarely "a different string", it
 * is "the /t layer moved".
 */
function diffInchiLayers(left, right) {
  const leftLayers = new Map(
    parseInchiLayers(left).layers.map((layer) => [layer.key, layer])
  );
  const rightLayers = new Map(
    parseInchiLayers(right).layers.map((layer) => [layer.key, layer])
  );

  return INCHI_LAYERS.filter(
    ([key]) => leftLayers.has(key) || rightLayers.has(key)
  ).map(([key, name, hint]) => {
    const before = leftLayers.get(key)?.value;
    const after = rightLayers.get(key)?.value;

    let status;
    if (before === undefined) {
      status = "added";
    } else if (after === undefined) {
      status = "removed";
    } else if (before === after) {
      status = "same";
    } else {
      status = "changed";
    }

    return { key, name, hint, before, after, status };
  });
}

/*
 * The InChIKey's own grammar: 14 characters of skeleton, 8 of stereo and
 * isotope, 1 flag character, then version and protonation.
 *
 *   TXBHLLHHHQAFNN - UHFFFAOYSA - N
 *   ^skeleton        ^stereo      ^protonation
 *
 * Two versions disagreeing about stereochemistry produce keys with an
 * identical first block, which is invisible in one undifferentiated run.
 */
function parseInchikeyBlocks(inchikey) {
  const text = typeof inchikey === "string" ? inchikey.trim() : "";
  const match = /^([A-Z]{14})-([A-Z]{8,10})-([A-Z])$/.exec(text);
  if (!match) {
    return [];
  }
  return [
    { name: "Skeleton", value: match[1] },
    { name: "Stereo and isotopes", value: match[2] },
    { name: "Protonation", value: match[3] },
  ];
}

/*
 * Notation marks. Drawn, in one stroke weight, from the vocabulary of a
 * structure diagram rather than from an icon font: a filled wedge points
 * toward the viewer and means confirmed, crossed hairlines mean refused, an
 * open square means in progress, and a hash marks a layer that differs.
 *
 * Authored here rather than pulled from the icon set because the icon set has
 * no wedge and no hash, and a check mark would say "valid" where this world
 * says "drawn".
 */
function notationMark(kind) {
  const open = '<svg class="notation-mark" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">';
  switch (kind) {
    case "ok":
      // Filled wedge: the stereo bond that comes toward you.
      return `${open}<path d="M2 10 L6 2 L10 10 Z" fill="currentColor"/></svg>`;
    case "error":
      // Two crossed strokes: struck out, as a notebook strikes a bad reading.
      return `${open}<path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" stroke="currentColor" stroke-width="1.75" fill="none"/></svg>`;
    case "busy":
      return `${open}<rect x="2.5" y="2.5" width="7" height="7" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`;
    case "changed":
      // Hashed bond: the mark for a configuration that is not the default.
      return `${open}<path d="M3 9.5 L9 2.5 M2 7 L5 7 M3.5 5 L6.5 5 M5 3 L8 3" stroke="currentColor" stroke-width="1.25" fill="none"/></svg>`;
    default:
      return "";
  }
}

/*
 * Escape text that is about to be interpolated into an innerHTML template.
 * The layer values come from the InChI library rather than from a user, but
 * the SD-file path puts arbitrary file content through the same fields.
 */
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (character) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[character];
  });
}

/*
 * Compare two InChIKeys block by block.
 *
 * The key's blocks carry different meanings, so *which* block changed is the
 * useful fact: an identical skeleton block with a different stereo block means
 * two versions agree on the structure and disagree about its stereochemistry,
 * which is exactly the disagreement worth seeing. Comparing the keys as two
 * 27-character strings hides that.
 */
function diffInchikeyBlocks(left, right) {
  const leftBlocks = parseInchikeyBlocks(left);
  const rightBlocks = parseInchikeyBlocks(right);
  if (leftBlocks.length === 0 && rightBlocks.length === 0) {
    return [];
  }

  const names = ["Skeleton", "Stereo and isotopes", "Protonation"];
  return names.map((name, index) => {
    const before = leftBlocks[index]?.value;
    const after = rightBlocks[index]?.value;
    let status;
    if (before === undefined) {
      status = "added";
    } else if (after === undefined) {
      status = "removed";
    } else if (before === after) {
      status = "same";
    } else {
      status = "changed";
    }
    return { name, before, after, status };
  });
}

/*
 * Render a complete InChI with the layers that changed marked.
 *
 * The string is re-split on "/" and rejoined, never rebuilt from parsed
 * values, so the text a reader selects and copies is character-for-character
 * what the library returned — the markup only wraps it. `changedKeys` is a
 * Set of layer keys ("t", "m", "formula") from diffInchiLayers.
 */
function markChangedLayers(inchi, changedKeys) {
  const text = typeof inchi === "string" ? inchi.trim() : "";
  if (!text.startsWith("InChI=") || !changedKeys || changedKeys.size === 0) {
    return escapeHtml(text);
  }

  const segments = text.slice("InChI=".length).split("/");
  const version = segments.shift() ?? "";

  let sawFormula = false;
  const rendered = segments.map((segment) => {
    let key;
    if (!sawFormula && !/^[a-z]/.test(segment)) {
      key = "formula";
      sawFormula = true;
    } else {
      key = segment.slice(0, 1);
    }
    const escaped = escapeHtml(segment);
    return changedKeys.has(key)
      ? `<mark class="layer-highlight">${escaped}</mark>`
      : escaped;
  });

  return `${escapeHtml("InChI=" + version)}/${rendered.join("/")}`;
}

/*
 * The same for an InChIKey: mark the blocks that changed, by index, leaving
 * the hyphens and every character in place.
 */
function markChangedKeyBlocks(inchikey, changedIndices) {
  const text = typeof inchikey === "string" ? inchikey.trim() : "";
  if (!changedIndices || changedIndices.size === 0) {
    return escapeHtml(text);
  }
  return text
    .split("-")
    .map((block, index) =>
      changedIndices.has(index)
        ? `<mark class="layer-highlight">${escapeHtml(block)}</mark>`
        : escapeHtml(block)
    )
    .join("-");
}

/*
 * The interface's icons, authored in one stroke weight.
 *
 * These replace the eight Bootstrap Icons glyphs the app used to pull from a
 * 121 KB webfont plus a 95 KB stylesheet declaring about 1800 icons. Two
 * reasons to draw them instead: the webfont's weight sat visibly next to the
 * authored chemistry marks in notationMark(), which is two icon systems on one
 * surface; and eight shapes do not justify that payload on a page whose first
 * load the audit measured at 7.5 MB.
 *
 * 16x16, 1.5px stroke, currentColor, no fill, square joins — the same hand as
 * the notation marks.
 */
const ICON_PATHS = {
  clipboard: "M6 2.5H10V4.5H6ZM3.5 4.5H12.5V14H3.5Z",
  "clipboard-check": "M6 2.5H10V4.5H6ZM3.5 4.5H12.5V14H3.5ZM5.8 9.4 7.4 11 10.4 8",
  "clipboard-x": "M6 2.5H10V4.5H6ZM3.5 4.5H12.5V14H3.5ZM6.2 8.6 9.8 12.2M9.8 8.6 6.2 12.2",
  download: "M8 2.5V10.2M5 7.4 8 10.5 11 7.4M3 12V14H13V12",
  trash: "M3 4.5H13M6.5 4.5V2.5H9.5V4.5M4.6 4.5 5.4 14H10.6L11.4 4.5",
  "x-lg": "M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5",
  "check-lg": "M3.5 8.4 6.4 11.4 12.5 4.6",
  reset: "M13 8A5 5 0 1 1 8 3M8 3 10.6 0.9M8 3 10.6 5.1",
};

/*
 * Inline SVG for one icon. Always aria-hidden: every caller pairs it with a
 * real accessible name on the control, never with the glyph as the name.
 */
function icon(name, extraClass) {
  const path = ICON_PATHS[name];
  if (path === undefined) {
    return "";
  }
  const className = ["app-icon", extraClass].filter(Boolean).join(" ");
  return (
    `<svg class="${className}" width="16" height="16" viewBox="0 0 16 16" ` +
    `aria-hidden="true" focusable="false">` +
    `<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.5" ` +
    `stroke-linecap="square" stroke-linejoin="miter"/></svg>`
  );
}

/* Self-check: `node inchi-layers.js` exits non-zero on a broken parse. */
function demo() {
  const assert = require("assert");

  const benzene = "InChI=1S/C6H6/c1-2-4-6-5-3-1/h1-6H";
  const parsed = parseInchiLayers(benzene);
  assert.strictEqual(parsed.version, "1S");
  assert.deepStrictEqual(
    parsed.layers.map((layer) => layer.key),
    ["formula", "c", "h"]
  );
  assert.strictEqual(parsed.layers[0].value, "C6H6");

  // Canonical order, not the order the letters happened to arrive in.
  const stereo = parseInchiLayers("InChI=1S/C4H8O/c1-3-4(2)5/h4-5H/t4-/m1/s1");
  assert.deepStrictEqual(
    stereo.layers.map((layer) => layer.key),
    ["formula", "c", "h", "t", "m", "s"]
  );

  // Not an InChI: no layers, no throw.
  assert.deepStrictEqual(parseInchiLayers("this is not a molfile").layers, []);
  assert.deepStrictEqual(parseInchiLayers("").layers, []);
  assert.deepStrictEqual(parseInchiLayers(undefined).layers, []);

  // An empty formula segment must not be read as a layer letter.
  const charged = parseInchiLayers("InChI=1S//q+1");
  assert.deepStrictEqual(
    charged.layers.map((layer) => layer.key),
    ["q"]
  );

  // The diff is the point: same skeleton, one stereo layer apart.
  const diff = diffInchiLayers(
    "InChI=1S/C4H8O/c1-3-4(2)5/h4-5H/t4-/m1/s1",
    "InChI=1S/C4H8O/c1-3-4(2)5/h4-5H/t4-/m0/s1"
  );
  const byKey = new Map(diff.map((row) => [row.key, row]));
  assert.strictEqual(byKey.get("formula").status, "same");
  assert.strictEqual(byKey.get("c").status, "same");
  assert.strictEqual(byKey.get("m").status, "changed");
  assert.strictEqual(byKey.get("m").before, "1");
  assert.strictEqual(byKey.get("m").after, "0");

  // A layer one version emits and the other does not.
  const appeared = diffInchiLayers(
    "InChI=1S/C6H6/c1-2-4-6-5-3-1/h1-6H",
    "InChI=1S/C6H6/c1-2-4-6-5-3-1/h1-6H/b1-2+"
  );
  assert.strictEqual(
    appeared.find((row) => row.key === "b").status,
    "added"
  );
  assert.strictEqual(
    diffInchiLayers(
      "InChI=1S/C6H6/c1-2-4-6-5-3-1/h1-6H/b1-2+",
      "InChI=1S/C6H6/c1-2-4-6-5-3-1/h1-6H"
    ).find((row) => row.key === "b").status,
    "removed"
  );

  assert.deepStrictEqual(
    parseInchikeyBlocks("TXBHLLHHHQAFNN-UHFFFAOYSA-N").map((b) => b.value),
    ["TXBHLLHHHQAFNN", "UHFFFAOYSA", "N"]
  );
  assert.deepStrictEqual(parseInchikeyBlocks("not-a-key"), []);

  // Same skeleton, different stereo block: the disagreement worth seeing.
  const keyDiff = diffInchikeyBlocks(
    "HEFNNWSXXWATRW-JTQLQIEISA-N",
    "HEFNNWSXXWATRW-UHFFFAOYSA-N"
  );
  assert.strictEqual(keyDiff[0].status, "same");
  assert.strictEqual(keyDiff[1].status, "changed");
  assert.strictEqual(keyDiff[1].before, "JTQLQIEISA");
  assert.strictEqual(keyDiff[1].after, "UHFFFAOYSA");
  assert.strictEqual(keyDiff[2].status, "same");
  assert.deepStrictEqual(diffInchikeyBlocks("", ""), []);

  /*
   * Highlighting must never alter the string itself: strip the markup back out
   * and it has to equal the input exactly, or someone copies a corrupted
   * identifier into a paper.
   */
  const stripTags = (html) =>
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

  const full = "InChI=1S/C4H8O/c1-3-4(2)5/h4-5H/t4-/m1/s1";
  const marked = markChangedLayers(full, new Set(["m", "s"]));
  assert.strictEqual(stripTags(marked), full);
  assert.ok(marked.includes('<mark class="layer-highlight">m1</mark>'));
  assert.ok(marked.includes('<mark class="layer-highlight">s1</mark>'));
  assert.ok(!marked.includes('<mark class="layer-highlight">t4-</mark>'));

  // the formula has no letter prefix and must still be markable
  const formulaMarked = markChangedLayers(full, new Set(["formula"]));
  assert.strictEqual(stripTags(formulaMarked), full);
  assert.ok(formulaMarked.includes('<mark class="layer-highlight">C4H8O</mark>'));

  // nothing changed, or not an InChI: plain escaped text, no marks
  assert.strictEqual(markChangedLayers(full, new Set()), escapeHtml(full));
  assert.strictEqual(
    markChangedLayers("not an inchi", new Set(["t"])),
    escapeHtml("not an inchi")
  );

  const key = "HEFNNWSXXWATRW-JTQLQIEISA-N";
  const keyMarked = markChangedKeyBlocks(key, new Set([1]));
  assert.strictEqual(stripTags(keyMarked), key);
  assert.ok(keyMarked.includes('<mark class="layer-highlight">JTQLQIEISA</mark>'));
  assert.ok(!keyMarked.includes('<mark class="layer-highlight">HEFNNWSXXWATRW</mark>'));
  assert.strictEqual(markChangedKeyBlocks(key, new Set()), escapeHtml(key));

  // These feed innerHTML templates, and the SD-file path puts file content there.
  assert.strictEqual(
    escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
  );
  assert.strictEqual(escapeHtml("a & b"), "a &amp; b");
  assert.ok(notationMark("ok").startsWith("<svg"));
  assert.strictEqual(notationMark("nonexistent"), "");

  // One icon system: every glyph the interface uses must be authored here.
  for (const name of [
    "clipboard",
    "clipboard-check",
    "clipboard-x",
    "download",
    "trash",
    "x-lg",
    "check-lg",
    "reset",
  ]) {
    assert.ok(icon(name).includes("stroke-width=\"1.5\""), name);
    assert.ok(icon(name).includes('aria-hidden="true"'), name);
  }
  assert.strictEqual(icon("no-such-icon"), "");

  console.log("inchi-layers.js: all checks passed");
}

if (typeof module === "object" && module.exports) {
  module.exports = {
    INCHI_LAYERS,
    parseInchiLayers,
    diffInchiLayers,
    parseInchikeyBlocks,
    diffInchikeyBlocks,
    markChangedLayers,
    markChangedKeyBlocks,
    notationMark,
    escapeHtml,
    icon,
    ICON_PATHS,
  };
  if (require.main === module) {
    demo();
  }
}
