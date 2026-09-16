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
   * Not a structure but a pointer to one, so convertible is false: there is
   * nothing here for a library to read until PubChem has been asked for the
   * record. index.js fetches it and re-enters with the SD file text that
   * comes back, which lands on the sdf path like any other paste.
   */
  pubchem: {
    label: "a PubChem identifier",
    convertible: false,
    reason: "",
  },
  /*
   * Also a pointer rather than bytes to convert, for a different reason: a
   * SMILES carries no coordinates and the InChI library reads molfiles. The
   * editor's Indigo lays it out, and what gets converted is that molfile —
   * see the smiles branch in index.js, which says so in the provenance line.
   */
  smiles: { label: "a SMILES string", convertible: false, reason: "" },

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
      "text, AuxInfo strings, RXN and RD files, RInChI strings, SMILES and " +
      "CXSMILES, and a PubChem identifier such as SID 24866042 or CID 2244.",
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

/*
 * Is this a sequence of SMILES tokens, from the first character to the last?
 *
 * Element-aware on purpose, and this is the whole reason SMILES sits last.
 * Every other format announces itself with a prefix or a line shape; a SMILES
 * is bare text made of ordinary letters, so a character-class test would claim
 * "SID" and "24866042" and hand the editor something nobody pasted. Reading
 * the atoms costs twenty lines and refuses both.
 *
 * Deliberately generous about what it accepts beyond that: the grammar is not
 * re-implemented here, valence is not checked and neither are ring closures.
 * Indigo is the arbiter of meaning — index.js reports unrecognised text when
 * the parse fails — so this only has to be tight enough that prose, a bare
 * number and a mistyped identifier never reach it.
 */
const SMILES_ATOM = /^(Cl|Br|se|as|[BCNOPSFI]|[bcnops])/;

function scansAsSmiles(core) {
  let index = 0;
  let atoms = 0;

  while (index < core.length) {
    const character = core[index];

    // A bracket atom: anything up to the closing bracket, but not nothing.
    if (character === "[") {
      const end = core.indexOf("]", index);
      if (end === -1 || end === index + 1) return false;
      atoms += 1;
      index = end + 1;
      continue;
    }

    const atom = SMILES_ATOM.exec(core.slice(index));
    if (atom) {
      atoms += 1;
      index += atom[0].length;
      continue;
    }

    if (character === "*") {
      atoms += 1;
      index += 1;
      continue;
    }

    // Bonds, branches and the disconnection dot. They bind atoms already seen.
    if (/[-=#$:/\\.()]/.test(character)) {
      index += 1;
      continue;
    }

    /*
     * Ring closures, two digits deep behind a %. Both require an atom to have
     * opened the ring, which is what keeps "24866042" out.
     */
    if (character === "%") {
      if (atoms === 0 || !/^%\d\d/.test(core.slice(index))) return false;
      index += 3;
      continue;
    }
    if (/\d/.test(character)) {
      if (atoms === 0) return false;
      index += 1;
      continue;
    }

    return false;
  }

  return atoms > 0;
}

/*
 * A SMILES, or a CXSMILES: the same string with an extension block appended
 * after a space, in pipes. The block is worth taking — it is where coordinates
 * and enhanced stereo live, so a CXSMILES arrives with the layout its author
 * meant rather than one Indigo invented — and its pipes make it the one shape
 * in this format that is cheap to recognise. What is inside them is Indigo's
 * business, not this function's.
 *
 * An explicit "SMILES=" marker is accepted as well, for a string the scan
 * above would rather not guess at.
 */
function detectSmiles(trimmed) {
  const declared = /^SMILES\s*[=:]\s*/i.exec(trimmed);
  const body = declared ? trimmed.slice(declared[0].length) : trimmed;
  if (body === "") return null;

  const extended = /^(\S+)\s+\|(.+)\|$/.exec(body);
  if (!extended && /\s/.test(body)) return null;

  if (!scansAsSmiles(extended ? extended[1] : body)) return null;
  return { ...verdict("smiles"), smiles: body, extended: Boolean(extended) };
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

  /*
   * Anchored to the whole field, unlike the prefixes above. An SD file from
   * PubChem carries "PUBCHEM_SUBSTANCE_ID" and its value in a data block, and
   * an unanchored match would read that file as a pointer to itself.
   *
   * The prefix is required. PubChem numbers substances (SID) and compounds
   * (CID) in separate namespaces, so a bare number names a record in both and
   * the app has no way to tell which one was meant — it would quietly fetch
   * an unrelated structure. Making the visitor type three letters is cheaper
   * than a wrong answer that looks right.
   */
  const pubchem = /^(S|C)ID\s*[:=]?\s*([1-9]\d*)$/i.exec(trimmed);
  if (pubchem) {
    return {
      ...verdict("pubchem"),
      namespace: pubchem[1].toLowerCase() === "s" ? "sid" : "cid",
      id: pubchem[2],
    };
  }

  // See the order note above: the terminator wins over the counts line.
  if (/^\$\$\$\$\s*$/m.test(text)) return verdict("sdf");
  if (looksLikeMolfile(text)) return verdict("molfile");

  // Last: the only format with neither a prefix nor a shape. See detectSmiles.
  const smiles = detectSmiles(trimmed);
  if (smiles) return smiles;

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
