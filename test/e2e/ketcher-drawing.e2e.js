const { expect, test } = require("@playwright/test");
const { WATER_MOLFILE, expectMoleculeOutputs } = require("./molecule-outputs");

test("converts a structure drawn in Ketcher into all molecule outputs", async ({
  page,
}) => {
  await page.goto("/");

  await page.waitForFunction(() => {
    const editor = document.querySelector("#workbench-ketcher")?.contentWindow
      ?.ketcher;
    return Boolean(editor);
  });

  await page.evaluate(async (molfile) => {
    await document
      .querySelector("#workbench-ketcher")
      .contentWindow.ketcher.setMolecule(molfile);
  }, WATER_MOLFILE);

  await expect(page.locator("#workbench-paste")).toHaveValue("");
  await expectMoleculeOutputs(page);
});
