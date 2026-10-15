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
