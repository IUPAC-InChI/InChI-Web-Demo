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
 * Version comparison.
 *
 * This is what the tool is for and what it could not do: the version selector
 * destroyed the answer you were comparing against, so comparing meant holding
 * a 60-character identifier in your head while a different one loaded. A
 * pinned result stays, and the next conversion is diffed against it layer by
 * layer — because the useful answer is almost never "a different string", it
 * is "the /t layer moved".
 *
 * Keyed by pane, so the four tabs pin independently.
 */
const pinnedResults = new Map();

function inchiElementIdFor(paneId) {
  return paneId.replace(/-pane$/, "-inchi");
}

function inchikeyElementIdFor(paneId) {
  return paneId.replace(/-pane$/, "-inchikey");
}

function currentResultFor(paneId) {
  const text =
    document.getElementById(inchiElementIdFor(paneId))?.textContent.trim() ??
    "";
  if (!text.startsWith("InChI=")) {
    return null;
  }
  /*
   * A version name should always be there, but an empty one would leave a hole
   * in the middle of a sentence ("3 of 7 layers differ between and Dev"), so
   * it degrades to something readable rather than to nothing.
   */
  const version = getVersion(paneId) || "an unnamed version";
  /*
   * The key is pinned with the InChI it came from. It is the thing most people
   * actually paste into a database or a paper, so a comparison that comes back
   * with only the InChI leaves out the half the user is going to use.
   */
  const inchikey =
    document
      .getElementById(inchikeyElementIdFor(paneId))
      ?.textContent.trim() ?? "";
  return { version, inchi: text, inchikey };
}

function pinCurrentResult(paneId) {
  const current = currentResultFor(paneId);
  if (current === null) {
    setConversionStatus(
      paneId,
      "error",
      "Nothing to pin yet - convert a structure first."
    );
    return;
  }
  pinnedResults.set(paneId, current);
  renderComparison(paneId);
}

function clearComparison(paneId) {
  pinnedResults.delete(paneId);
  renderComparison(paneId);
}

/*
 * Enable each comparison control only when it has something to act on: you
 * cannot pin an empty result, and there is nothing to clear until you have.
 */
function updateComparisonControls(paneId) {
  const pane = document.getElementById(paneId);
  const pinButton = pane?.querySelector("[data-pin]");
  const clearButton = pane?.querySelector("[data-clear-comparison]");
  if (pinButton) {
    pinButton.disabled = currentResultFor(paneId) === null;
  }
  if (clearButton) {
    clearButton.disabled = !pinnedResults.has(paneId);
  }
}

function renderComparison(paneId) {
  const pane = document.getElementById(paneId);
  const host = pane?.querySelector("[data-comparison]");
  updateComparisonControls(paneId);
  if (!host) {
    return;
  }

  const pinned = pinnedResults.get(paneId);
  const current = currentResultFor(paneId);

  if (!pinned) {
    host.hidden = true;
    host.replaceChildren();
    return;
  }

  const rows = current ? diffInchiLayers(pinned.inchi, current.inchi) : [];
  const changed = rows.filter((row) => row.status !== "same");

  /*
   * Both sides can carry the same version name — pinning a result and then
   * changing the option flags is a real comparison, and "1.07.5 and 1.07.5
   * differ" reads like a bug. Name the sides by what actually distinguishes
   * them in that case.
   */
  const sameVersion =
    current !== null && pinned.version === current.version;
  const left = sameVersion
    ? "the pinned result"
    : escapeHtml(pinned.version);
  const right = sameVersion
    ? "the current one"
    : current
      ? escapeHtml(current.version)
      : "";

  /*
   * The key's own comparison. Rendered as its three blocks rather than as two
   * 27-character runs, so "same skeleton, different stereo" is readable.
   */
  const keyRows =
    current && (pinned.inchikey || current.inchikey)
      ? diffInchikeyBlocks(pinned.inchikey, current.inchikey)
      : [];
  const keyChanged = keyRows.filter((row) => row.status !== "same");

  /*
   * Every segment carries both answers, side by side, whether or not it
   * changed: knowing the formula and connections are identical is what makes
   * "only the stereo layer moved" mean anything, and a row that shows one
   * value cannot be read as a comparison at all.
   *
   * The side labels ride on each cell as data-side so that narrow screens can
   * stack the two values and still say which is which (see css/index.css).
   */
  const leftHead = sameVersion ? "Pinned" : pinned.version;
  const rightHead = sameVersion
    ? "Current"
    : current
      ? current.version
      : "-";

  const comparisonHead =
    `<div class="layer-key"></div>` +
    `<div class="layer-value apparatus">${escapeHtml(leftHead)}</div>` +
    `<div class="layer-value apparatus">${escapeHtml(rightHead)}</div>`;

  const comparisonRow = (label, letter, row) => {
    const changed = row.status !== "same";
    const cell = (value, side, isCurrent) => {
      const absent =
        value === undefined
          ? '<span class="layer-absent">not emitted</span>'
          : escapeHtml(value);
      const classes = [
        "layer-value",
        changed ? "layer-cell-changed" : "layer-value-same",
        changed && isCurrent ? "layer-value-current" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<div class="${classes}" data-side="${escapeHtml(side)}">${absent}</div>`;
    };
    const mark = changed
      ? `<span class="layer-mark">${notationMark("changed")}</span>`
      : "";
    const key =
      `<div class="layer-key${changed ? " layer-cell-changed" : ""}">` +
      `${mark}<span class="layer-letter">${escapeHtml(letter)}</span> ` +
      `${escapeHtml(label)}</div>`;
    return (
      key +
      cell(row.before, leftHead, false) +
      cell(row.after, rightHead, true)
    );
  };

  const body = rows
    .map((row) =>
      comparisonRow(row.name, row.key === "formula" ? "" : `/${row.key}`, row)
    )
    .join("");

  const keyBody = keyRows.map((row) => comparisonRow(row.name, "", row)).join("");

  /*
   * The complete strings for both sides, plainly, before any comparison. The
   * layer and block diffs below answer "what moved"; these answer "what are
   * the two answers" — and they are what gets copied out, so they are whole,
   * unmarked and selectable in one run rather than reassembled from a diff.
   */
  const completeRows = [];
  const addCompleteRow = (label, html) => {
    if (!html) {
      return;
    }
    completeRows.push(
      `<div class="layer-key">${escapeHtml(label)}</div>` +
        `<div class="layer-value">${html}</div>`
    );
  };

  /*
   * The layers that moved, marked inside the complete strings themselves, so
   * the whole identifier stays readable and copyable while still showing where
   * the two versions parted company. markChangedLayers only wraps the text; a
   * self-check in inchi-layers.js asserts the string survives untouched.
   */
  const changedKeys = new Set(changed.map((row) => row.key));
  const changedKeyBlocks = new Set(
    keyRows.reduce(
      (indices, row, index) =>
        row.status === "same" ? indices : [...indices, index],
      []
    )
  );

  addCompleteRow(
    "Pinned InChI",
    pinned.inchi ? markChangedLayers(pinned.inchi, changedKeys) : ""
  );
  addCompleteRow(
    "Pinned key",
    pinned.inchikey
      ? markChangedKeyBlocks(pinned.inchikey, changedKeyBlocks)
      : ""
  );
  if (current) {
    addCompleteRow(
      "Current InChI",
      current.inchi ? markChangedLayers(current.inchi, changedKeys) : ""
    );
    addCompleteRow(
      "Current key",
      current.inchikey
        ? markChangedKeyBlocks(current.inchikey, changedKeyBlocks)
        : ""
    );
  }
  const completeBody = completeRows.join("");

  const summary = !current
    ? `Pinned ${escapeHtml(pinned.version)}. Convert again to compare.`
    : pinned.inchi === current.inchi
      ? `${left} and ${right} produce an identical InChI` +
        (sameVersion ? " with these options." : ".")
      : `${changed.length} of ${rows.length} layers differ between ` +
        `${left} and ${right}` +
        (keyRows.length === 0
          ? "."
          : keyChanged.length === 0
            ? ", and the InChIKey is unchanged."
            : `, and ${keyChanged.length} of ${keyRows.length} InChIKey ` +
              `blocks with it.`);

  /*
   * The stamp collapses when both sides are the same version, so it agrees
   * with the summary sentence instead of reading "1.07.5 to 1.07.5".
   */
  const stamp = sameVersion
    ? `${escapeHtml(pinned.version)}, options differ`
    : `${escapeHtml(pinned.version)} to ${
        current ? escapeHtml(current.version) : "-"
      }`;
  host.innerHTML =
    `<div class="comparison-plate notation-frame">
      <div class="identifier-head">
        <span class="apparatus">Comparison</span>
        <span class="version-stamp">${stamp}</span>
      </div>
      <p class="comparison-summary">${summary}</p>` +
    (completeBody === ""
      ? ""
      : `<h3 class="comparison-subhead apparatus">Complete strings</h3>` +
        `<div class="identifier-layers">${completeBody}</div>`) +
    (body === ""
      ? ""
      : `<h3 class="comparison-subhead apparatus">InChI layers</h3>` +
        `<div class="comparison-layers">${comparisonHead}${body}</div>`) +
    (keyBody === ""
      ? ""
      : `<h3 class="comparison-subhead apparatus">InChIKey blocks</h3>` +
        `<div class="comparison-layers">${comparisonHead}${keyBody}</div>`) +
    `</div>`;
  host.hidden = false;
}

/*
 * The status line: one place that says what just happened.
 *
 * The audit's worst finding was that a structure InChI cannot handle produced
 * four empty plates and a log whose entire content was the string
 * "InChI options:" — indistinguishable from an untouched page. Success was
 * equally unsignalled, so the only way to know a conversion had worked was
 * that text appeared.
 */
function setConversionStatus(paneId, kind, text) {
  const pane = document.getElementById(paneId);
  const status = pane?.querySelector("[data-status]");
  if (!status) {
    return;
  }

  /*
   * The announcement goes to a region that is never hidden and never moves.
   * The visible box below can hide itself freely; a hidden node is out of the
   * accessibility tree, and text written into one while it is hidden is not
   * reliably announced — which would have made this whole status line
   * invisible to exactly the users who most needed it.
   */
  const announcer = pane.querySelector("[data-status-announcer]");
  if (announcer) {
    announcer.textContent = kind ? text : "";
  }

  if (!kind) {
    status.hidden = true;
    status.replaceChildren();
    return;
  }
  status.className = `conversion-status mt-2 conversion-status-${kind}`;
  status.innerHTML =
    `<span class="conversion-status-mark">${notationMark(kind)}</span>` +
    `<span>${escapeHtml(text)}</span>`;
  status.hidden = false;
}

/* The pane a result field belongs to, so callers can keep passing element ids. */
function paneOf(elementId) {
  return document.getElementById(elementId)?.closest(".tab-pane")?.id ?? "";
}

/*
 * Stamp every result plate in a pane with the version that produced it.
 * "Provenance is part of the answer": a string copied out of here without its
 * version is not reproducible, and the selector 600px away is not provenance.
 */
function stampVersion(paneId, version) {
  document
    .getElementById(paneId)
    ?.querySelectorAll("inchi-result-field")
    .forEach((field) => field.setVersionStamp?.(version));
}

/*
 * Mark the results as superseded rather than deleting them.
 *
 * Switching version used to blank all four plates and then wait several
 * seconds on a cold ~1 MB WebAssembly module. Comparing versions is the whole
 * point of this tool, and the comparison baseline was destroyed at the exact
 * moment it was needed. The old answer now stays readable, dimmed and marked,
 * until the new one lands.
 */
function markResultsStale(paneId, isStale) {
  document
    .getElementById(paneId)
    ?.querySelectorAll("inchi-result-field")
    .forEach((field) => field.setStale?.(isStale));
}

/*
 * Count the options that differ from this version's defaults, so "Reset" is
 * not a button that discards seventeen settings with no preview.
 */
function updateChangedOptionCount(tabDivId) {
  const pane = document.getElementById(tabDivId);
  const counter = pane?.querySelector("[data-changed-count]");
  if (!counter) {
    return;
  }
  const inputs = pane.querySelectorAll("input.form-check-input");
  let changed = 0;
  inputs.forEach((input) => {
    if (input.checked !== input.hasAttribute("data-default-checked")) {
      changed++;
    }
  });
  counter.textContent =
    changed === 0 ? "" : `${changed} changed from default`;
  counter.hidden = changed === 0;
}

/*
 * Debounce, for the paste fields. Every keystroke in the molfile textarea used
 * to run a full WebAssembly conversion and reload the 3D structure.
 */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/*
 * Theme switch.
 *
 * Three states exist even though the control has two: an explicit "light", an
 * explicit "dark", and no choice at all — in which case the page follows the
 * system and keeps following it if the system changes mid-session. The switch
 * reports whichever theme is actually in force.
 *
 * The stored value is applied by a small inline script in index.html so the
 * page never paints in the wrong theme first; this only handles the control.
 */
const THEME_STORAGE_KEY = "inchi-theme";

function storedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    // Private mode or blocked storage: no stored choice, and none can be made.
    return null;
  }
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function effectiveTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") {
    return explicit;
  }
  return systemPrefersDark() ? "dark" : "light";
}

function syncThemeSwitch() {
  const button = document.querySelector("[data-theme-switch]");
  if (!button) {
    return;
  }
  const isDark = effectiveTheme() === "dark";
  button.setAttribute("aria-checked", String(isDark));
  const label = button.querySelector("[data-theme-switch-label]");
  if (label) {
    label.textContent = isDark ? "Dark" : "Light";
  }
}

function setupThemeSwitch() {
  const button = document.querySelector("[data-theme-switch]");
  if (!button) {
    return;
  }

  syncThemeSwitch();

  button.addEventListener("click", () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (error) {
      /*
       * The choice still applies to this page; it just will not outlive the
       * reload. Better than refusing to switch.
       */
      console.warn("The theme choice could not be saved.", error);
    }
    syncThemeSwitch();
  });

  /*
   * Keep following the system while the visitor has expressed no preference —
   * someone whose machine flips to dark at sunset should see this flip too.
   */
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (storedTheme() === null) {
        syncThemeSwitch();
      }
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupThemeSwitch);
} else {
  setupThemeSwitch();
}

/*
 * The width at which the tool grid stops being two columns.
 *
 * The InChI and RInChI panes are laid out with Bootstrap's col-xl-8/col-xl-4,
 * and `xl` is 1200px — so below this the editor, the options and the results
 * are one column. Anything that reasons about "is the layout stacked?" reads
 * this constant instead of hardcoding a width, because the two drifted apart
 * once already: the options panel checked 992px and opened itself expanded
 * across the whole 992-1199px band.
 *
 * css/index.css keys its own stacking rules to the same 1200px.
 */
const INCHI_STACK_BREAKPOINT = 1200;

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

  /*
   * One delegated listener rather than one per checkbox: the panel is rebuilt
   * on every version switch, and seventeen listeners would have to be rebuilt
   * with it.
   */
  targetDiv.addEventListener("change", () =>
    updateChangedOptionCount(tabDivId)
  );
  updateChangedOptionCount(tabDivId);
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

  updateChangedOptionCount(targetDivId);
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
  /*
   * The previous result is marked superseded rather than deleted: on a version
   * switch this is the answer the user is comparing against, and blanking it
   * before a cold WebAssembly load left them staring at four empty plates.
   */
  markResultsStale("inchi-tab1-pane", true);

  // collect user input
  const options = collectInchiOptions("inchi-tab1-pane");
  const inchiVersion = getVersion("inchi-tab1-pane");
  setConversionStatus(
    "inchi-tab1-pane",
    "busy",
    `Converting with InChI ${inchiVersion}…`
  );

  let molfile;
  const ketcher = getKetcher("inchi-tab1-ketcher");
  const clearTab1 = () =>
    writeResult(
      "",
      "inchi-tab1-inchi",
      "inchi-tab1-inchikey",
      "inchi-tab1-auxinfo",
      "inchi-tab1-logs"
    );
  if (!ketcher) {
    setConversionStatus(
      "inchi-tab1-pane",
      "error",
      "The structure editor is not ready yet. Please reload the page (CTRL + F5) if this persists."
    );
    writeResult(
      "The structure editor is not ready yet. Please reload the page (CTRL + F5) if this persists.",
      "inchi-tab1-logs",
    );
    return;
  } else if (ketcher.containsReaction()) {
    clearTab1();
    setConversionStatus(
      "inchi-tab1-pane",
      "error",
      "InChI describes single structures, not reactions. Switch to the RInChI tab to convert this reaction."
    );
    writeResult(
      "InChI describes single structures, not reactions. Switch to the RInChI tab to convert this reaction.",
      "inchi-tab1-logs"
    );
    return;
  } else if (ketcher.editor.struct().isBlank()) {
    // Nothing drawn: clear the plates and say nothing rather than report a failure.
    clearTab1();
    stampVersion("inchi-tab1-pane", "");
    setConversionStatus("inchi-tab1-pane", null);
    renderComparison("inchi-tab1-pane");
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

/*
 * Typing in the molfile box ran a full WebAssembly conversion and an NGL
 * structure reload on every keystroke. 250ms is below the threshold where a
 * pause feels like lag and above the rate anyone types molfile lines.
 */
const updateInchiTab2Debounced = debounce(() => updateInchiTab2(), 250);

async function updateInchiTab2() {
  markResultsStale("inchi-tab2-pane", true);

  // collect user input
  const molfile = document.getElementById("inchi-tab2-molfile").value;
  const options = collectInchiOptions("inchi-tab2-pane");
  const inchiVersion = getVersion("inchi-tab2-pane");

  // An empty box is not a failure: clear the plates and stay quiet.
  if (molfile.trim() === "") {
    writeResult(
      "",
      "inchi-tab2-inchi",
      "inchi-tab2-inchikey",
      "inchi-tab2-auxinfo",
      "inchi-tab2-logs"
    );
    stampVersion("inchi-tab2-pane", "");
    setConversionStatus("inchi-tab2-pane", null);
    renderComparison("inchi-tab2-pane");
    return;
  }

  setConversionStatus(
    "inchi-tab2-pane",
    "busy",
    `Converting with InChI ${inchiVersion}…`
  );

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
  /*
   * Say which version is loading, before the wait rather than after it. Every
   * non-default version is a cold ~1 MB WebAssembly fetch and compile, because
   * warmUp() only prefetches the default one — several seconds during which
   * the old UI showed nothing at all.
   */
  setConversionStatus(
    tabDivId,
    "busy",
    `Loading InChI ${getVersion(tabDivId)}…`
  );
  markResultsStale(tabDivId, true);

  await addInchiOptionsForm(tabDivId, () => updateFunction());
  const optionsState = getInchiOptionsState(tabDivId);
  applyInchiOptionsState(tabDivId, optionsState);
  updateChangedOptionCount(tabDivId);

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
  const paneId = paneOf(inchiTextElementId);
  const log_entries = [];
  /*
   * Never a bare label: an empty options set says so in words. This line read
   * "InChI options:" with nothing after it on every default-options run, which
   * was the entire content of the log on a successful conversion.
   */
  log_entries.push(`InChI options: ${options === "" ? "(defaults)" : options}`);

  let inchiResult;
  try {
    inchiResult = await inchiFromMolfile(molfile, options, inchiVersion);
  } catch (e) {
    setConversionStatus(
      paneId,
      "error",
      `The InChI library could not process this structure. It reported: ${e}`
    );
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
  stampVersion(paneId, inchiVersion);
  markResultsStale(paneId, false);
  renderComparison(paneId);

  if (log !== "") {
    log_entries.push(log);
  }

  /*
   * The outcome, in one line, always. return_code -1 is a refusal; an empty
   * InChI with a zero return code is the same refusal without a diagnosis,
   * which is the case that used to fall through completely silently.
   */
  if (inchi === "") {
    const detail =
      log !== ""
        ? log.split("\n")[0]
        : "The InChI library returned no diagnostic for this input.";
    setConversionStatus(
      paneId,
      "error",
      `No InChI generated by ${inchiVersion} (code ${return_code}). ${detail}`
    );
  } else {
    const optionSummary =
      options === "" ? "default options" : `options ${options}`;
    setConversionStatus(
      paneId,
      "ok",
      `Converted with InChI ${inchiVersion}, ${optionSummary}.` +
        (log !== "" ? " The library reported warnings; see the log." : "")
    );
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
