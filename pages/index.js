"use strict";

/*
 * Load a script on demand, once, and resolve when it has run.
 *
 * The heavy parts of this app — one WebAssembly module per InChI version, the
 * RInChI module, the NGL viewer — used to be fetched and compiled during page
 * load whether or not the visitor ever reached the tab that needs them. They
 * are pulled in through here instead, at the point where something is about to
 * use them (or when opening a tab signals that intent; see warmUp below).
 */
const loadedScripts = new Map();

function loadScriptOnce(src) {
  if (!loadedScripts.has(src)) {
    loadedScripts.set(
      src,
      new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = false;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Could not load ${src}`));
        document.head.appendChild(script);
      })
    );
  }
  return loadedScripts.get(src);
}

/*
 * Fetch the heavy modules on intent rather than on demand, so that deferring
 * them off the page load does not turn into a wait at the moment of use.
 *
 * - the default InChI version once the page has loaded and gone idle, because
 *   the first tab converts as soon as the visitor draws something;
 * - the RInChI module and the 3D viewer when their tab is opened, seconds
 *   before either is needed.
 */
function warmUp() {
  const warm = (promise) =>
    Promise.resolve(promise).catch((error) =>
      console.error("Warm-up failed", error)
    );

  /*
   * After "load", not just when idle: drawing needs the structure editor, so
   * there is nothing to gain from competing with it for bandwidth.
   */
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
  window.addEventListener("load", () => idle(warmDefaultInchiVersion));

  async function warmDefaultInchiVersion() {
    try {
      await window.inchiVersionsReady;
    } catch {
      return; // The version selector reports this to the visitor.
    }
    const defaultVersion = Object.entries(availableInchiVersions).find(
      ([, config]) => config.default
    )?.[0];
    if (defaultVersion) {
      warm(availableInchiVersions[defaultVersion].module);
    }
  }

  document.addEventListener("shown.bs.tab", (event) => {
    const target = event.target.dataset.bsTarget;
    if (target === "#pills-rinchi") {
      warm(rinchiModule());
    }
    if (target === "#inchi-tab2-pane" || target === "#inchi-tab3-pane") {
      warm(document.querySelector(`${target} inchi-ngl-viewer`)?.ensureStage());
    }
  });
}
warmUp();

/*
 * Behaviour that differs per InChI version, keyed by the display names in
 * inchi_versions.json.
 *
 * Kept in one place because these used to be string comparisons spread over the
 * code: renaming a version in inchi_versions.json silently disabled the
 * behaviour instead of breaking anything visibly. assertVersionBehavior() now
 * reports a key that no longer matches a version.
 */
const VERSION_BEHAVIOR = {
  "Dev with Molecular Inorganics": {
    // Molecular inorganics need every hydrogen label drawn in Ketcher.
    showAllHydrogenLabels: true,
    checkNPZzByDefault: true,
  },
  "Polymer Support": {
    // The polymer build is only interesting with polymer handling switched on.
    checkNPZzByDefault: true,
    polymerOptionsOn: true,
  },
  "Dev with Enhanced Stereochemistry": {
    // Enhanced stereochemistry is only representable in V3000.
    molfileFormat: "v3000",
  },
};

function versionBehavior(inchiVersion) {
  return VERSION_BEHAVIOR[inchiVersion] ?? {};
}

async function assertVersionBehavior() {
  try {
    await window.inchiVersionsReady;
  } catch {
    // The version selector reports a missing version list to the user.
    return;
  }
  Object.keys(VERSION_BEHAVIOR)
    .filter((versionName) => !(versionName in availableInchiVersions))
    .forEach((versionName) => {
      console.error(
        `VERSION_BEHAVIOR has no matching InChI version: "${versionName}". ` +
          `Rename it to one of: ${Object.keys(availableInchiVersions).join(", ")}.`,
      );
    });
}
assertVersionBehavior();

async function addInchiOptionsForm(tabDivId, updateFunction) {
  await window.inchiVersionsReady;
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
  if (!ketcher) {
    writeResult(
      "The structure editor is not ready yet. Please reload the page (CTRL + F5) if this persists.",
      "inchi-tab1-logs",
    );
    return;
  } else if (ketcher.containsReaction()) {
    writeResult(
      "InChI describes single structures, not reactions. Switch to the RInChI tab to convert this reaction.",
      "inchi-tab1-logs"
    );
    return;
  } else if (ketcher.editor.struct().isBlank()) {
    // no structure
    return;
  } else {
    const molfileFormat = versionBehavior(inchiVersion).molfileFormat;
    molfile = molfileFormat
      ? await ketcher.getMolfile(molfileFormat)
      : await ketcher.getMolfile();
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
      'This does not look like an AuxInfo string: it should start with "AuxInfo=".',
      logTextElementId
    );
    return;
  }

  // run conversion
  let molfile, log, message, inchi;
  try {
    ({ molfile, log, message } = await molfileFromAuxinfo(
      auxinfo,
      0,
      0,
      inchiVersion
    ));
    ({ inchi } = await inchiFromMolfile(molfile, "", inchiVersion));
  } catch (e) {
    writeResult(
      `This AuxInfo could not be converted to a structure.\nDetail: ${e}`,
      logTextElementId
    );
    console.error(e);
    return;
  }

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
  if (!sdFile) {
    writeResult("Choose an SD file to convert.", "inchi-tab4-inchis");
    return;
  }
  // Case-insensitive: Windows tools routinely write ".SDF".
  if (!sdFile.name.toLowerCase().endsWith(".sdf")) {
    writeResult(
      `"${sdFile.name}" is not an SD file. Please choose a file with the .sdf extension.`,
      "inchi-tab4-inchis"
    );
    return;
  }
  if (sdFile.size === 0) {
    writeResult(`"${sdFile.name}" is empty.`, "inchi-tab4-inchis");
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
  /*
   * A single-record file exported as .sdf often has no "$$$$" terminator. That
   * is still something we can convert, so treat the whole text as one record
   * instead of rejecting the file.
   */
  const entries = (delimiter ? sdfText.split(delimiter) : [sdfText]).filter(
    (entry) => entry.trim() !== ""
  );

  if (entries.length === 0) {
    writeResult(
      `No records found in "${sdFile.name}". Records are separated by "$$$$".`,
      output.id
    );
    return;
  }

  let completed = 0;
  const reportProgress = () => {
    completed++;
    // Coarse enough not to thrash layout on a file with thousands of records.
    if (completed % 20 === 0) {
      output.textContent = `Converted ${completed} of ${entries.length} records…`;
    }
  };
  output.textContent = `Converting ${entries.length} record${
    entries.length === 1 ? "" : "s"
  }…`;

  try {
    const results = await throttleMap(entries, async (mol, index) => {
      try {
        const inchiResult = await getAllFromMolfile(mol, options, inchiVersion);
        if (inchiResult.inchi !== "") {
          return `${inchiResult.inchi}\n${inchiResult.auxinfo}\n${inchiResult.inchikey}\n`;
        }
        return `Record ${index + 1} could not be converted.\nDetail: ${inchiResult.log}\n`;
      } catch (e) {
        console.error(`Caught exception from inchiFromMolfile(): ${e}`);
        return `Record ${index + 1} could not be converted.\nDetail: ${e.message}\n`;
      } finally {
        reportProgress();
      }
    });
    /*
     * textContent, not innerHTML: the records come from a file the user was
     * given by someone else, and the <pre> renders the line breaks anyway.
     */
    output.textContent = results.join("\n");
  } catch (error) {
    console.error(`Error processing SD file: ${error}`);
    output.textContent = `The SD file could not be processed.\nDetail: ${error.message}`;
  }
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
  // This tab renders into the NGL viewer, so there is no Ketcher to reconfigure.
  await updateInchiTab3();
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
    console.error("Ketcher not found");
    return;
  }

  const showHydrogenLabels = versionBehavior(inchiVersion).showAllHydrogenLabels
    ? "all"
    : "Terminal and Hetero";
  await ketcher.editor.setOptions(
    JSON.stringify({ showHydrogenLabels: showHydrogenLabels })
  );
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
      `The InChI library could not process this structure.\nDetail: inchiFromMolfile() threw ${e}`,
      logTextElementId
    );
    console.error(e);
    // Callers destructure the result, so an error still has to return a pair.
    return ["", ""];
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
      log_entries.push(
        `The InChIKey could not be generated.\nDetail: inchikeyFromInchi() threw ${e}`
      );
      console.error(e);
    }

    // Nothing to write when the call above threw.
    if (inchikeyResult) {
      writeResult(inchikeyResult.inchikey, inchikeyTextElementId);

      if (inchikeyResult.return_code == -1 && inchikeyResult.message !== "") {
        log_entries.push(inchikeyResult.message);
      }
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
  if (!ketcher) {
    writeResult(
      "The reaction editor is not ready yet. Please reload the page (CTRL + F5) if this persists.",
      "rinchi-tab1-logs"
    );
    return;
  } else if (ketcher.editor.struct().isBlank()) {
    // no structure
    return;
  } else if (!ketcher.containsReaction()) {
    writeResult(
      "This drawing is not a reaction yet. Add a reaction arrow to convert it to a RInChI.",
      "rinchi-tab1-logs"
    );
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
      `The reaction could not be converted to a RInChI.\nDetail: rinchiFromRxnfile() threw ${e}`,
      logTextElementId
    );
    console.error(e);
    return;
  }
  writeResult(rinchiResult.rinchi, rinchiTextElementId);
  writeResult(rinchiResult.rauxinfo, rauxinfoTextElementId);

  if (rinchiResult.error !== "") {
    log.push(
      "The reaction could not be converted to a RInChI.\nDetail: " +
        "rinchilib_rinchi_from_file_text returned: " +
        rinchiResult.error
    );
  }

  if (rinchiResult.return_code == 0 && rinchiResult.rinchi !== "") {
    /*
     * Awaited: these push their errors onto `log`, which is written out below.
     * Without the await the writes happened after the log had been rendered, so
     * a failing key conversion left no trace anywhere in the UI.
     */
    await Promise.all([
      convertRinchiToRinchikeyAndWriteResult(
        rinchiResult.rinchi,
        "Long",
        longRinchikeyTextElementId,
        log
      ),
      convertRinchiToRinchikeyAndWriteResult(
        rinchiResult.rinchi,
        "Short",
        shortRinchikeyTextElementId,
        log
      ),
      convertRinchiToRinchikeyAndWriteResult(
        rinchiResult.rinchi,
        "Web",
        webRinchikeyTextElementId,
        log
      ),
    ]);
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
    log.push(
      `The ${keyType}-RInChIKey could not be generated.\nDetail: rinchikeyFromRinchi() threw ${e}`
    );
    console.error(e);
    return;
  }
  writeResult(rinchikeyResult.rinchikey, rinchikeyTextElementId);

  if (rinchikeyResult.return_code != 0 && rinchikeyResult.error !== "") {
    log.push(
      `The ${keyType}-RInChIKey could not be generated.\nDetail: ` +
        "rinchilib_rinchikey_from_rinchi returned: " +
        rinchikeyResult.error
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
  if (!ketcher) {
    writeResult(
      "The reaction editor is not ready yet. Please reload the page (CTRL + F5) if this persists.",
      logTextElementId
    );
    return;
  }

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
      'This does not look like a RInChI string: it should start with "RInChI=".',
      logTextElementId
    );
    return;
  }
  if (rauxinfo !== "" && !rauxinfo.startsWith("RAuxInfo=")) {
    writeResult(
      'This does not look like a RAuxInfo string: it should start with "RAuxInfo=".',
      logTextElementId
    );
    return;
  }

  let rinchiResult;
  try {
    rinchiResult = await fileTextFromRinchi(rinchi, rauxinfo, format);
  } catch (e) {
    writeResult(
      `This RInChI could not be converted to a file.\nDetail: fileTextFromRinchi() threw ${e}`,
      logTextElementId
    );
    console.error(e);
    return;
  }
  if (rinchiResult.error !== "") {
    writeResult(
      "This RInChI could not be converted to a file.\nDetail: " +
        "rinchilib_file_text_from_rinchi returned: " +
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
  // Undefined until the iframe exists and its bundle has run; callers check.
  return document.getElementById(iframeId)?.contentWindow?.ketcher;
}

function onKetcherLoaded(iframeId, updateFunction, attemptsLeft = 300) {
  const ketcher = getKetcher(iframeId);

  // Chrome fires the onload event too early, so we have to wait until 'ketcher' exists.
  if (ketcher) {
    ketcher.editor.subscribe("change", updateFunction);
    return;
  }
  /*
   * Bounded, and on a timer rather than a 0 ms loop: if the editor never turns
   * up (a failed or blocked iframe) the old version spun a core for the
   * lifetime of the page.
   */
  if (attemptsLeft <= 0) {
    console.error(`Ketcher in "${iframeId}" did not initialize within 30 s.`);
    return;
  }
  setTimeout(
    () => onKetcherLoaded(iframeId, updateFunction, attemptsLeft - 1),
    100
  );
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
    // Without this the loop below never runs, so the promise never settles.
    if (inputs.length === 0) {
      resolve(results);
      return;
    }

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
