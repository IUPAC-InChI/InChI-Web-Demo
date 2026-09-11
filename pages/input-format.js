"use strict";

/*
 * What did the visitor just paste?
 *
 * The app used to make them answer that themselves by picking one of eight
 * tabs — one per notation — before it would accept anything. There is one
 * paste field now, so this decides. Order matters twice over and both cases
 * are load-bearing:
 *
 *   - prefixed identifiers first ("AuxInfo=", "RInChI=", …), because they are
 *     unambiguous and cheap;
 *   - "$$$$" before the molfile counts line, because an SD record *is* a
 *     molfile plus a data block. Test the counts line first and every SD file
 *     reads as a molfile and only its first record is ever converted.
 *
 * Used by index.js (the paste field) and by test/.
 */

const INPUT_FORMATS = {
  empty: { label: "nothing yet", convertible: false, reason: "" },
  molfile: { label: "a molfile", convertible: true, reason: "" },
  sdf: { label: "SD file text", convertible: true, reason: "" },
  auxinfo: { label: "an AuxInfo string", convertible: true, reason: "" },
  rxnfile: { label: "a reaction file", convertible: true, reason: "" },
  rdfile: { label: "an RD file", convertible: true, reason: "" },
  rinchi: { label: "a RInChI string", convertible: true, reason: "" },
  /*
   * Both refusals name the thing that is missing rather than reporting a
   * category error: "not supported" tells the visitor nothing they can act on.
   */
  inchi: {
    label: "an InChI string",
    convertible: false,
    reason:
      "An InChI carries no atom coordinates, so no structure can be drawn " +
      "from it. Paste the matching AuxInfo instead — that one does.",
  },
  rauxinfo: {
    label: "a RAuxInfo string",
    convertible: false,
    reason:
      "A RAuxInfo describes the atoms of a reaction but not the reaction " +
      "itself. Paste the RInChI it belongs to.",
  },
  unknown: {
    label: "unrecognised text",
    convertible: false,
    reason:
      "This is not a format the app recognises. It reads molfiles, SD file " +
      "text, AuxInfo strings, RXN and RD files, and RInChI strings.",
  },
};

function verdict(kind) {
  return { kind, ...INPUT_FORMATS[kind] };
}

/*
 * A molfile's fourth line is the counts line: two counts, then optionally the
 * version tag. V3000 files carry zeroes there and put the real counts in the
 * CTAB block, so the tag is accepted on its own as well.
 */
function looksLikeMolfile(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const counts = lines[3] ?? "";
  if (/^\s*\d+\s+\d+/.test(counts) || /V[23]000\s*$/.test(counts.trim())) {
    return true;
  }
  // A molfile trimmed of its header block still ends the same way.
  return /^M {2}END\s*$/m.test(text);
}

function detectInputFormat(text) {
  if (typeof text !== "string" || text.trim() === "") {
    return verdict("empty");
  }

  const trimmed = text.trim();

  /*
   * A RInChI on any line wins, so that a RInChI and its RAuxInfo can be
   * pasted together in either order — old RInChI tab 3 had a box for each,
   * and without the RAuxInfo the reaction is drawn with no coordinates.
   */
  if (/^RInChI=/m.test(trimmed)) return verdict("rinchi");

  // RAuxInfo before AuxInfo: the shorter prefix is a suffix of the longer one.
  if (trimmed.startsWith("RAuxInfo=")) return verdict("rauxinfo");
  if (trimmed.startsWith("AuxInfo=")) return verdict("auxinfo");
  if (trimmed.startsWith("InChI=")) return verdict("inchi");
  if (trimmed.startsWith("$RXN")) return verdict("rxnfile");
  if (/^\$(RDFILE|RIREG|DATM)/.test(trimmed)) return verdict("rdfile");

  // See the order note above: the terminator wins over the counts line.
  if (/^\$\$\$\$\s*$/m.test(text)) return verdict("sdf");
  if (looksLikeMolfile(text)) return verdict("molfile");

  return verdict("unknown");
}

/*
 * The two strings of a paired RInChI paste, in whichever order they were
 * given. Returns an empty rauxinfo when only the RInChI is present — which
 * fileTextFromRinchi accepts, at the cost of the coordinates.
 */
function splitRinchiPaste(text) {
  const lines = String(text).split(/\r\n|\r|\n/).map((line) => line.trim());
  return {
    rinchi: lines.find((line) => line.startsWith("RInChI=")) ?? "",
    rauxinfo: lines.find((line) => line.startsWith("RAuxInfo=")) ?? "",
  };
}

if (typeof module === "object" && module.exports) {
  module.exports = { INPUT_FORMATS, detectInputFormat, splitRinchiPaste };
}
