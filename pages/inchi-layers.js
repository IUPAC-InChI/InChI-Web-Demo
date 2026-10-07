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
  ["i", "Isotopes", "Isotopic substitution.", "Isotopic"],
  ["f", "Fixed H", "Fixed-hydrogen layer (non-standard InChI).", "Fixed-H"],
  ["r", "Reconnected", "Reconnected-metal layer (non-standard InChI).", "Reconnected"],
];

const INCHI_LAYER_NAMES = new Map(
  INCHI_LAYERS.map(([key, name, hint, adjective]) => [
    key,
    { name, hint, adjective },
  ])
);

const INCHI_LAYER_ORDER = new Map(INCHI_LAYERS.map(([key], index) => [key, index]));

/*
 * A layer key is either a letter ("h") or a letter inside one or more
 * sublayer namespaces ("r/h", "r/f/h"). These two read the parts back.
 */
function layerLetter(key) {
  return key.slice(key.lastIndexOf("/") + 1);
}

/*
 * The letter as the notation writes it: "/h" for a hydrogen layer, and the
 * same "/h" for a reconnected one — the row's name already says which. The
 * formula has no letter of its own.
 */
function layerMark(key) {
  return key === "formula" ? "" : `/${layerLetter(key)}`;
}

function layerNamespace(key) {
  const cut = key.lastIndexOf("/");
  return cut === -1 ? "" : key.slice(0, cut + 1);
}

/*
 * What the interface calls a layer. A namespaced key is named after the
 * markers it sits under, so "r/h" reads "Reconnected hydrogens" rather than
 * repeating "Hydrogens" twice in one table.
 */
function layerLabel(key) {
  const letter = layerLetter(key);
  const base = INCHI_LAYER_NAMES.get(letter);
  if (!base) {
    return { name: key, hint: "" };
  }
  const markers = key.split("/").slice(0, -1);
  if (markers.length === 0) {
    return { name: base.name, hint: base.hint };
  }
  const adjectives = markers.map((marker, index) => {
    const word = INCHI_LAYER_NAMES.get(marker)?.adjective ?? marker;
    return index === 0 ? word : word.charAt(0).toLowerCase() + word.slice(1);
  });
  const innermost = INCHI_LAYER_NAMES.get(markers[markers.length - 1]);
  return {
    name: `${adjectives.join(" ")} ${base.name.toLowerCase()}`,
    hint: `${base.hint} ${innermost?.hint ?? ""}`.trim(),
  };
}

/*
 * Walk an InChI's segments in document order, giving each one the key it
 * belongs to.
 *
 * The layer letters are not unique across a string: a non-standard InChI
 * restarts them after a /f (fixed hydrogens) or /r (reconnected metals)
 * marker, and an /i layer carries its own sublayers too. Keyed by letter
 * alone, two InChIs differing only in their reconnected /h would compare as
 * identical.
 *
 * So a marker opens a namespace and the segments after it are keyed inside
 * it. /r resets to the top level, because the reconnected structure starts a
 * fresh layer sequence; /f and /i nest inside whatever is current.
 *
 * Returns the raw segment alongside the key: markChangedLayers rebuilds the
 * string from these, and it must stay character-for-character what the
 * library returned.
 */
function walkInchiSegments(text) {
  const segments = text.slice("InChI=".length).split("/");
  const version = segments.shift() ?? "";

  const walked = [];
  let base = "";
  let namespace = "";
  let sawFormula = false;

  for (const segment of segments) {
    if (segment === "") {
      walked.push({ key: null, raw: segment, value: "" });
      continue;
    }
    let key;
    if (!sawFormula && !/^[a-z]/.test(segment)) {
      sawFormula = true;
      key = "formula";
    } else {
      const letter = segment[0];
      if (letter === "r") {
        base = "r/";
        namespace = "r/";
        key = "r";
      } else if (letter === "f") {
        namespace = `${base}f/`;
        key = namespace.slice(0, -1);
      } else if (letter === "i") {
        namespace = `${namespace}i/`;
        key = namespace.slice(0, -1);
      } else {
        key = namespace + letter;
      }
    }
    walked.push({
      key,
      raw: segment,
      value: key === "formula" ? segment : segment.slice(1),
    });
  }

  return { version, walked };
}

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

  const { version, walked } = walkInchiSegments(text);

  const layers = [];
  const seen = new Set();
  for (const segment of walked) {
    /*
     * "InChI=1S//q+1" has no formula at all; an empty row is noise, not a
     * layer. A repeated key inside one namespace is not legal InChI — keep
     * the first rather than render two rows with one name.
     */
    if (segment.key === null || seen.has(segment.key)) {
      continue;
    }
    if (segment.key === "formula" && segment.value === "") {
      continue;
    }
    if (!INCHI_LAYER_NAMES.has(layerLetter(segment.key))) {
      continue;
    }
    seen.add(segment.key);
    const { name, hint } = layerLabel(segment.key);
    layers.push({ key: segment.key, name, hint, value: segment.value });
  }

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

  /*
   * Canonical order within a namespace, namespaces in the order they first
   * appear — which for an InChI is the order the string itself puts them in:
   * the main layers, then /f, then /r and its own sublayers.
   */
  const namespaces = [];
  const keys = [];
  for (const key of [...leftLayers.keys(), ...rightLayers.keys()]) {
    const namespace = layerNamespace(key);
    if (!namespaces.includes(namespace)) {
      namespaces.push(namespace);
    }
    if (!keys.includes(key)) {
      keys.push(key);
    }
  }
  keys.sort((a, b) => {
    const byNamespace =
      namespaces.indexOf(layerNamespace(a)) - namespaces.indexOf(layerNamespace(b));
    if (byNamespace !== 0) {
      return byNamespace;
    }
    return (
      (INCHI_LAYER_ORDER.get(layerLetter(a)) ?? INCHI_LAYERS.length) -
      (INCHI_LAYER_ORDER.get(layerLetter(b)) ?? INCHI_LAYERS.length)
    );
  });

  return keys.map((key) => {
    const before = leftLayers.get(key)?.value;
    const after = rightLayers.get(key)?.value;
    const { name, hint } = layerLabel(key);

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
 * Notation marks, drawn from the vocabulary of a structure diagram: a filled
 * wedge means confirmed, crossed hairlines mean refused, an open square means
 * in progress, and a hash marks a layer that differs.
 */
function notationMark(kind) {
  const open = '<svg class="notation-mark" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">';
  switch (kind) {
    case "ok":
      // Hexagon: the ring, drawn as a structure diagram draws it.
      return `${open}<path d="M6 1.5 L9.9 3.75 L9.9 8.25 L6 10.5 L2.1 8.25 L2.1 3.75 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.2"/></svg>`;
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

  const { version, walked } = walkInchiSegments(text);
  const prefix = escapeHtml(`InChI=${version}`);
  /* "InChI=1S" alone has no segments, and must not grow a trailing slash. */
  if (walked.length === 0) {
    return prefix;
  }

  /*
   * Keyed through the same walk as the diff, so a changed main /h marks the
   * main /h alone and not an identical fixed-H /h alongside it.
   */
  const rendered = walked.map((segment) => {
    const escaped = escapeHtml(segment.raw);
    return segment.key !== null && changedKeys.has(segment.key)
      ? `<mark class="layer-highlight">${escaped}</mark>`
      : escaped;
  });

  return `${prefix}/${rendered.join("/")}`;
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
 * The interface's icons, drawn in the same stroke as the notation marks so
 * the page has one icon system.
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

if (typeof module === "object" && module.exports) {
  module.exports = {
    INCHI_LAYERS,
    parseInchiLayers,
    diffInchiLayers,
    layerMark,
    parseInchikeyBlocks,
    diffInchikeyBlocks,
    markChangedLayers,
    markChangedKeyBlocks,
    notationMark,
    escapeHtml,
    icon,
    ICON_PATHS,
  };
}
