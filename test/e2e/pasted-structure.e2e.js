const { expect, test } = require("@playwright/test");
const {
  WATER_MOLFILE,
  WATER_SDF,
  expectMoleculeOutputs,
} = require("./molecule-outputs");

const PASTE_CASES = [
  ["Molfile", WATER_MOLFILE],
  ["SDF", WATER_SDF],
  ["AuxInfo", "AuxInfo=1/0/N:1/rA:1nO/rB:/rC:;"],
  ["SMILES", "CCO"],
  ["CXSMILES", "CC |(0,0,;1.2,0,)|"],
  ["CID", "CID 2244", true],
  ["SID", "SID 24866042", true],
];

for (const [name, text, pubchemLookup = false] of PASTE_CASES) {
  test(`populates all molecule outputs when pasting ${name}`, async ({
    page,
  }) => {
    await page.goto("/");
    if (pubchemLookup) {
      await page.route(
        "https://pubchem.ncbi.nlm.nih.gov/rest/pug/**",
        (route) =>
          route.fulfill({
            status: 200,
            contentType: "chemical/x-mdl-sdfile",
            body: WATER_SDF,
          })
      );
    }

    await page.getByText("Paste a structure", { exact: true }).click();
    await page.locator("#workbench-paste").fill(text);
    await expectMoleculeOutputs(page);
  });
}

test("converts a paste made before the editor has loaded", async ({ page }) => {
  /* Hold the editor's bundle back so the paste lands before it starts. */
  let releaseEditor;
  const editorHeld = new Promise((resolve) => (releaseEditor = resolve));
  await page.route("**/ketcher/static/js/main.*.js", async (route) => {
    await editorHeld;
    await route.continue();
  });

  /* "load" would wait for the held-back iframe. */
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByText("Paste a structure", { exact: true }).click();
  await page.locator("#workbench-paste").fill(WATER_MOLFILE);
  await expect(page.locator("[data-status]")).toContainText("not ready");

  releaseEditor();
  await expectMoleculeOutputs(page);
});
