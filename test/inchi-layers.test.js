/*
 * The InChI layer grammar. Unlike the WASM smoke tests in this directory, this
 * one does test behaviour: parseInchiLayers and diffInchiLayers decide what the
 * interface shows, and a wrong split shows a chemist the wrong layer.
 */
const {
  parseInchiLayers,
  diffInchiLayers,
  parseInchikeyBlocks,
  diffInchikeyBlocks,
  escapeHtml,
} = require("../pages/inchi-layers.js");

test("splits an InChI into its layers in canonical order", () => {
  const parsed = parseInchiLayers(
    "InChI=1S/C4H8O/c1-3-4(2)5/h4-5H/t4-/m1/s1"
  );
  expect(parsed.version).toBe("1S");
  expect(parsed.layers.map((layer) => layer.key)).toEqual([
    "formula",
    "c",
    "h",
    "t",
    "m",
    "s",
  ]);
  expect(parsed.layers[0].value).toBe("C4H8O");
});

test.each([
  ["", "empty string"],
  [undefined, "undefined"],
  ["this is not a molfile at all", "arbitrary text"],
  ["AuxInfo=1/1/N:10,3", "an AuxInfo string"],
])("yields no layers for %s (%s) instead of throwing", (input) => {
  expect(parseInchiLayers(input).layers).toEqual([]);
});

test("does not read an empty formula segment as a layer", () => {
  expect(parseInchiLayers("InChI=1S//q+1").layers.map((l) => l.key)).toEqual([
    "q",
  ]);
});

test("marks the layer that moved between two versions", () => {
  const rows = diffInchiLayers(
    "InChI=1S/C4H8O/c1-3-4(2)5/h4-5H/t4-/m1/s1",
    "InChI=1S/C4H8O/c1-3-4(2)5/h4-5H/t4-/m0/s1"
  );
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
  expect(byKey.formula.status).toBe("same");
  expect(byKey.c.status).toBe("same");
  expect(byKey.m.status).toBe("changed");
  expect(byKey.m.before).toBe("1");
  expect(byKey.m.after).toBe("0");
});

test("reports a layer one version emits and the other does not", () => {
  const base = "InChI=1S/C6H6/c1-2-4-6-5-3-1/h1-6H";
  const withStereo = `${base}/b1-2+`;
  expect(
    diffInchiLayers(base, withStereo).find((row) => row.key === "b").status
  ).toBe("added");
  expect(
    diffInchiLayers(withStereo, base).find((row) => row.key === "b").status
  ).toBe("removed");
});

test("splits an InChIKey into skeleton, stereo and protonation", () => {
  expect(
    parseInchikeyBlocks("TXBHLLHHHQAFNN-UHFFFAOYSA-N").map((b) => b.value)
  ).toEqual(["TXBHLLHHHQAFNN", "UHFFFAOYSA", "N"]);
  expect(parseInchikeyBlocks("not-a-key")).toEqual([]);
});

test("escapes text destined for an innerHTML template", () => {
  expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
  );
});

test("marks which InChIKey block moved, not the whole key", () => {
  // Same structure, different stereochemistry: the skeleton block is
  // identical and only the stereo block changes. Comparing the keys as two
  // 27-character runs would hide exactly that.
  const rows = diffInchikeyBlocks(
    "HEFNNWSXXWATRW-JTQLQIEISA-N",
    "HEFNNWSXXWATRW-UHFFFAOYSA-N"
  );
  expect(rows.map((row) => row.status)).toEqual(["same", "changed", "same"]);
  expect(rows[1].before).toBe("JTQLQIEISA");
  expect(rows[1].after).toBe("UHFFFAOYSA");
});

test("returns nothing to compare when neither side is a key", () => {
  expect(diffInchikeyBlocks("", "")).toEqual([]);
  expect(diffInchikeyBlocks("not-a-key", "also-not")).toEqual([]);
});
