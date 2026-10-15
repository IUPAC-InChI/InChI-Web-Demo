const { expect } = require("@playwright/test");

const WATER_MOLFILE = [
  "Water",
  "  https://en.wikipedia.org/wiki/This_Is_Water",
  "",
  "  3  2  0  0  0  0  0  0  0  0999 V2000",
  "    0.0000    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0",
  "    0.9572    0.0000    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0",
  "   -0.2390    0.9270    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0",
  "  1  2  1  0  0  0  0  0",
  "  1  3  1  0  0  0  0  0",
  "M  END",
].join("\n");

const WATER_SDF = `${WATER_MOLFILE}\n$$$$\n`;

async function expectMoleculeOutputs(page) {
  await expect(page.locator("[data-status]")).toContainText("Converted");
  await expect
    .poll(() =>
      page.locator("#workbench-ketcher").evaluate((iframe) => {
        const editor = iframe.contentWindow?.ketcher;
        return Boolean(editor && !editor.editor.struct().isBlank());
      })
    )
    .toBe(true);
  await expect(page.locator("#workbench-inchi")).toHaveText(/^InChI=1S\//);
  await expect(page.locator("#workbench-inchikey")).toHaveText(
    /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/
  );
  await expect(page.locator("#workbench-auxinfo")).toHaveText(/^AuxInfo=/);
  await expect(page.locator("#workbench-logs")).toContainText("InChI options:");

  const viewer = page.locator("#workbench-ngl-viewer");
  await expect(viewer.locator(".ngl-viewport canvas")).toHaveCount(1);

  const atomIndexAnnotation = viewer.locator('[data-annotation="index"]');
  await expect(atomIndexAnnotation).toBeEnabled();
  await atomIndexAnnotation.click();
  await expect(atomIndexAnnotation).toHaveAttribute("aria-pressed", "true");
  await expect(viewer.locator(".annotation-label").first()).toBeAttached();
}

module.exports = { WATER_MOLFILE, WATER_SDF, expectMoleculeOutputs };
