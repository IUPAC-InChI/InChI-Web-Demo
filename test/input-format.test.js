/*
 * Format sniffing for the single paste field. The old app made the user pick a
 * tab per notation; this decides instead, so a wrong answer here sends a
 * molfile down the AuxInfo path.
 */
const {
  detectInputFormat,
  splitRinchiPaste,
} = require("../pages/input-format.js");

const MOLFILE_V2000 = [
  "",
  "  Ketcher  9112613442D 1   1.00000     0.00000     0",
  "",
  "  3  2  0  0  0  0            999 V2000",
  "    5.1494   -3.6325    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0",
  "    6.1506   -3.6325    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0",
  "    5.6501   -2.7675    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0",
  "  1  2  1  0     0  0",
  "  1  3  1  0     0  0",
  "M  END",
].join("\n");

const MOLFILE_V3000 = [
  "",
  "  Ketcher  9112613442D 1   1.00000     0.00000     0",
  "",
  "  0  0  0  0  0  0            999 V3000",
  "M  V30 BEGIN CTAB",
  "M  V30 COUNTS 2 1 0 0 0",
  "M  V30 END CTAB",
  "M  END",
].join("\n");

test.each([
  ["", "empty"],
  ["   \n  \t ", "empty"],
])("treats %p as %s", (text, kind) => {
  expect(detectInputFormat(text).kind).toBe(kind);
});

test("recognises a V2000 molfile", () => {
  expect(detectInputFormat(MOLFILE_V2000).kind).toBe("molfile");
});

test("recognises a V3000 molfile", () => {
  expect(detectInputFormat(MOLFILE_V3000).kind).toBe("molfile");
});

test("recognises SD file text by its record terminator", () => {
  const sdf = `${MOLFILE_V2000}\n> <ID>\n1\n\n$$$$\n`;
  expect(detectInputFormat(sdf).kind).toBe("sdf");
});

test("prefers sdf over molfile when both signals are present", () => {
  /*
   * An SD record *is* a molfile plus a data block, so the terminator has to be
   * tested before the counts line or every SD file reads as a molfile and only
   * its first record is ever converted.
   */
  const sdf = `${MOLFILE_V2000}\n$$$$\n${MOLFILE_V2000}\n$$$$\n`;
  expect(detectInputFormat(sdf).kind).toBe("sdf");
});

test("recognises a RInChI paired with its RAuxInfo, in either order", () => {
  /*
   * Old RInChI tab 3 had two boxes. One field takes both on separate lines:
   * without the RAuxInfo the reaction is drawn with no coordinates, which is
   * a pile of atoms at the origin.
   */
  const rinchi = "RInChI=1.00.1S/CH4/h1H4<>C2H6/c1-2/h1-2H3/d+";
  const rauxinfo = "RAuxInfo=1.00.1/0/N:1/rA:1nC/rB:/rC:0,0,0;";
  expect(detectInputFormat(`${rinchi}\n${rauxinfo}`).kind).toBe("rinchi");
  expect(detectInputFormat(`${rauxinfo}\n${rinchi}`).kind).toBe("rinchi");
});

test("splits a paired paste into its two strings", () => {
  const rinchi = "RInChI=1.00.1S/CH4/h1H4<>C2H6/c1-2/h1-2H3/d+";
  const rauxinfo = "RAuxInfo=1.00.1/0/N:1/rA:1nC/rB:/rC:0,0,0;";
  expect(splitRinchiPaste(`${rauxinfo}\n${rinchi}`)).toEqual({ rinchi, rauxinfo });
  expect(splitRinchiPaste(rinchi)).toEqual({ rinchi, rauxinfo: "" });
});

test.each([
  ["AuxInfo=1/0/N:1,2,3/E:(1,2,3)/rA:3nCCC/rB:s1;s1s2;/rC:5.1,-3.6,0;", "auxinfo"],
  ["RAuxInfo=1.00.1/1/N:1,2,3,4/E:(3,4)/rA:4nCCOO", "rauxinfo"],
  ["RInChI=1.00.1S/C2H4O2/c1-2(3)4/h1H3,(H,3,4)<>C4H8O2/c1-3-6-4(2)5/d+", "rinchi"],
  ["InChI=1S/C4H8O/c1-3-4(2)5/h4-5H/t4-/m1/s1", "inchi"],
])("recognises %p as %s", (text, kind) => {
  expect(detectInputFormat(text).kind).toBe(kind);
});

test("tolerates leading whitespace before a prefixed identifier", () => {
  expect(detectInputFormat("\n  InChI=1S/CH4/h1H4").kind).toBe("inchi");
});

test("recognises an RXN reaction file", () => {
  const rxn = ["$RXN", "", "  Ketcher", "", "  1  1"].join("\n");
  expect(detectInputFormat(rxn).kind).toBe("rxnfile");
});

test.each([["$RDFILE 1"], ["$RDFILE  1\n$DATM    09/11/26 13:44"]])(
  "recognises an RD file (%p)",
  (text) => {
    expect(detectInputFormat(text).kind).toBe("rdfile");
  }
);

test("does not classify prose as a structure", () => {
  const result = detectInputFormat("this is not a molfile at all");
  expect(result.kind).toBe("unknown");
  expect(result.convertible).toBe(false);
});

test("refuses a bare InChI with a reason naming the missing coordinates", () => {
  /*
   * The app had no answer for this input at all. An InChI carries no
   * coordinates, so no structure can be drawn from it — say that, rather than
   * silently doing nothing.
   */
  const result = detectInputFormat("InChI=1S/CH4/h1H4");
  expect(result.convertible).toBe(false);
  expect(result.reason).toMatch(/coordinates/i);
});

test.each(["molfile", "sdf", "auxinfo", "rxnfile", "rdfile", "rinchi"])(
  "marks %s convertible with no reason",
  (kind) => {
    const samples = {
      molfile: MOLFILE_V2000,
      sdf: `${MOLFILE_V2000}\n$$$$\n`,
      auxinfo: "AuxInfo=1/0/N:1/rA:1nC/rB:/rC:0,0,0;",
      rxnfile: "$RXN\n\n  Ketcher\n\n  1  1",
      rdfile: "$RDFILE 1",
      rinchi: "RInChI=1.00.1S/CH4/h1H4<>C2H6/c1-2/h1-2H3/d+",
    };
    const result = detectInputFormat(samples[kind]);
    expect(result.kind).toBe(kind);
    expect(result.convertible).toBe(true);
    expect(result.reason).toBe("");
  }
);

test("every result carries a label fit for a sentence", () => {
  for (const text of ["", MOLFILE_V2000, "AuxInfo=1/0/N:1", "nonsense"]) {
    expect(typeof detectInputFormat(text).label).toBe("string");
  }
});

test.each([[null], [undefined], [42], [{}]])(
  "returns the empty verdict for %p instead of throwing",
  (input) => {
    expect(detectInputFormat(input).kind).toBe("empty");
  }
);
