"use strict";

async function addInchiOptionsForm(tabDivId, updateFunction) {
  const inchiVersion = getVersion(tabDivId);
  const inchiOptions = document.createElement(
    availableInchiVersions[inchiVersion].optionsTemplateId
  );
  await inchiOptions.postCreate(tabDivId, updateFunction, inchiVersion);

  const targetDiv = document
    .getElementById(tabDivId)
    .querySelector("div[data-inchi-options]");
  targetDiv.innerHTML = ""; // Remove previous options
  targetDiv.appendChild(inchiOptions); // Add current options
}

function resetInchiOptions(targetDivId) {
  const targetDiv = document.getElementById(targetDivId);

  targetDiv
    .querySelectorAll("input.form-check-input[data-default-checked]")
    .forEach((input) => {
      input.checked = true;
    });

  targetDiv
    .querySelectorAll("input.form-check-input:not([data-default-checked])")
    .forEach((input) => {
      input.checked = false;
    });

  targetDiv
    .querySelectorAll("input.form-check-input[data-default-disabled]")
    .forEach((input) => {
      input.disabled = true;
    });

  targetDiv
    .querySelectorAll("input.form-check-input:not([data-default-disabled])")
    .forEach((input) => {
      input.disabled = false;
    });

  // Bootstrap Multiselect widget for tautomer options
  $(targetDiv)
    .find("select[data-tautomer-multiselect]")
    .multiselect("deselectAll", false);
}

function getInchiOptions(tabId) {
  const options = [];
  const tabDiv = document.getElementById(tabId);

  tabDiv
    .querySelectorAll(
      "input.form-check-input:enabled[data-inchi-option-on]:checked"
    )
    .forEach((input) => {
      options.push(input.dataset.inchiOptionOn);
    });

  tabDiv
    .querySelectorAll(
      "input.form-check-input:enabled[data-inchi-option-off]:not(:checked)"
    )
    .forEach((input) => {
      options.push(input.dataset.inchiOptionOff);
    });

  // Bootstrap Multiselect widget for tautomer options
  tabDiv
    .querySelectorAll(
      "select[data-tautomer-multiselect] option[data-inchi-option-on]:checked"
    )
    .forEach((optionElement) => {
      options.push(optionElement.dataset.inchiOptionOn);
    });

  return options;
}

function collectInchiOptions(tabId) {
  return getInchiOptions(tabId)
    .map((o) => "-" + o)
    .join(" ");
}

function getVersion(tabId) {
  return document.getElementById(tabId).querySelector("select[data-version]")
    .value;
}

function getInchiOptionsState(tabDivId) {
  const inchiOptionsDiv = document
    .getElementById(tabDivId)
    .querySelector("div[data-inchi-options]");
  const optionsState = {};

  inchiOptionsDiv.querySelectorAll("input[data-id]").forEach((input) => {
    optionsState[input.dataset.id] = [input.checked, input.disabled];
  });

  // Bootstrap Multiselect widget for tautomer options
  inchiOptionsDiv
    .querySelectorAll("select[data-tautomer-multiselect] option[data-id]")
    .forEach((optionElement) => {
      optionsState[optionElement.dataset.id] = [
        optionElement.selected,
        optionElement.disabled,
      ];
    });

  return optionsState;
}

function applyInchiOptionsState(tabDivId, optionsState) {
  const inchiOptionsDiv = document
    .getElementById(tabDivId)
    .querySelector("div[data-inchi-options]");

  Object.entries(optionsState).forEach(([k, v]) => {
    const input = inchiOptionsDiv.querySelector(`input[data-id="${k}"]`);
    if (input) {
      input.checked = v[0];
      input.disabled = v[1];
      return;
    }

    // Bootstrap Multiselect widget for tautomer options
    if (v[0]) {
      $(inchiOptionsDiv)
        .find("select[data-tautomer-multiselect]")
        .multiselect("select", k);
    }
  });
}

/*
 * Update actions (when user changes inputs/options/(R)InChI version)
 */
async function updateInchiTab1() {
  // clear output fields
  writeResult(
    "",
    "inchi-tab1-inchi",
    "inchi-tab1-inchikey",
    "inchi-tab1-auxinfo",
    "inchi-tab1-logs"
  );

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
  await convertMolfileToInchiAndWriteResults(
    molfile,
    options,
    inchiVersion,
    "inchi-tab1-inchi",
    "inchi-tab1-inchikey",
    "inchi-tab1-auxinfo",
    "inchi-tab1-logs"
  );
}

async function updateInchiTab2() {
  // clear output fields
  writeResult(
    "",
    "inchi-tab2-inchi",
    "inchi-tab2-inchikey",
    "inchi-tab2-auxinfo",
    "inchi-tab2-logs"
  );

  // collect user input
  const molfile = document.getElementById("inchi-tab2-molfile").value;
  const options = collectInchiOptions("inchi-tab2-pane");
  const inchiVersion = getVersion("inchi-tab2-pane");

  // run conversion
  const [inchi, auxinfo] = await convertMolfileToInchiAndWriteResults(
    molfile,
    options,
    inchiVersion,
    "inchi-tab2-inchi",
    "inchi-tab2-inchikey",
    "inchi-tab2-auxinfo",
    "inchi-tab2-logs"
  );

  const viewer = document.getElementById("inchi-tab2-ngl-viewer");
  viewer.loadStructure(molfile, inchi, auxinfo);
}

async function updateInchiTab3() {
  const auxinfo = document
    .getElementById("inchi-tab3-inputTextarea")
    .value.trim();
  const inchiVersion = getVersion("inchi-tab3-pane");
  const logTextElementId = "inchi-tab3-logs";

  // clear outputs
  writeResult("", logTextElementId);

  // input validation
  if (!auxinfo) {
    return;
  }
  if (!auxinfo.startsWith("AuxInfo=")) {
    writeResult(
      'The input string should start with "AuxInfo=".',
      logTextElementId
    );
    return;
  }

  // run conversion
  const molfileResult = await molfileFromAuxinfo(auxinfo, 0, 0, inchiVersion);
  const { molfile, log, message } = molfileResult;
  const inchiResult = await inchiFromMolfile(molfile, "", inchiVersion);
  const { inchi } = inchiResult;

  const viewer = document.getElementById("inchi-tab3-ngl-viewer");
  viewer.loadStructure(molfile, inchi, auxinfo);

  const log_entries = [];
  if (log !== "") {
    log_entries.push(log);
  }
  if (message !== "") {
    log_entries.push(message);
  }
  writeResult(log_entries.join("\n"), logTextElementId);
}

async function updateInchiTab4() {
  // clear output fields
  writeResult("", "inchi-tab4-inchis");

  const options = collectInchiOptions("inchi-tab4-pane");
  const inchiVersion = getVersion("inchi-tab4-pane");
  const sdFile = document.getElementById("inchi-tab4-sdfFileInput").files[0];
  if (!sdFile || sdFile.size === 0 || sdFile.name.endsWith(".sdf") === false) {
    // no file selected or not a valid SDF file
    writeResult("No SD file selected.", "inchi-tab4-inchis");
    return;
  }

  const output = document.getElementById("inchi-tab4-inchis");
  await writeInchisFromSdFileToOutput(sdFile, options, inchiVersion, output);
}

async function writeInchisFromSdFileToOutput(
  sdFile,
  options,
  inchiVersion,
  output
) {
  const sdfText = await sdFile.text();

  const delimiter = getSDFDelimiter(sdfText);
  if (!delimiter) {
    output.innerHTML = "<p>Error: Invalid SDF file format.</p>";
    return;
  }
  const entries = sdfText
    .split(delimiter)
    .filter((entry) => entry.trim() !== "");

  console.log(entries.length, "entries found in the SD file");

  await throttleMap(entries, async (mol, index) => {
    if (mol === "") {
      return `<p>Error processing entry ${index + 1}: empty entry</p>`;
    }
    try {
      const inchiResult = await getAllFromMolfile(mol, options, inchiVersion);
      if (inchiResult.inchi !== "") {
        return `<p>${inchiResult.inchi}\n${inchiResult.auxinfo}\n${inchiResult.inchikey}\n</p>`;
      } else {
        return `<p>Error processing entry ${index + 1}:\n ${
          inchiResult.log
        }; </p>`;
      }
    } catch (e) {
      console.error(`Caught exception from inchiFromMolfile(): ${e}`);
      return `<p>Error processing entry ${index + 1}: ${e.message}</p>`;
    }
  })
    .then((results) => {
      output.innerHTML = results.join("");
    })
    .catch((error) => {
      console.error(`Error processing SD file: ${error}`);
      output.innerHTML = `<p>Error processing SD file: ${error.message}</p>`;
    });
}

function getSDFDelimiter(sdfText) {
  // Check for the presence of the delimiter
  if (sdfText.includes("$$$$\r\n")) {
    // Windows-style line endings
    return "$$$$\r\n";
  } else if (sdfText.includes("$$$$\n")) {
    // Unix-style line endings
    return "$$$$\n";
  } else if (sdfText.includes("$$$$\r")) {
    // Old Mac-style line ending
    return "$$$$\r";
  }
  return null; // No valid delimiter found
}

async function onChangeInChIVersionTab1() {
  await updateInchiOptions("inchi-tab1-pane", () => updateInchiTab1());
  await updateKetcherOptions(
    getKetcher("inchi-tab1-ketcher"),
    getVersion("inchi-tab1-pane")
  );
}
async function onChangeInChIVersionTab2() {
  await updateInchiOptions("inchi-tab2-pane", () => updateInchiTab2());
}

async function onChangeInChIVersionTab3() {
  await updateInchiTab3();
  await updateKetcherOptions(
    getKetcher("inchi-tab3-ketcher"),
    getVersion("inchi-tab3-pane")
  );
}

async function onChangeInChIVersionTab4() {
  await updateInchiOptions("inchi-tab4-pane", () => updateInchiTab4());
}

async function updateInchiOptions(tabDivId, updateFunction) {
  await addInchiOptionsForm(tabDivId, () => updateFunction());
  const optionsState = getInchiOptionsState(tabDivId);
  applyInchiOptionsState(tabDivId, optionsState);

  await updateFunction();
}

/*
 * Update the Ketcher options based on the selected InChI version
 */
async function updateKetcherOptions(ketcher, inchiVersion) {
  if (!ketcher) {
    console.log("Ketcher not found");
    return;
  }

  if (inchiVersion === "Latest with Molecular Inorganics") {
    await ketcher.editor.setOptions('{"showHydrogenLabels": "all"}');
    console.log("showHydrogenLabels: all");
  } else {
    await ketcher.editor.setOptions(
      '{"showHydrogenLabels": "Terminal and Hetero"}'
    );
    console.log("showHydrogenLabels: Terminal and Hetero");
  }
}

async function convertMolfileToInchiAndWriteResults(
  molfile,
  options,
  inchiVersion,
  inchiTextElementId,
  inchikeyTextElementId,
  auxinfoTextElementId,
  logTextElementId
) {
  const log_entries = [];
  log_entries.push("InChI options: " + options);

  let inchiResult;
  try {
    inchiResult = await inchiFromMolfile(molfile, options, inchiVersion);
  } catch (e) {
    writeResult(
      `Caught exception from inchiFromMolfile(): ${e}`,
      logTextElementId
    );
    console.error(e);
    return;
  }

  const { inchi, auxinfo, log, return_code } = inchiResult;
  writeResult(inchi, inchiTextElementId);
  writeResult(auxinfo, auxinfoTextElementId);

  if (log !== "") {
    log_entries.push(log);
  }

  if (return_code != -1 && inchi !== "") {
    let inchikeyResult;
    try {
      inchikeyResult = await inchikeyFromInchi(inchi, inchiVersion);
    } catch (e) {
      log_entries.push(`Caught exception from inchikeyFromInchi(): ${e}`);
      console.error(e);
    }
    writeResult(inchikeyResult.inchikey, inchikeyTextElementId);

    if (inchikeyResult.return_code == -1 && inchikeyResult.message !== "") {
      log_entries.push(inchikeyResult.message);
    }
  }

  writeResult(log_entries.join("\n"), logTextElementId);

  return [inchi, auxinfo];
}

function writeResult(text, ...ids) {
  for (let id of ids) {
    document.getElementById(id).textContent = text;
  }
}

async function updateRinchiTab1() {
  // clear output fields
  writeResult(
    "",
    "rinchi-tab1-rinchi",
    "rinchi-tab1-longrinchikey",
    "rinchi-tab1-shortrinchikey",
    "rinchi-tab1-webrinchikey",
    "rinchi-tab1-rauxinfo",
    "rinchi-tab1-logs"
  );

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
  const equilibrium = hasEquilibriumReactionArrow(ketcher);

  // run conversion
  await convertRxnfileToRinchiAndWriteResults(
    rxnfile,
    equilibrium,
    "rinchi-tab1-rinchi",
    "rinchi-tab1-longrinchikey",
    "rinchi-tab1-shortrinchikey",
    "rinchi-tab1-webrinchikey",
    "rinchi-tab1-rauxinfo",
    "rinchi-tab1-logs"
  );
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
  writeResult(
    "",
    "rinchi-tab2-rinchi",
    "rinchi-tab2-longrinchikey",
    "rinchi-tab2-shortrinchikey",
    "rinchi-tab2-webrinchikey",
    "rinchi-tab2-rauxinfo",
    "rinchi-tab2-logs"
  );

  // collect user input
  const rxnfile = document.getElementById(
    "rinchi-tab2-rxnrdfileTextarea"
  ).value;
  const equilibrium = document.getElementById(
    "rinchi-tab2-forceequilibrium"
  ).checked;

  // run conversion
  await convertRxnfileToRinchiAndWriteResults(
    rxnfile,
    equilibrium,
    "rinchi-tab2-rinchi",
    "rinchi-tab2-longrinchikey",
    "rinchi-tab2-shortrinchikey",
    "rinchi-tab2-webrinchikey",
    "rinchi-tab2-rauxinfo",
    "rinchi-tab2-logs"
  );
}

async function convertRxnfileToRinchiAndWriteResults(
  rxnfile,
  forceEquilibrium,
  rinchiTextElementId,
  longRinchikeyTextElementId,
  shortRinchikeyTextElementId,
  webRinchikeyTextElementId,
  rauxinfoTextElementId,
  logTextElementId
) {
  if (!rxnfile) {
    return;
  }

  const log = [];

  let rinchiResult;
  try {
    rinchiResult = await rinchiFromRxnfile(rxnfile, forceEquilibrium);
  } catch (e) {
    writeResult(
      `Caught exception from rinchiFromRxnfile(): ${e}`,
      logTextElementId
    );
    console.error(e);
    return;
  }
  writeResult(rinchiResult.rinchi, rinchiTextElementId);
  writeResult(rinchiResult.rauxinfo, rauxinfoTextElementId);

  if (rinchiResult.error !== "") {
    log.push(
      "Error from rinchilib_file_text_from_rinchi() call: " + rinchiResult.error
    );
  }

  if (rinchiResult.return_code == 0 && rinchiResult.rinchi !== "") {
    convertRinchiToRinchikeyAndWriteResult(
      rinchiResult.rinchi,
      "Long",
      longRinchikeyTextElementId,
      log
    );
    convertRinchiToRinchikeyAndWriteResult(
      rinchiResult.rinchi,
      "Short",
      shortRinchikeyTextElementId,
      log
    );
    convertRinchiToRinchikeyAndWriteResult(
      rinchiResult.rinchi,
      "Web",
      webRinchikeyTextElementId,
      log
    );
  }

  writeResult(log.join("\n"), logTextElementId);
}

async function convertRinchiToRinchikeyAndWriteResult(
  rinchi,
  keyType,
  rinchikeyTextElementId,
  log
) {
  let rinchikeyResult;
  try {
    rinchikeyResult = await rinchikeyFromRinchi(rinchi, keyType);
  } catch (e) {
    log.push(`Caught exception from rinchikeyFromRinchi(): ${e}`);
    console.error(e);
    return;
  }
  writeResult(rinchikeyResult.rinchikey, rinchikeyTextElementId);

  if (rinchikeyResult.return_code != 0 && rinchikeyResult.error !== "") {
    log.push(
      "Error from rinchilib_rinchikey_from_rinchi() call: " +
        inchikeyResult.error
    );
  }
}

async function updateRinchiTab3() {
  const rinchi = document
    .getElementById("rinchi-tab3-rinchiTextarea")
    .value.trim();
  const rauxinfo = document
    .getElementById("rinchi-tab3-rauxinfoTextarea")
    .value.trim();
  const logTextElementId = "rinchi-tab3-logs";
  const ketcher = getKetcher("rinchi-tab3-ketcher");

  ketcher.editor.clear();
  writeResult("", logTextElementId);

  const fileText = await convertRinchiToTextfile(
    rinchi,
    rauxinfo,
    "RXN",
    logTextElementId
  );
  if (fileText) {
    await ketcher.setMolecule(fileText);
    //await ketcher.layout();
  }
}

async function updateRinchiTab4() {
  const rinchi = document
    .getElementById("rinchi-tab4-rinchiTextarea")
    .value.trim();
  const rauxinfo = document
    .getElementById("rinchi-tab4-rauxinfoTextarea")
    .value.trim();
  const format = document.querySelector(
    'input.form-check-input[type="radio"][name="rinchioutputformatRadio"]:checked'
  ).value;
  const logTextElementId = "rinchi-tab4-logs";
  const outputTextElementId = "rinchi-tab4-rxnfile";

  writeResult("", logTextElementId, outputTextElementId);

  const fileText = await convertRinchiToTextfile(
    rinchi,
    rauxinfo,
    format,
    logTextElementId
  );
  if (fileText) {
    writeResult(fileText, outputTextElementId);
  }
}

async function convertRinchiToTextfile(
  rinchi,
  rauxinfo,
  format,
  logTextElementId
) {
  if (!rinchi) {
    return;
  }
  if (rinchi !== "" && !rinchi.startsWith("RInChI=")) {
    writeResult(
      'The RInChI string should start with "RInChI=".',
      logTextElementId
    );
    return;
  }
  if (rauxinfo !== "" && !rauxinfo.startsWith("RAuxInfo=")) {
    writeResult(
      'The RAuxInfo string should start with "RAuxInfo=".',
      logTextElementId
    );
    return;
  }

  let rinchiResult;
  try {
    rinchiResult = await fileTextFromRinchi(rinchi, rauxinfo, format);
  } catch (e) {
    writeResult(
      `Caught exception from fileTextFromRinchi(): ${e}`,
      logTextElementId
    );
    console.error(e);
    return;
  }
  if (rinchiResult.error !== "") {
    writeResult(
      "Error from rinchilib_file_text_from_rinchi() call: " +
        rinchiResult.error,
      logTextElementId
    );
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
  event.dataTransfer.dropEffect = "copy";
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
    return new Promise((resolve) => {
      item.getAsString((data) => resolve(data));
    });
  }
  return null;
}

function throttleMap(inputs, mapper, maxConcurrent = 5) {
  const results = [];
  let i = 0;
  let active = 0;

  return new Promise((resolve) => {
    function next() {
      while (active < maxConcurrent && i < inputs.length) {
        const currentIndex = i++;
        active++;
        Promise.resolve(mapper(inputs[currentIndex], currentIndex))
          .then((res) => {
            results[currentIndex] = res;
          })
          .catch((err) => {
            results[currentIndex] = { error: err.message || err.toString() };
          })
          .finally(() => {
            active--;
            next();
            if (i >= inputs.length && active === 0) {
              resolve(results);
            }
          });
      }
    }
    next();
  });
}

async function openReportMask(tabIdentifier = 'inchi-tab1') {
  let reportMaskHost = document.querySelector("report-mask");

  // Store the tab identifier for use in processReportMaskSubmission
  reportMaskHost._activeTab = tabIdentifier;

  initReportMask(reportMaskHost);

  // If host exposes open(), call it directly and pass structure via an event.
  if (reportMaskHost.open && typeof reportMaskHost.open === "function") {
    try {
      reportMaskHost.open();
      return;
    } catch (err) {
      console.error("Error calling reportMaskHost.open():", err);
    }
  }

  // If we fall through, wait briefly for init to complete and try again.
  const start = Date.now();
  const waitForOpen = () => {
    if (reportMaskHost.open && typeof reportMaskHost.open === "function") {
      try {
        reportMaskHost.open();
      } catch (err) {
        console.error("Error calling reportMaskHost.open():", err);
      }
    } else if (Date.now() - start < 2000) {
      setTimeout(waitForOpen, 50);
    } 
  };
  waitForOpen();
}

function initReportMask(providedHost) {
  const host = providedHost || document.querySelector("report-mask");
  if (!host) return;
  if (host._reportMaskInitialized) return; // idempotent

  // A small helper that tries to find the required internals and complete the init.
  const attemptInit = () => {
    const overlay = host.querySelector("#maskOverlay");
    const dialog = host.querySelector("#maskDialog");
    const closeBtn = host.querySelector("#closeMaskBtn");
    const cancelBtn = host.querySelector("#cancelBtn");
    const form = host.querySelector("#maskForm");
    const nameInput = host.querySelector("#nameInput");
    const descriptionInput = host.querySelector("#descriptionInput");

    if (!overlay || !dialog || !closeBtn || !cancelBtn || !form || !nameInput || !descriptionInput) {
      return false; // not ready yet
    }

    let lastFocused = null;
    let structure = null;

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        host._realClose && host._realClose();
        return;
      }

      if (e.key === "Tab") {
        const focusable = dialog.querySelectorAll(
          "a[href], button:not([disabled]), textarea, input, select"
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function openDialog() {
      lastFocused = document.activeElement;
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      nameInput.focus();
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onKeyDown);
    }

    function closeDialog() {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      if (lastFocused instanceof HTMLElement) lastFocused.focus();
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeDialog();
    });
    closeBtn.addEventListener("click", closeDialog);
    cancelBtn.addEventListener("click", closeDialog);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const name = nameInput.value.trim() || null;
      const description = descriptionInput.value.trim() || null;
      processReportMaskSubmission({ name, description });
      form.reset();
      closeDialog();
    });

    // Compatibility: listen for the openReportMask event as before.
    document.addEventListener("openReportMask", function (e) {
      if (e && e.detail && e.detail.structure) structure = e.detail.structure;
      openDialog();
    });

    // Expose real methods.
    host._realOpen = openDialog;
    host._realClose = closeDialog;
    host.open = function () {
      // If init is done, call real open; otherwise mark pending and return.
      if (host._reportMaskInitialized && host._realOpen) {
        host._realOpen();
      } else {
        host._pendingOpen = true;
      }
    };
    host.close = function () {
      if (host._realClose) host._realClose();
    };

    host._reportMaskInitialized = true;

    // If someone requested open before init completed, honor it now.
    if (host._pendingOpen) {
      host._pendingOpen = false;
      host._realOpen && host._realOpen();
    }

    return true;
  };

  // Try immediate initialization; if not ready, observe until structure is present (or timeout).
  if (!attemptInit()) {
    const observer = new MutationObserver((_, obs) => {
      if (attemptInit()) {
        obs.disconnect();
      }
    });
    observer.observe(host, { childList: true, subtree: true });
    // Ensure we stop observing after a timeout.
    setTimeout(() => observer.disconnect(), 2000);
  }
}

document.addEventListener('DOMContentLoaded', initReportMask);

// Process a report-mask form submission (moved from inline fragment)
async function processReportMaskSubmission(formData = {}) {
  try {
    const reportMaskHost = document.querySelector("report-mask");
    const tabIdentifier = reportMaskHost._activeTab || 'inchi-tab1';
    const paneId = `${tabIdentifier}-pane`;

    const textOrNull = (id) => {
      const el = document.getElementById(id);
      return el && el.textContent && el.textContent.trim() ? el.textContent.trim() : null;
    };

    // Get mol file
    let molfile = null;

    if (tabIdentifier === 'inchi-tab1') {
      // from ketcher for InChI Tab
      const ketcher = getKetcher(`${tabIdentifier}-ketcher`);
      
      try {
        if (ketcher) molfile = await ketcher.getMolfile();
      } catch (err) {
        molfile = null;
      }
    } else if(tabIdentifier === 'inchi-tab2') {
      // from molfile for Molfile Tab
      molfile = document.getElementById("inchi-tab2-molfile").value;
    }

    const inchi = textOrNull(`${tabIdentifier}-inchi`);
    const inchikey = textOrNull(`${tabIdentifier}-inchikey`);
    const auxinfo = textOrNull(`${tabIdentifier}-auxinfo`);
    // Remove InChI options from the log 
    const log = textOrNull(`${tabIdentifier}-logs`);
    const cleanedLog = log && log.startsWith('InChI options: ') 
      ? log.replace(/^InChI options: [^\n]*\n?/, '')
      : log;
    const inchi_version = getVersion(paneId);

    // Collect InChI options as a string
    let options = "";
    try {
      options = getInchiOptions(paneId)
      .map((o) => "-" + o)
      .join(" ");
    } catch (err) {
      options = "";
    }

    const payload = {
      input_source: "WebDemo",
      inchi_version: inchi_version,
      user: formData.name || null,
      description: formData.description,
      molfile: molfile,
      inchi: inchi,
      inchikey: inchikey,
      auxinfo: auxinfo,
      options: options,
      log: cleanedLog,
    };

    console.log('reportMask:json', payload);
    document.dispatchEvent(new CustomEvent('reportMask:json', { detail: payload }));
    const token = "JchSKSAoUUjKXriWdcUlb2a3hIvIgdPs";

    fetch('.../ingest_issue', { //TODO: change
      method: 'POST',
      headers: {"Access-Control-Allow-Origin": "*",  "Authorization": token, "Content-Type": "application/json"},
      body: JSON.stringify(payload),
    })
      .then(response => response.json())
      .then(json => {
        console.log('reportMask:json', json);
        document.dispatchEvent(new CustomEvent('reportMask:json', { detail: json }));
      })

  } catch (err) {
    console.error('Error assembling report mask JSON', err);
  }
}
