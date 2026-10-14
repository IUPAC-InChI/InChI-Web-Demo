/**
 * @jest-environment jsdom
 */

const { readFileSync } = require("node:fs");
const path = require("node:path");
const { escapeHtml, icon } = require("../pages/inchi-layers.js");

const fragments = new Map(
  ["report-mask.html", "report-feedback.html", "workbench.html"].map(
    (file) => [
      `components/${file}`,
      readFileSync(path.join(__dirname, "../pages/components", file), "utf8"),
    ]
  )
);

const availableInchiVersions = {
  "1.06": {
    url: "https://github.com/IUPAC-InChI/InChI/releases/tag/v1.06",
    default: true,
  },
  Dev: {
    url: "https://github.com/IUPAC-InChI/InChI/commit/abcdef",
  },
  "Dev PR 42": {
    url: "https://github.com/IUPAC-InChI/InChI/pull/42",
  },
  Local: {},
};

require("../pages/components/components.js");

function createComponent(markup) {
  const container = document.createElement("div");
  container.innerHTML = markup;
  return container.firstElementChild;
}

async function expectConnectedMarkupSnapshot(component) {
  await component.connectedCallback();
  expect(component.innerHTML).toMatchSnapshot();
}

beforeAll(() => {
  global.fetch = jest.fn(async (url) => {
    const fragment = fragments.get(url);
    if (fragment === undefined) {
      throw new Error(`Unexpected component fragment: ${url}`);
    }
    return { ok: true, text: async () => fragment };
  });
  global.addInchiOptionsForm = jest.fn();
  global.availableInchiVersions = availableInchiVersions;
  global.RINCHI_VERSION = "test-version";
  global.escapeHtml = escapeHtml;
  global.icon = icon;
  window.inchiVersionsReady = Promise.resolve();
});

test("InChIWorkbenchElement markup matches the snapshot", async () => {
  const workbench = document.createElement("inchi-workbench");
  await workbench.connectedCallback();

  expect({
    markup: workbench.innerHTML,
    rinchiVersion: Array.from(
      workbench.querySelectorAll(".rinchi-version"),
      (element) => element.textContent
    ),
  }).toMatchSnapshot();
});

test.each([
  ["ReportMaskElement markup matches the snapshot", "<report-mask></report-mask>"],
  [
    "FeedbackDialogElement markup matches the snapshot",
    "<feedback-dialog></feedback-dialog>",
  ],
  [
    "InChIVersionSelectionElement markup matches the snapshot",
    '<inchi-version-selection onVersionChange="window.onVersionChange()"></inchi-version-selection>',
  ],
  [
    "InChIResultFieldElement markup matches the snapshot",
    '<inchi-result-field id="workbench-inchikey" title="InChIKey" notation="inchikey" live></inchi-result-field>',
  ],
  [
    "NGLViewerElement markup matches the snapshot",
    "<inchi-ngl-viewer></inchi-ngl-viewer>",
  ],
])("%s", async (_testName, markup) => {
  const component = createComponent(markup);
  await expectConnectedMarkupSnapshot(component);
});
