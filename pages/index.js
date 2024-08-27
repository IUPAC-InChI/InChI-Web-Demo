"use strict";

/*
 * Page loaded
 */
function onBodyLoad() {
  // initialize user-selectable parameters
  addVersions("inchi-tab1-pane", availableInchiVersions);
  addInchiOptionsForm("inchi-tab1-pane", () => updateInchiTab1());

  addVersions("inchi-tab2-pane", availableInchiVersions);
  addInchiOptionsForm("inchi-tab2-pane", () => updateInchiTab2());

  addVersions("inchi-tab3-pane", availableInchiVersions);

  addVersions("rinchi-tab1-pane", availableRInchiVersions);
  addVersions("rinchi-tab2-pane", availableRInchiVersions);
  addVersions("rinchi-tab3-pane", availableRInchiVersions);
  addVersions("rinchi-tab4-pane", availableRInchiVersions);

  // enable tooltips
  initTooltips();
}

function addVersions(tabDivId, versions) {
  const targetSelect = document.getElementById(tabDivId).querySelector("select[data-version]");
  for (const [versionString, versionObject] of Object.entries(versions)) {
    const option = document.createElement("option");
    option.innerHTML = versionString;
    option.value = versionString;
    option.selected = Boolean(versionObject.default);
    targetSelect.appendChild(option);
  };
}

function addInchiOptionsForm(tabDivId, updateFunction) {
  const inchiVersion = getVersion(tabDivId);
  const templateId = availableInchiVersions[inchiVersion].optionsTemplateId;
  const template = document.getElementById(templateId);

  const targetDiv = document.getElementById(tabDivId).querySelector("div[data-inchi-options]");
  const clone = template.content.cloneNode(true);

  /*
   * Reassign the name of the "stereoRadio" radio button group.
   */
  clone.querySelectorAll("input.form-check-input[type=\"radio\"][name=\"stereoRadio\"]").forEach(input => {
    input.name = "stereoRadio-" + tabDivId;
  });

  /*
   * Register an on-change event on the "Include Stereo" checkbox to switch the
   * 'disabled' state of the inputs that cope with stereo options.
   */
  clone.querySelector("input.form-check-input[data-id=\"includeStereo\"]").addEventListener("change", function() {
    document.getElementById(tabDivId).querySelectorAll("input.form-check-input[data-inchi-stereo-option]").forEach(input => {
      input.disabled = !this.checked;
    });
  });

  /*
   * Register an on-change event on the "Treat polymers" checkbox to switch the
   * 'disabled' state of the inputs that cope with polymer options.
   */
  clone.querySelector("input.form-check-input[data-id=\"treatPolymers\"]").addEventListener("change", function() {
    document.getElementById(tabDivId).querySelectorAll("input.form-check-input[data-inchi-polymer-option]").forEach(input => {
      input.disabled = !this.checked;
    });
  });

  /*
   * Register an on-click event on the "Reset InChI Options" link.
   */
  clone.querySelector("a[data-reset-inchi-options]").addEventListener("click", function() {
    resetInchiOptions(tabDivId);
    updateFunction();
  });

  /*
   * Assign ids to all <input> elements and assign the target id of their
   * <label> element accordingly. Also register an on-change event to call
   * updateFunction.
   */
  clone.querySelectorAll("input.form-check-input").forEach(input => {
    input.id = input.dataset.id + "-" + tabDivId;
    input.nextElementSibling.htmlFor = input.id;

    input.addEventListener("change", updateFunction);
  });

  /*
   * Initialize the Bootstrap Multiselect widget for tautomer options if it exists.
   */
  $(clone).find("select[data-tautomer-multiselect]").multiselect({
    buttonContainer: '<div class="btn-group mw-100"></div>',
    includeSelectAllOption: true,
    nonSelectedText: "Tautomer options",
    numberDisplayed: 1,
    onChange: () => updateFunction(),
    onDeselectAll: () => updateFunction(),
    onSelectAll: () => updateFunction(),
    // Workaround for Bootstrap 5
    templates: {
      button: '<button type="button" class="form-select multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>'
    },
  });

  // Attach to target element
  targetDiv.innerHTML = "";
  targetDiv.appendChild(clone);
}

function resetInchiOptions(targetDivId) {
  const targetDiv = document.getElementById(targetDivId);

  targetDiv.querySelectorAll("input.form-check-input[data-default-checked]").forEach(input => {
    input.checked = true;
  });

  targetDiv.querySelectorAll("input.form-check-input:not([data-default-checked])").forEach(input => {
    input.checked = false;
  });

  targetDiv.querySelectorAll("input.form-check-input[data-default-disabled]").forEach(input => {
    input.disabled = true;
  });

  targetDiv.querySelectorAll("input.form-check-input:not([data-default-disabled])").forEach(input => {
    input.disabled = false;
  });

  // Bootstrap Multiselect widget for tautomer options
  $(targetDiv).find("select[data-tautomer-multiselect]").multiselect("deselectAll", false);
}

function initTooltips() {
  [...document.querySelectorAll('[data-bs-toggle="tooltip"]')].map(tooltipTriggerEl => {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });
}

function getInchiOptions(tabId) {
  const options = [];
  const tabDiv = document.getElementById(tabId);

  tabDiv.querySelectorAll("input.form-check-input:enabled[data-inchi-option-on]:checked").forEach(input => {
    options.push(input.dataset.inchiOptionOn);
  });

  tabDiv.querySelectorAll("input.form-check-input:enabled[data-inchi-option-off]:not(:checked)").forEach(input => {
    options.push(input.dataset.inchiOptionOff);
  });

  // Bootstrap Multiselect widget for tautomer options
  tabDiv.querySelectorAll("select[data-tautomer-multiselect] option[data-inchi-option-on]:checked").forEach(optionElement => {
    options.push(optionElement.dataset.inchiOptionOn);
  });

  return options;
}

function collectInchiOptions(tabId) {
  return getInchiOptions(tabId).map(o => "-" + o).join(" ");
}

function getVersion(tabId) {
  return document.getElementById(tabId).querySelector("select[data-version]").value;
}

function getInchiOptionsState(tabDivId) {
  const inchiOptionsDiv = document.getElementById(tabDivId).querySelector("div[data-inchi-options]");
  const optionsState = {};

  inchiOptionsDiv.querySelectorAll("input[data-id]").forEach(input => {
    optionsState[input.dataset.id] = [ input.checked, input.disabled ];
  });

  // Bootstrap Multiselect widget for tautomer options
  inchiOptionsDiv.querySelectorAll("select[data-tautomer-multiselect] option[data-id]").forEach(optionElement => {
    optionsState[optionElement.dataset.id] = [ optionElement.selected, optionElement.disabled ];
  });

  return optionsState
}

function applyInchiOptionsState(tabDivId, optionsState) {
  const inchiOptionsDiv = document.getElementById(tabDivId).querySelector("div[data-inchi-options]");

  Object.entries(optionsState).forEach(([k, v]) => {
    const input = inchiOptionsDiv.querySelector(`input[data-id="${k}"]`);
    if (input) {
      input.checked = v[0];
      input.disabled = v[1];
      return;
    }

    // Bootstrap Multiselect widget for tautomer options
    if (v[0]) {
      $(inchiOptionsDiv).find("select[data-tautomer-multiselect]").multiselect("select", k);
    }
  });
}

/*
 * Update actions (when user changes inputs/options/(R)InChI version)
 */
async function updateInchiTab1() {
  // clear output fields
  writeResult("", "inchi-tab1-inchi", "inchi-tab1-inchikey", "inchi-tab1-auxinfo", "inchi-tab1-logs");

  // collect user input
  const options = collectInchiOptions("inchi-tab1-pane");
  const inchiVersion = getVersion("inchi-tab1-pane");

  let molfile;
  const ketcher = getKetcher("inchi-tab1-ketcher");
  if (ketcher.containsReaction()) {
    writeResult("Cannot convert reactions to InChI", "inchi-tab1-logs");
    return;
  } else if (ketcher.editor.struct().isBlank()) {
    // no structure
    return;
  } else {
    molfile = await ketcher.getMolfile();
  }

  // run conversion
  await convertMolfileToInchiAndWriteResults(molfile, options, inchiVersion, "inchi-tab1-inchi", "inchi-tab1-inchikey", "inchi-tab1-auxinfo", "inchi-tab1-logs");
}

async function onChangeInChIVersionTab1() {
  await onChangeInChIVersion("inchi-tab1-pane", () => updateInchiTab1())
}

async function onChangeInChIVersion(tabDivId, updateFunction) {
  const optionsState = getInchiOptionsState(tabDivId);
  addInchiOptionsForm(tabDivId, () => updateFunction());
  applyInchiOptionsState(tabDivId, optionsState);

  await updateFunction();
}

async function updateInchiTab2() {
  // clear output fields
  writeResult("", "inchi-tab2-inchi", "inchi-tab2-inchikey", "inchi-tab2-auxinfo", "inchi-tab2-logs");

  // collect user input
  const molfile = document.getElementById("inchi-tab2-molfileTextarea").value;
  const options = collectInchiOptions("inchi-tab2-pane");
  const inchiVersion = getVersion("inchi-tab2-pane");

  // run conversion
  await convertMolfileToInchiAndWriteResults(molfile, options, inchiVersion, "inchi-tab2-inchi", "inchi-tab2-inchikey", "inchi-tab2-auxinfo", "inchi-tab2-logs");
}

async function onChangeInChIVersionTab2() {
  await onChangeInChIVersion("inchi-tab2-pane", () => updateInchiTab2())
}

async function convertMolfileToInchiAndWriteResults(molfile, options, inchiVersion, inchiTextElementId, inchikeyTextElementId, auxinfoTextElementId, logTextElementId) {
  const log = [];
  log.push("InChI options: " + options);

  let inchiResult;
  try {
    inchiResult = await inchiFromMolfile(molfile, options, inchiVersion);
  } catch(e) {
    writeResult(`Caught exception from inchiFromMolfile(): ${e}`, logTextElementId);
    console.error(e);
    return;
  }
  writeResult(inchiResult.inchi, inchiTextElementId);
  writeResult(inchiResult.auxinfo, auxinfoTextElementId);

  if (inchiResult.log !== "") {
    log.push(inchiResult.log);
  }

  if ((inchiResult.return_code != -1) && (inchiResult.inchi !== "")) {
    let inchikeyResult;
    try {
      inchikeyResult = await inchikeyFromInchi(inchiResult.inchi, inchiVersion);
    } catch(e) {
      log.push(`Caught exception from inchikeyFromInchi(): ${e}`);
      console.error(e);
    }
    writeResult(inchikeyResult.inchikey, inchikeyTextElementId);

    if ((inchikeyResult.return_code == -1) && (inchikeyResult.message !== "")) {
      log.push(inchikeyResult.message);
    }
  }

  writeResult(log.join("\n"), logTextElementId);
}

function writeResult(text, ...ids) {
  for (let id of ids) {
    document.getElementById(id).textContent = text;
  }
}

async function updateInchiTab3() {
  const input = document.getElementById("inchi-tab3-inputTextarea").value.trim();
  const inchiVersion = getVersion("inchi-tab3-pane");
  const ketcher = getKetcher("inchi-tab3-ketcher");
  const logTextElementId = "inchi-tab3-logs";

  // clear outputs
  ketcher.editor.clear()
  writeResult("", logTextElementId);

  // input validation
  if (!input) {
    return;
  }
  if (!input.startsWith("InChI=") && !input.startsWith("AuxInfo=")) {
    writeResult("The input string should start with \"InChI=\" or \"AuxInfo=\".", logTextElementId);
    return;
  }

  // run conversion
  let molfileResult;
  if (input.startsWith("InChI=")) {
    try {
      molfileResult = await molfileFromInchi(input, "", inchiVersion);
    } catch(e) {
      writeResult(`Caught exception from molfileFromInchi(): ${e}`, logTextElementId);
      console.error(e);
      return;
    }
  } else if (input.startsWith("AuxInfo=")) {
    try {
      molfileResult = await molfileFromAuxinfo(input, 0, 0, inchiVersion);
    } catch(e) {
      writeResult(`Caught exception from molfileFromAuxinfo(): ${e}`, logTextElementId);
      console.error(e);
      return;
    }
  }
  const molfile = molfileResult.molfile;
  if (molfile !== "") {
    await ketcher.setMolecule(molfile);
    if (input.startsWith("InChI=")) {
      await ketcher.layout();
    }
  }

  const log = [];
  if (molfileResult.log !== "") {
    log.push(molfileResult.log);
  }
  if (molfileResult.message !== "") {
    log.push(molfileResult.message);
  }
  writeResult(log.join("\n"), logTextElementId);
}

async function updateRinchiTab1() {
  // clear output fields
  writeResult("", "rinchi-tab1-rinchi", "rinchi-tab1-longrinchikey", "rinchi-tab1-shortrinchikey", "rinchi-tab1-webrinchikey", "rinchi-tab1-rauxinfo", "rinchi-tab1-logs");

  // collect user input
  let rxnfile;
  const ketcher = getKetcher("rinchi-tab1-ketcher");
  if (ketcher.editor.struct().isBlank()) {
    // no structure
    return;
  } else if (!ketcher.containsReaction()) {
    writeResult("No reaction was drawn.", "rinchi-tab1-logs");
    return;
  } else {
    rxnfile = await ketcher.getRxn();
  }
  const rinchiVersion = getVersion("rinchi-tab1-pane");
  const equilibrium = hasEquilibriumReactionArrow(ketcher);

  // run conversion
  await convertRxnfileToRinchiAndWriteResults(rxnfile, equilibrium, rinchiVersion, "rinchi-tab1-rinchi", "rinchi-tab1-longrinchikey", "rinchi-tab1-shortrinchikey", "rinchi-tab1-webrinchikey", "rinchi-tab1-rauxinfo", "rinchi-tab1-logs");
}

function hasEquilibriumReactionArrow(ketcher) {
  const rxnArrowsMap = ketcher.editor.struct().rxnArrows;
  if (rxnArrowsMap.size > 0) {
    /*
     * See https://github.com/epam/ketcher/blob/master/packages/ketcher-core/src/domain/entities/rxnArrow.ts#L19
     * for possible mode values.
     */
    return rxnArrowsMap.values().next().value.mode.startsWith("equilibrium");
  }
  return false;
}

async function updateRinchiTab2() {
  // clear output fields
  writeResult("", "rinchi-tab2-rinchi", "rinchi-tab2-longrinchikey", "rinchi-tab2-shortrinchikey", "rinchi-tab2-webrinchikey", "rinchi-tab2-rauxinfo", "rinchi-tab2-logs");

  // collect user input
  const rxnfile = document.getElementById("rinchi-tab2-rxnrdfileTextarea").value;
  const rinchiVersion = getVersion("rinchi-tab2-pane");
  const equilibrium = document.getElementById("rinchi-tab2-forceequilibrium").checked;

  // run conversion
  await convertRxnfileToRinchiAndWriteResults(rxnfile, equilibrium, rinchiVersion, "rinchi-tab2-rinchi", "rinchi-tab2-longrinchikey", "rinchi-tab2-shortrinchikey", "rinchi-tab2-webrinchikey", "rinchi-tab2-rauxinfo", "rinchi-tab2-logs");
}

async function convertRxnfileToRinchiAndWriteResults(rxnfile, forceEquilibrium, rinchiVersion, rinchiTextElementId, longRinchikeyTextElementId, shortRinchikeyTextElementId, webRinchikeyTextElementId, rauxinfoTextElementId, logTextElementId) {
  if (!rxnfile) {
    return;
  }

  const log = [];

  let rinchiResult;
  try {
    rinchiResult = await rinchiFromRxnfile(rxnfile, forceEquilibrium, rinchiVersion);
  } catch(e) {
    writeResult(`Caught exception from rinchiFromRxnfile(): ${e}`, logTextElementId);
    console.error(e);
    return;
  }
  writeResult(rinchiResult.rinchi, rinchiTextElementId);
  writeResult(rinchiResult.rauxinfo, rauxinfoTextElementId);

  if (rinchiResult.error !== "") {
    log.push("Error from rinchilib_file_text_from_rinchi() call: " + rinchiResult.error);
  }

  if ((rinchiResult.return_code == 0) && (rinchiResult.rinchi !== "")) {
    convertRinchiToRinchikeyAndWriteResult(rinchiResult.rinchi, rinchiVersion, "Long", longRinchikeyTextElementId, log);
    convertRinchiToRinchikeyAndWriteResult(rinchiResult.rinchi, rinchiVersion, "Short", shortRinchikeyTextElementId, log);
    convertRinchiToRinchikeyAndWriteResult(rinchiResult.rinchi, rinchiVersion, "Web", webRinchikeyTextElementId, log);
  }

  writeResult(log.join("\n"), logTextElementId);
}

async function convertRinchiToRinchikeyAndWriteResult(rinchi, rinchiVersion, keyType, rinchikeyTextElementId, log) {
  let rinchikeyResult;
  try {
    rinchikeyResult = await rinchikeyFromRinchi(rinchi, keyType, rinchiVersion);
  } catch(e) {
    log.push(`Caught exception from rinchikeyFromRinchi(): ${e}`);
    console.error(e);
    return;
  }
  writeResult(rinchikeyResult.rinchikey, rinchikeyTextElementId);

  if ((rinchikeyResult.return_code != 0) && (rinchikeyResult.error !== "")) {
    log.push("Error from rinchilib_rinchikey_from_rinchi() call: " + inchikeyResult.error);
  }
}

async function updateRinchiTab3() {
  const rinchi = document.getElementById("rinchi-tab3-rinchiTextarea").value.trim();
  const rauxinfo = document.getElementById("rinchi-tab3-rauxinfoTextarea").value.trim();
  const rinchiVersion = getVersion("rinchi-tab3-pane");
  const logTextElementId = "rinchi-tab3-logs";
  const ketcher = getKetcher("rinchi-tab3-ketcher");

  ketcher.editor.clear()
  writeResult("", logTextElementId);

  const fileText = await convertRinchiToTextfile(rinchi, rauxinfo, "RXN", rinchiVersion, logTextElementId)
  if (fileText) {
    await ketcher.setMolecule(fileText);
    //await ketcher.layout();
  }
}

async function updateRinchiTab4() {
  const rinchi = document.getElementById("rinchi-tab4-rinchiTextarea").value.trim();
  const rauxinfo = document.getElementById("rinchi-tab4-rauxinfoTextarea").value.trim();
  const format = document.querySelector("input.form-check-input[type=\"radio\"][name=\"rinchioutputformatRadio\"]:checked").value;
  const rinchiVersion = getVersion("rinchi-tab4-pane");
  const logTextElementId = "rinchi-tab4-logs";
  const outputTextElementId = "rinchi-tab4-rxnfile";

  writeResult("", logTextElementId, outputTextElementId);

  const fileText = await convertRinchiToTextfile(rinchi, rauxinfo, format, rinchiVersion, logTextElementId)
  if (fileText) {
    writeResult(fileText, outputTextElementId);
  }
}

async function convertRinchiToTextfile(rinchi, rauxinfo, format, rinchiVersion, logTextElementId) {
  if (!rinchi) {
    return;
  }
  if ((rinchi !== "") && (!rinchi.startsWith("RInChI="))) {
    writeResult("The RInChI string should start with \"RInChI=\".", logTextElementId);
    return;
  }
  if ((rauxinfo !== "") && (!rauxinfo.startsWith("RAuxInfo="))) {
    writeResult("The RAuxInfo string should start with \"RAuxInfo=\".", logTextElementId);
    return;
  }

  let rinchiResult;
  try {
    rinchiResult = await fileTextFromRinchi(rinchi, rauxinfo, format, rinchiVersion);
  } catch(e) {
    writeResult(`Caught exception from fileTextFromRinchi(): ${e}`, logTextElementId);
    console.error(e);
    return;
  }
  if (rinchiResult.error !== "") {
    writeResult("Error from rinchilib_file_text_from_rinchi() call: " + rinchiResult.error, logTextElementId);
  }

  return rinchiResult.fileText;
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

async function onTextareaDrop(event, updateFunction) {
  event.stopPropagation();
  event.preventDefault();

  const content = await extractContent(event.dataTransfer);
  if (!content) {
    return;
  }

  event.target.value = content;
  await updateFunction();
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
