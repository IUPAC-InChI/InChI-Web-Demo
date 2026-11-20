const { expect, test } = require("@playwright/test");
const { WATER_SDF, expectMoleculeOutputs } = require("./molecule-outputs");

test("populates all molecule outputs when an SDF is selected", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#workbench-sdf").setInputFiles({
    name: "water.sdf",
    mimeType: "chemical/x-mdl-sdfile",
    buffer: Buffer.from(WATER_SDF),
  });

  await expect(page.locator("[data-sdf-records]")).toBeVisible();
  await expect(page.locator('[data-record="0"]')).toBeVisible();
  await expectMoleculeOutputs(page);
});

test("converts an SDF selected before the editor has loaded", async ({
  page,
}) => {
  /* Hold the editor's bundle back so the file lands before it starts. */
  let releaseEditor;
  const editorHeld = new Promise((resolve) => (releaseEditor = resolve));
  await page.route("**/ketcher/static/js/main.*.js", async (route) => {
    await editorHeld;
    await route.continue();
  });

  /* "load" would wait for the held-back iframe. */
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#workbench-sdf").setInputFiles({
    name: "water.sdf",
    mimeType: "chemical/x-mdl-sdfile",
    buffer: Buffer.from(WATER_SDF),
  });
  await expect(page.locator('[data-record="0"]')).toBeVisible();

  releaseEditor();
  await expectMoleculeOutputs(page);
});
