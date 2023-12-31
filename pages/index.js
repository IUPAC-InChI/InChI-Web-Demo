"use strict";

/*
 * Page loaded:
 * - initialize user-selectable parameters
 */
function onBodyLoad() {
  addVersionsToSelect("inchi-tab1-inchiversion", availableInchiVersions);
  addInchiOptions("inchi-tab1-options", () => updateInchiTab1());

  addVersionsToSelect("inchi-tab2-inchiversion", availableInchiVersions);
  addInchiOptions("inchi-tab2-options", () => updateInchiTab2());

  addVersionsToSelect("inchi-tab3-inchiversion", availableInchiVersions);

  addVersionsToSelect("rinchi-tab1-rinchiversion", availableRInchiVersions);
  addVersionsToSelect("rinchi-tab2-rinchiversion", availableRInchiVersions);
  addVersionsToSelect("rinchi-tab3-rinchiversion", availableRInchiVersions);
  addVersionsToSelect("rinchi-tab4-rinchiversion", availableRInchiVersions);
}

function addVersionsToSelect(selectId, versions) {
  versions.forEach(v => {
    const option = document.createElement("option");
    option.innerHTML = v;
    option.value = v;
    document.getElementById(selectId).appendChild(option);
  });
}

function addInchiOptions(targetDivId, updateFunction) {
  const template = document.getElementById("inchiOptionsTemplate");
  const clone = template.content.cloneNode(true);

  /*
   * Reassign the name of the "stereoRadio" radio button group.
   */
  clone.querySelectorAll("input.form-check-input[type=\"radio\"][name=\"stereoRadio\"]").forEach(input => {
    input.name = "stereoRadio-" + targetDivId;
  });

  /*
   * Register an on-change event on the "Include Stereo" checkbox to switch the
   * 'disabled' state of the inputs that cope with stereo options.
   */
  clone.getElementById("includeStereo").addEventListener("change", function() {
    document.getElementById(targetDivId).querySelectorAll("input.form-check-input[data-inchi-stereo-option]").forEach(input => {
      input.disabled = !this.checked;
    });
  });

  /*
   * Register an on-change event on the "Treat polymers" checkbox to switch the
   * 'disabled' state of the inputs that cope with polymer options.
   */
  clone.getElementById("treatPolymers").addEventListener("change", function() {
    document.getElementById(targetDivId).querySelectorAll("input.form-check-input[data-inchi-polymer-option]").forEach(input => {
      input.disabled = !this.checked;
    });
  });

  /*
   * Register an on-click event on the "Reset InChI Options" link.
   */
  clone.querySelector("a[data-reset-inchi-options]").addEventListener("click", function() {
    resetInchiOptions(targetDivId);
    updateFunction();
  });

  /*
   * Reassign ids of all <input> elements and change the target id of their
   * <label> element accordingly. Also register an on-change event to call
   * updateFunction.
   */
  clone.querySelectorAll("input.form-check-input").forEach(input => {
    const newId = input.id + "-" + targetDivId;
    input.id = newId;
    input.nextElementSibling.htmlFor = newId;

    input.addEventListener("change", updateFunction);
  });

  document.getElementById(targetDivId).appendChild(clone);
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
}

/*
 * Update actions (when user changes inputs)
 */
async function updateInchiTab1() {
  // clear output fields
  writeResult("", "inchi-tab1-inchi", "inchi-tab1-inchikey", "inchi-tab1-auxinfo", "inchi-tab1-logs");

  // collect user input
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
  const options = collectInchiOptions("inchi-tab1-options");
  const inchiVersion = document.getElementById("inchi-tab1-inchiversion").value;

  // run conversion
  await convertMolfileToInchiAndWriteResults(molfile, options, inchiVersion, "inchi-tab1-inchi", "inchi-tab1-inchikey", "inchi-tab1-auxinfo", "inchi-tab1-logs");
}

async function updateInchiTab2() {
  // clear output fields
  writeResult("", "inchi-tab2-inchi", "inchi-tab2-inchikey", "inchi-tab2-auxinfo", "inchi-tab2-logs");

  // collect user input
  const molfile = document.getElementById("inchi-tab2-molfileTextarea").value;
  const options = collectInchiOptions("inchi-tab2-options");
  const inchiVersion = document.getElementById("inchi-tab2-inchiversion").value;

  // run conversion
  await convertMolfileToInchiAndWriteResults(molfile, options, inchiVersion, "inchi-tab2-inchi", "inchi-tab2-inchikey", "inchi-tab2-auxinfo", "inchi-tab2-logs");
}

async function convertMolfileToInchiAndWriteResults(molfile, options, inchiVersion, inchiTextElementId, inchikeyTextElementId, auxinfoTextElementId, logTextElementId) {
  const log = [];
  log.push("InChI options: " + options);

  let inchiResult;
  try {
    inchiResult = await inchiFromMolfile(molfile, options, inchiVersion);
  } catch(e) {
    writeResult(e, logTextElementId);
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
      log.push(e);
    }
    writeResult(inchikeyResult.inchikey, inchikeyTextElementId);

    if ((inchikeyResult.return_code == -1) && (inchikeyResult.message !== "")) {
      log.push(inchikeyResult.message);
    }
  }

  writeResult(log.join("\n"), logTextElementId);
}

function collectInchiOptions(tabOptionsId) {
  const options = [];

  document.getElementById(tabOptionsId)
    .querySelectorAll("input.form-check-input:enabled[data-inchi-option-on]:checked")
    .forEach(input => {
      options.push(input.dataset.inchiOptionOn);
    }
  );

  document.getElementById(tabOptionsId)
    .querySelectorAll("input.form-check-input:enabled[data-inchi-option-off]:not(:checked)")
    .forEach(input => {
      options.push(input.dataset.inchiOptionOff);
    }
  );

  return options.map(o => "-" + o).join(" ");
}

function writeResult(text, ...ids) {
  for (let id of ids) {
    document.getElementById(id).textContent = text;
  }
}

async function updateInchiTab3() {
  const input = document.getElementById("inchi-tab3-inputTextarea").value.trim();
  const inchiVersion = document.getElementById("inchi-tab3-inchiversion").value;
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
  try {
    if (input.startsWith("InChI=")) {
      molfileResult = await molfileFromInchi(input, "", inchiVersion);
    } else if (input.startsWith("AuxInfo=")) {
      molfileResult = await molfileFromAuxinfo(input, 0, 0, inchiVersion);
    }
  } catch(e) {
    writeResult(e, logTextElementId);
    return;
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
  const rinchiVersion = document.getElementById("rinchi-tab1-rinchiversion").value;
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
  const rinchiVersion = document.getElementById("rinchi-tab2-rinchiversion").value;
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
    writeResult("Caught exception from rinchiFromRxnfile(): " + e, logTextElementId);
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
    log.push("Caught exception from rinchikeyFromRinchi(): " + e);
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
  const rinchiVersion = document.getElementById("rinchi-tab3-rinchiversion").value;
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
  const rinchiVersion = document.getElementById("rinchi-tab4-rinchiversion").value;
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
    writeResult("Caught exception from fileTextFromRinchi(): " + e, logTextElementId);
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
