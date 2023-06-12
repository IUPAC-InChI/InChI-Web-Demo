"use strict";

/*
 * WASM module(s) initialization
 *
 * Calling the factory function return a Promise which resolves to the module object.
 * See https://github.com/emscripten-core/emscripten/blob/fa339b76424ca9fbe5cf15faea0295d2ac8d58cc/src/settings.js#L1183
 */
const inchiModulePromises = {
  "1.06": inchiModule106()
};

const availableInchiVersions = Object.keys(inchiModulePromises);

/*
 * Page loaded:
 * - initialize user-selectable parameters
 * - enable tooltips
 */
function onBodyLoad() {
  addInchiVersionsToSelect("tab1-inchiversion");
  addInchiOptions("tab1-options", () => updateTab1());

  addInchiVersionsToSelect("tab2-inchiversion");
  addInchiOptions("tab2-options", () => updateTab2());

  addInchiVersionsToSelect("tab3-inchiversion");

  enableTooltips();
}

function addInchiVersionsToSelect(selectId) {
  availableInchiVersions.forEach(v => {
    const option = document.createElement("option");
    option.innerHTML = v;
    option.value = v;
    document.getElementById(selectId).appendChild(option);
  });
}

// Tooltip texts are from InChI's API reference.
const inchiOptions = [
  { name: "NEWPSOFF", tooltip: "Both ends of wedge point to stereocenters" },
  { name: "DoNotAddH", tooltip: "All hydrogens in input structure are explicit" },
  { name: "SNon", tooltip: "Ignore stereo" },
  { name: "SRel", tooltip: "Use relative stereo" },
  { name: "SRac", tooltip: "Use racemic stereo" },
  { name: "SUCF", tooltip: "Use Chiral Flag in MOL/SD file record: if On – use Absolute stereo, Off – use Relative stereo" },
  { name: "SUU", tooltip: "Always indicate unknown/undefined stereo" },
  { name: "SLUUD", tooltip: "Stereo labels for \“unknown\” and \“undefined\” are different, ‘u’ and ‘?’, resp." },
  { name: "FixedH", tooltip: "Include reconnected metals results" },
  { name: "RecMet", tooltip: "Include Fixed H layer" },
  { name: "KET", tooltip: "Account for keto-enol tautomerism (experimental; extension to InChI 1)" },
  { name: "15T", tooltip: "Account for 1,5-tautomerism (experimental; extension to InChI 1)" }
];

function addInchiOptions(divId, updateFunction) {
  inchiOptions.forEach(option => {
    const div = document.createElement("div");
    div.classList.add("form-check", "mb-2");

    const input = document.createElement("input");
    input.id = divId + "-" + option["name"];
    input.classList.add("form-check-input");
    input.type = "checkbox";
    input.value = option["name"];
    input.addEventListener("change", updateFunction);

    const label = document.createElement("label");
    label.classList.add("form-check-label");
    label.htmlFor = input.id;
    label.innerHTML = option["name"];
    label.setAttribute("data-bs-toggle", "tooltip");
    label.setAttribute("data-bs-title", option["tooltip"]);
    label.setAttribute("data-bs-placement", "right");

    div.appendChild(input);
    div.appendChild(label);
    document.getElementById(divId).appendChild(div);
  });
}

function enableTooltips() {
  // https://getbootstrap.com/docs/5.3/components/tooltips/#enable-tooltips
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(elem => new bootstrap.Tooltip(elem));
}

/*
 * Glue code to invoke the C functions in inchi_web.c
 *
 * Char pointers returned by inchi_from_molfile and inchikey_from_inchi need to be
 * freed here.
 * See https://github.com/emscripten-core/emscripten/issues/6484 (emscripten does
 * not do this on its own when using "string" as return type)
 */
async function inchiFromMolfile(molfile, options, inchiVersion) {
  const module = await inchiModulePromises[inchiVersion];
  const ptr = module.ccall("inchi_from_molfile", "number", ["string", "string"], [molfile, options]);
  const result = module.UTF8ToString(ptr);
  module._free(ptr);

  return JSON.parse(result);
}

async function inchikeyFromInchi(inchi, inchiVersion) {
  const module = await inchiModulePromises[inchiVersion];
  const ptr = module.ccall("inchikey_from_inchi", "number", ["string"], [inchi]);
  const result = module.UTF8ToString(ptr);
  module._free(ptr)

  return JSON.parse(result);
}

async function molfileFromInchi(inchi, options, inchiVersion) {
  const module = await inchiModulePromises[inchiVersion];
  const ptr = module.ccall("molfile_from_inchi", "number", ["string", "string"], [inchi, options]);
  const result = module.UTF8ToString(ptr);
  module._free(ptr);

  return JSON.parse(result);
}

/*
 * Update actions (when user changes inputs)
 */
async function updateTab1() {
  // clear output fields
  writeResult("", "tab1-inchi", "tab1-inchikey", "tab1-auxinfo", "tab1-logs");

  // collect user input
  let molfile;
  const ketcher = getKetcher("tab1-ketcher");
  if (ketcher.containsReaction()) {
    writeResult("Cannot convert reactions to InChI", "tab1-logs");
    return;
  } else {
    molfile = await ketcher.getMolfile();
  }
  const options = collectOptions("tab1-options");
  const inchiVersion = document.getElementById("tab1-inchiversion").value;

  await convertMolfileToInchiAndWriteResults(molfile, options, inchiVersion, "tab1-inchi", "tab1-inchikey", "tab1-auxinfo", "tab1-logs");
}

async function updateTab2() {
  // clear output fields
  writeResult("", "tab2-inchi", "tab2-inchikey", "tab2-auxinfo", "tab2-logs");

  // collect user input
  const molfile = document.getElementById("tab2-molfileTextarea").value;
  const options = collectOptions("tab2-options");
  const inchiVersion = document.getElementById("tab2-inchiversion").value;

  await convertMolfileToInchiAndWriteResults(molfile, options, inchiVersion, "tab2-inchi", "tab2-inchikey", "tab2-auxinfo", "tab2-logs");
}

async function convertMolfileToInchiAndWriteResults(molfile, options, inchiVersion, inchiTextElementId, inchikeyTextElementId, auxinfoTextElementId, logTextElementId) {
  let inchiResult;
  try {
    inchiResult = await inchiFromMolfile(molfile, options, inchiVersion);
  } catch(e) {
    writeResult(e, logTextElementId);
    return;
  }
  writeResult(inchiResult.inchi, inchiTextElementId);
  writeResult(inchiResult.auxinfo, auxinfoTextElementId);

  const log = [];
  if (inchiResult.log !== "") {
    log.push(inchiResult.log);
  }

  if ((inchiResult.return_code != -1) && (inchiResult.inchi !== "")) {
    let inchikeyResult;
    try {
      inchikeyResult = await inchikeyFromInchi(inchiResult.inchi, inchiVersion);
    } catch(e) {
      log.push(e);
    }
    writeResult(inchikeyResult.inchikey, inchikeyTextElementId);

    if ((inchikeyResult == -1) && (inchikeyResult.message !== "")) {
      log.push(inchikeyResult.message);
    }
  }

  writeResult(log.join("\n"), logTextElementId);
}

function collectOptions(tabOptionsId) {
  /*
   * Efficient way to collect all options.
   * Idea from https://github.com/rapodaca/inchi-wasm/blob/master/web/index.html#L166
   */
  const elements = document.querySelectorAll("[id=" + tabOptionsId + "] div.form-check input.form-check-input");
  return Array.from(elements).filter(e => e.checked).map(e => "-" + e.value).join(" ");
}

function writeResult(text, ...ids) {
  for (let id of ids) {
    document.getElementById(id).innerHTML = text;
  }
}

async function updateTab3() {
  const inchi = document.getElementById("tab3-inchiTextarea").value.trim();
  const inchiVersion = document.getElementById("tab3-inchiversion").value;
  const ketcher = getKetcher("tab3-ketcher");
  const logTextElementId = "tab3-logs";

  ketcher.editor.clear()
  writeResult("", logTextElementId);

  if ((inchi !== "") && (!inchi.startsWith("InChI="))) {
    writeResult("The InChI string should start with \"InChI=\".", logTextElementId);
    return;
  }

  let molfileResult;
  try {
    molfileResult = await molfileFromInchi(inchi, "", inchiVersion);
  } catch(e) {
    writeResult(e, logTextElementId);
    return;
  }
  const molfile = molfileResult.molfile;
  if (molfile !== "") {
    await ketcher.setMolecule(molfile);
    await ketcher.layout();
  }

  const log = [];
  if (molfileResult.log !== "") {
    log.push(molfileResult.log);
  }
  writeResult(log.join("\n"), logTextElementId);
}

/*
 * Ketcher
 */
function getKetcher(iframeId) {
  return document.getElementById(iframeId).contentWindow.ketcher;
}

function onKetcherLoaded(iframeId, updateFunction) {
  const ketcher = getKetcher(iframeId);

  // Chrome fires the onload event too early, so we have to wait until 'ketcher' exists.
  if (ketcher) {
    ketcher.editor.subscribe("change", updateFunction);
  } else {
    setTimeout(() => onKetcherLoaded(iframeId, updateFunction), 0);
  }
}

/*
 * Drag-and-drop into the Molfile textarea
 */
function onTextareaDragover(event) {
  event.stopPropagation();
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
}

async function onMolfileTextareaDrop(event) {
  event.stopPropagation();
  event.preventDefault();

  const content = await extractContent(event.dataTransfer);
  if (!content) {
    return;
  }

  document.getElementById("tab2-molfileTextarea").value = content;
  await updateTab2();
}

async function extractContent(dataTransfer) {
  const items = dataTransfer.items;
  if (!items || items.length == 0) {
    return null;
  }
  const item = items[0];

  if (item.kind === "file") {
    return await item.getAsFile().text();
  } else if (item.kind === "string") {
    return new Promise(resolve => {
      item.getAsString(data => resolve(data));
    });
  }
  return null;
}
