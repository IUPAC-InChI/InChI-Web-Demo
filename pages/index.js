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
  window.addEventListener("load", () =>
    idle(() => {
      warmDefaultInchiVersion();
      /*
       * The 3D viewer is on the surface from the first paint, so it is warmed
       * here. The RInChI module is NOT: pages/rinchi is 1.6 MB, four times the
       * vendor weight this whole change removes, and most visits never draw a
       * reaction. updateWorkbench starts that fetch on the first reaction
       * instead, which is still ahead of the await inside the conversion.
       */
      warm(document.querySelector("inchi-ngl-viewer")?.ensureStage());
    })
  );

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
 * One surface, so one pinned result rather than a map keyed by pane.
 */
let pinnedResult = null;

function currentResultFor() {
  const text =
    document.getElementById("workbench-inchi")?.textContent.trim() ?? "";
  if (!text.startsWith("InChI=")) {
    return null;
  }
  /*
   * A version name should always be there, but an empty one would leave a hole
   * in the middle of a sentence ("3 of 7 layers differ between and Dev"), so
   * it degrades to something readable rather than to nothing.
   */
  const version = getVersion() || "an unnamed version";
  /*
   * The key is pinned with the InChI it came from. It is the thing most people
   * actually paste into a database or a paper, so a comparison that comes back
   * with only the InChI leaves out the half the user is going to use.
   */
  const inchikey =
    document.getElementById("workbench-inchikey")?.textContent.trim() ?? "";
  return { version, inchi: text, inchikey };
}

function pinCurrentResult() {
  const current = currentResultFor();
  if (current === null) {
    setConversionStatus(
      "error",
      "Nothing to pin yet - convert a structure first."
    );
    return;
  }
  pinnedResult = current;
  renderComparison();
}

function clearComparison() {
  pinnedResult = null;
  renderComparison();
}

/*
 * Enable each comparison control only when it has something to act on: you
 * cannot pin an empty result, and there is nothing to clear until you have.
 */
function updateComparisonControls() {
  const pinButton = document.querySelector("[data-pin]");
  const clearButton = document.querySelector("[data-clear-comparison]");
  if (pinButton) {
    pinButton.disabled = currentResultFor() === null;
  }
  if (clearButton) {
    clearButton.disabled = pinnedResult === null;
  }
}

function renderComparison() {
  const host = document.querySelector("[data-comparison]");
  updateComparisonControls();
  if (!host) {
    return;
  }

  const pinned = pinnedResult;
  const current = currentResultFor();

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
function setConversionStatus(kind, text) {
  const status = document.querySelector("[data-status]");
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
  const announcer = document.querySelector("[data-status-announcer]");
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

/*
 * Stamp every result plate in a pane with the version that produced it.
 * "Provenance is part of the answer": a string copied out of here without its
 * version is not reproducible, and the selector 600px away is not provenance.
 */
function stampVersion(version) {
  /*
   * Scoped to the molecule block, not the document. The InChI version has no
   * business on the six RInChI plates — setVersionStamp shows the stamp
   * whenever the plate has text, so a stray one would surface the next time a
   * reaction was drawn.
   */
  document
    .querySelectorAll('[data-output="inchi"] inchi-result-field')
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
function markResultsStale(isStale) {
  /* Scoped like stampVersion, and for the same reason. */
  document
    .querySelectorAll('[data-output="inchi"] inchi-result-field')
    .forEach((field) => field.setStale?.(isStale));
}

/*
 * Count the options that differ from this version's defaults, so "Reset" is
 * not a button that discards seventeen settings with no preview.
 */
function updateChangedOptionCount() {
  const panel = optionsPanel();
  const counter = panel?.querySelector("[data-changed-count]");
  if (!counter) {
    return;
  }
  const inputs = panel.querySelectorAll("input.form-check-input");
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
 * Easter egg. Typing "3270" outside a field opens the same tool rendered as an
 * IBM 3270 green-screen panel (retro.html).
 *
 * Matched only outside inputs and the paste areas: a molfile is full of digits
 * and would trip the sequence while someone was pasting one. Keys longer than
 * one character (Shift, Tab, arrows) are ignored rather than treated as a
 * mismatch, so holding Shift for a moment does not break the run.
 */
const RETRO_SEQUENCE = "3270";

function setupRetroEasterEgg() {
  let typed = "";

  const onKeydown = (event) => {
    if (event.key.length !== 1) {
      return;
    }

    /*
     * Duck-typed rather than `instanceof Element`: this handler also runs on
     * the editor's document, and an element from another frame fails an
     * instanceof against this realm's constructor — which would have made the
     * in-a-field guard silently useless there.
     */
    const target = event.target;
    const inField =
      typeof target?.matches === "function" &&
      target.matches("input, textarea, select, [contenteditable]");

    if (event.metaKey || event.ctrlKey || event.altKey || inField) {
      typed = "";
      return;
    }

    typed = (typed + event.key).slice(-RETRO_SEQUENCE.length);
    if (typed === RETRO_SEQUENCE) {
      typed = "";
      window.location.href = "retro.html";
    }
  };

  /*
   * Capture phase, so nothing on the page can swallow the run before it is
   * seen — Ketcher treats bare keys as hotkeys and stops their propagation.
   */
  document.addEventListener("keydown", onKeydown, true);

  /*
   * Ketcher takes focus the moment it mounts, so keystrokes land in its
   * iframe's document and never reach this one: without hooking the frames
   * the sequence is unreachable whenever an editor is on screen. They are
   * same-origin, so the listener goes on their documents directly.
   *
   * One capture-phase "load" listener rather than a poll per frame, because
   * "load" does not bubble but is still visible during capture — and the three
   * editor iframes are added by the tab components long after this runs.
   */
  const hookFrame = (frame) => {
    try {
      frame.contentDocument?.addEventListener("keydown", onKeydown, true);
    } catch {
      // A cross-origin frame has no reachable document; nothing to hook.
    }
  };

  document.addEventListener(
    "load",
    (event) => {
      if (event.target instanceof HTMLIFrameElement) {
        hookFrame(event.target);
      }
    },
    true
  );

  // Anything already loaded before this ran.
  document.querySelectorAll("iframe").forEach(hookFrame);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupRetroEasterEgg);
} else {
  setupRetroEasterEgg();
}

/*
 * The width at which a tool pane stops being one column.
 *
 * Every pane is a .tool-workbench grid of three children — input, controls,
 * output. Below this width they stack; at this width the input and the
 * controls share a row and the output runs full width beneath them.
 *
 * Anything that reasons about "is the layout stacked?" reads this constant
 * instead of hardcoding a width, because the two drifted apart once already:
 * the options panel checked 992px against a grid that stacked below 1200px
 * and opened itself expanded across the whole 992-1199px band.
 *
 * css/index.css keys its own stacking rules to the same 1200px. It carries a
 * second, CSS-only width — 1400px — at which the output moves *beside* the
 * input rather than beneath it. Nothing in JavaScript depends on that one, so
 * it is not mirrored here; .tool-workbench in css/index.css documents it.
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

async function addInchiOptionsForm(updateFunction) {
  await window.inchiVersionsReady;
  const inchiVersion = getVersion();
  const inchiOptions = document.createElement(
    availableInchiVersions[inchiVersion].optionsTemplateId
  );
  await inchiOptions.postCreate(updateFunction, inchiVersion);

  const targetDiv = optionsPanel();
  targetDiv.innerHTML = ""; // Remove previous options
  targetDiv.appendChild(inchiOptions); // Add current options

  /*
   * One delegated listener rather than one per checkbox: the panel is rebuilt
   * on every version switch, and seventeen listeners would have to be rebuilt
   * with it.
   *
   * Bound once: targetDiv outlives every rebuild, so re-adding it on each
   * version switch stacked duplicate listeners on the same node.
   */
  if (!targetDiv.dataset.changeListenerBound) {
    targetDiv.addEventListener("change", () => updateChangedOptionCount());
    targetDiv.dataset.changeListenerBound = "true";
  }
  updateChangedOptionCount();
}

/*
 * Restore this version's defaults, which is not the same as clearing the
 * panel: an option marked data-default-checked is checked *on*.
 *
 * Takes the element to search. These used to take a tab id, from when there
 * were eight option panels; there is one after the surface is collapsed.
 */
function resetInchiOptions(root) {
  root
    .querySelectorAll("input.form-check-input[data-default-checked]")
    .forEach((input) => {
      input.checked = true;
    });

  root
    .querySelectorAll("input.form-check-input:not([data-default-checked])")
    .forEach((input) => {
      input.checked = false;
    });

  root
    .querySelectorAll("input.form-check-input[data-default-disabled]")
    .forEach((input) => {
      input.disabled = true;
    });

  root
    .querySelectorAll("input.form-check-input:not([data-default-disabled])")
    .forEach((input) => {
      input.disabled = false;
    });
}

/*
 * Read the option checkboxes back as command-line flags.
 *
 * `:enabled` is not a lie: a disabled sub-option keeps its checked state, and
 * reading it would send the library flags the visitor cannot see.
 *
 * Takes the element to search, like the rest of these.
 */
function getInchiOptions(root) {
  const options = [];

  root
    .querySelectorAll(
      "input.form-check-input:enabled[data-inchi-option-on]:checked"
    )
    .forEach((input) => {
      options.push(input.dataset.inchiOptionOn);
    });

  root
    .querySelectorAll(
      "input.form-check-input:enabled[data-inchi-option-off]:not(:checked)"
    )
    .forEach((input) => {
      options.push(input.dataset.inchiOptionOff);
    });

  return options;
}

function collectInchiOptions(root) {
  return getInchiOptions(root)
    .map((o) => "-" + o)
    .join(" ");
}

function getVersion() {
  return document.querySelector("select[data-version]").value;
}

/*
 * The one options panel. A function rather than a stored reference: the panel
 * is rebuilt on every version change, so a captured one goes stale.
 */
function optionsPanel() {
  return document.querySelector("div[data-inchi-options]");
}

/*
 * Snapshot the panel, so a version switch can put the visitor's settings back
 * into the panel the new version builds.
 */
function getInchiOptionsState(root) {
  const optionsState = {};

  root.querySelectorAll("input[data-id]").forEach((input) => {
    optionsState[input.dataset.id] = [input.checked, input.disabled];
  });

  return optionsState;
}

/*
 * Put a snapshot back. Applied by `data-id`, so an option the newly selected
 * version does not have is simply absent and the new panel's own default
 * stands.
 */
function applyInchiOptionsState(root, optionsState) {
  Object.entries(optionsState).forEach(([k, v]) => {
    const input = root.querySelector(`input[data-id="${k}"]`);
    if (!input) {
      return; // An option this version does not have; its own default stands.
    }
    input.checked = v[0];
    input.disabled = v[1];
  });
}

/*
 * Update actions (when user changes inputs/options/(R)InChI version)
 */
/*
 * The one conversion path.
 *
 * Called by every input: drawing in the editor, pasting into the field,
 * changing an option, changing the version. What the editor holds decides
 * which identifier is produced — a molecule yields an InChI, a reaction
 * yields a RInChI — so there is no mode for the visitor to set and no way
 * for the app to be showing the wrong one.
 */
async function updateWorkbench() {
  const ketcher = getKetcher("workbench-ketcher");
  if (!ketcher) {
    setConversionStatus(
      "error",
      "The structure editor is not ready yet. Please reload the page (CTRL + F5) if this persists."
    );
    return;
  }

  /*
   * A paste is converted verbatim, so this branch does not consult the editor
   * at all — not even for whether it is blank. A file the editor cannot draw
   * still has an InChI, and that is the answer being asked for.
   */
  if (conversionSource === "paste") {
    markResultsStale(true);
    markSdfRecordsStale();
    await convertPastedInput();
    return;
  }

  if (ketcher.editor.struct().isBlank()) {
    /*
     * Nothing drawn is not a failure: clear the plates and say nothing. The
     * placeholders in the result fields already name what will appear.
     */
    clearWorkbenchResults();
    stampVersion("");
    setConversionStatus(null);
    renderComparison();
    return;
  }

  /*
   * Superseded, not deleted. On a version switch this is the answer the
   * visitor is comparing against, and blanking it before a cold ~1 MB
   * WebAssembly load left them staring at empty plates.
   */
  markResultsStale(true);

  /*
   * Whatever happens below, the record list is judged against the settings in
   * force now — a version or option change reaches it here.
   */
  markSdfRecordsStale();

  if (ketcher.containsReaction()) {
    showOutput("rinchi");
    /* First reaction of the visit: start the 1.6 MB RInChI fetch before the
     * conversion awaits it. Idempotent — loadScriptOnce caches the promise. */
    rinchiModule();
    await convertReactionFromKetcher(ketcher);
  } else {
    showOutput("inchi");
    await convertMoleculeFromKetcher(ketcher);
  }
}

/*
 * Convert the pasted text itself.
 *
 * Each notation goes to the library that reads it, in the form it was given:
 * a molfile and an SD record as molfile text, an RXN *and an RD file* as
 * reaction file text (the RInChI library reads both, which is why the RD
 * header no longer has to be sliced off), an AuxInfo through the molfile the
 * library builds from it, and a RInChI as itself — its keys are derived from
 * the pasted string rather than from a reaction redrawn out of it.
 */
async function convertPastedInput() {
  const options = collectInchiOptions(optionsPanel());
  const inchiVersion = getVersion();

  switch (pastedInput.kind) {
    case "molfile":
    case "sdf":
    case "auxinfo": {
      showOutput("inchi");

      let molfile;
      if (pastedInput.kind === "sdf") {
        molfile = firstSdfRecord(pastedInput.text);
      } else if (pastedInput.kind === "auxinfo") {
        /*
         * An AuxInfo is not molfile text, so the library rebuilds one from it
         * — which is also what the preview draws, and it keeps the z
         * coordinates Ketcher would rescale. Derived here rather than in the
         * preview step, because the answer must not depend on the editor.
         */
        const { molfile: rebuilt, log, message } = await molfileFromAuxinfo(
          pastedInput.text.trim(),
          0,
          0,
          inchiVersion
        );
        if (!rebuilt) {
          const detail = [log, message].filter((part) => part).join(" ");
          setConversionStatus(
            "error",
            `This AuxInfo could not be turned into a structure.${
              detail ? ` The library reported: ${detail}` : ""
            }`
          );
          return;
        }
        pastedInput.molfile = rebuilt;
        molfile = rebuilt;
      } else {
        molfile = pastedInput.text;
      }

      if (!molfile) {
        return;
      }
      setConversionStatus("busy", `Converting ${sourceLabel()} with InChI ${inchiVersion}…`);
      const [inchi, auxinfo] = await convertMolfileToInchiAndWriteResults(
        molfile,
        options,
        inchiVersion,
        "workbench-inchi",
        "workbench-inchikey",
        "workbench-auxinfo",
        "workbench-logs"
      );
      document
        .getElementById("workbench-ngl-viewer")
        .loadStructure(molfile, inchi, auxinfo);
      return;
    }

    case "rxnfile":
    case "rdfile": {
      showOutput("rinchi");
      rinchiModule();
      setConversionStatus("busy", `Converting ${sourceLabel()} to a RInChI…`);
      clearRinchiResults();
      await convertRxnfileToRinchiAndWriteResults(
        pastedInput.text,
        document.getElementById("workbench-forceequilibrium").checked,
        "workbench-rinchi",
        "workbench-longrinchikey",
        "workbench-shortrinchikey",
        "workbench-webrinchikey",
        "workbench-rauxinfo",
        "workbench-rinchi-logs"
      );
      reportRinchiOutcome();
      return;
    }

    case "rinchi": {
      showOutput("rinchi");
      rinchiModule();
      setConversionStatus("busy", "Deriving the keys from the pasted RInChI…");
      clearRinchiResults();
      /*
       * The RInChI *is* the input, so it is written through unchanged and only
       * its keys are derived. Round-tripping it through the editor was the one
       * way this surface could hand back a different RInChI than it was given.
       */
      writeResult(pastedInput.rinchi, "workbench-rinchi");
      writeResult(pastedInput.rauxinfo ?? "", "workbench-rauxinfo");

      const log = [];
      await Promise.all(
        ["Long", "Short", "Web"].map((keyType) =>
          convertRinchiToRinchikeyAndWriteResult(
            pastedInput.rinchi,
            keyType,
            `workbench-${keyType.toLowerCase()}rinchikey`,
            log
          )
        )
      );
      writeResult(log.join("\n"), "workbench-rinchi-logs");
      reportRinchiOutcome();

      /*
       * The reaction file the preview will draw. Built here, after the keys,
       * because it is a library call like they are — waiting on the library is
       * fine, waiting on the *editor* is what must never gate an answer. A
       * failure to rebuild costs the drawing, not the keys.
       */
      try {
        const rebuilt = await fileTextFromRinchi(
          pastedInput.rinchi,
          pastedInput.rauxinfo ?? "",
          "RXN"
        );
        pastedInput.rxnfile = rebuilt.fileText || null;
      } catch (error) {
        console.error("Rebuilding the reaction for preview failed", error);
        pastedInput.rxnfile = null;
      }
      return;
    }
  }
}

/*
 * A paste ran a full WebAssembly conversion and a 3D reload on every
 * keystroke. 250ms is below the threshold where a pause feels like lag and
 * above the rate anyone types molfile lines.
 */
const loadPastedInputDebounced = debounce(() => loadPastedInput(), 250);

/*
 * What the conversion reads: "editor" or "paste".
 *
 * Pasted text is converted *verbatim* and the editor shows it as a preview.
 * This is the point of the tool — an InChI generated here has to be the one
 * the library gives for that exact file, and routing a paste through a 2D
 * editor normalised it on the way: V3000 downgraded to V2000, coordinates
 * rescaled, hydrogens re-expressed per Ketcher's settings. A bug living in
 * the file was unreproducible, and the answer could differ from what the
 * InChI command-line tool gives for the same input.
 *
 * The editor stays fully editable. Touching it makes it the source again —
 * that edit is a newer intent than the paste — and the status line names the
 * side every answer came from, so the handover is never silent.
 */
let conversionSource = "editor";
let pastedInput = { text: "", kind: "", label: "" };

/*
 * Ketcher's serialization immediately after a programmatic load, and a guard
 * around the load itself. setMolecule() dispatches the editor's own `change`
 * event, so without these a preview would be indistinguishable from a user
 * edit and the source would flip back the instant it was shown.
 */
let editorBaseline = null;
let loadingIntoEditor = false;

/*
 * Every change the editor reports, filtered.
 *
 * A programmatic load is not an edit: whatever caused it converts on its own
 * terms. A real edit while a paste is in force hands the source back to the
 * editor, because the visitor has just expressed a newer intent.
 */
async function onEditorChanged() {
  if (loadingIntoEditor) {
    return;
  }

  if (conversionSource === "paste") {
    const ketcher = getKetcher("workbench-ketcher");
    const now = ketcher ? await getMolfileFromKetcher(ketcher, "v2000") : null;
    if (now !== editorBaseline) {
      conversionSource = "editor";
      syncSourceNotes();
    }
  }

  await updateWorkbench();
}

/*
 * Say which side is the source, on whichever side is not obvious.
 *
 * Two notes, and both are needed. While a paste is in force the editor is
 * only drawing it and says so. When the source has gone back to the editor
 * but the field still holds convertible text — after an edit, or after
 * Ketcher's own clear-canvas button — that text is inert, and saying nothing
 * leaves a field full of molfile beside an empty answer with no explanation.
 * An editor that silently stopped being what gets converted, or a paste field
 * that silently stopped being read, is the exact ambiguity this surface
 * exists to remove.
 */
function syncSourceNotes() {
  const editorNote = document.querySelector("[data-editor-role]");
  const pasteNote = document.querySelector("[data-paste-state]");

  if (editorNote) {
    if (conversionSource === "paste") {
      editorNote.textContent =
        `Previewing ${pastedInput.label} — that text is what gets converted. ` +
        `Edit here to convert the drawing instead.`;
      editorNote.hidden = false;
    } else {
      editorNote.hidden = true;
      editorNote.textContent = "";
    }
  }

  if (pasteNote) {
    /*
     * Only for text that *could* be converted. Unconvertible text already has
     * the status line explaining itself, and offering to convert it again
     * would be offering something that cannot work.
     */
    const field = document.getElementById("workbench-paste");
    const format = field ? detectInputFormat(field.value) : null;
    /*
     * A PubChem identifier counts: it is not convertible on its own, but the
     * button offers to look it up again, which does produce an answer.
     */
    const idle =
      conversionSource === "editor" &&
      format !== null &&
      (format.convertible || format.kind === "pubchem");
    pasteNote.hidden = !idle;
  }
}

/* What the status line calls the thing it just converted. */
function sourceLabel() {
  if (conversionSource !== "paste") {
    return "the drawn structure";
  }
  /*
   * A record fetched from PubChem was never pasted, and calling it "the
   * pasted SD file text" would hide where the structure came from. Every
   * other answer on this surface is derived from bytes the visitor supplied;
   * this one is not, and the status line has to say so.
   */
  return (
    pastedInput.provenance ??
    `the pasted ${pastedInput.label.replace(/^an? /, "")}`
  );
}

/*
 * PubChem's PUG REST, which serves a record as SD file text at a URL built
 * from the namespace and the number. The two namespaces are separate: SID
 * 2244 and CID 2244 are unrelated records, which is why detectInputFormat
 * insists on the prefix rather than guessing.
 */
async function fetchPubchemRecord(namespace, id) {
  const collection = namespace === "sid" ? "substance" : "compound";
  const url =
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/${collection}/${namespace}/` +
    `${encodeURIComponent(id)}/SDF`;

  const response = await fetch(url);
  const text = await response.text();

  /*
   * PUG REST explains its own refusals in the body, in more use than the
   * status line does — a missing record is a 404 whose Detail names the
   * identifier ("No record data for SID 999999999"), and an out-of-range
   * number is a 400 saying so. Reporting "404 Not Found" instead would throw
   * away the only sentence the visitor can act on.
   */
  if (!response.ok) {
    const reported = /^(?:Detail|Message):\s*(.+)$/m.exec(text);
    throw new Error(
      reported
        ? `PubChem said: ${reported[1].trim()}`
        : `PubChem answered ${response.status} ${response.statusText}.`
    );
  }
  if (!text.trim()) {
    throw new Error(
      `PubChem returned an empty record for ${namespace.toUpperCase()} ${id}.`
    );
  }
  return text;
}

/*
 * Discards the answer to a lookup the visitor has already typed past.
 *
 * The paste field converts as you type, so "SID 2244" can put four requests
 * in flight and they need not come back in order. Without this, a slow reply
 * to "SID 2" could land after the reply to "SID 2244" and quietly replace a
 * correct answer with the wrong substance.
 */
let pubchemRequest = 0;

/*
 * Take whatever is in the paste field into the editor.
 *
 * Everything here ends in the same place — a structure in Ketcher — so the
 * conversion that follows does not know or care how the structure arrived.
 * The three formats that are not structures (a bare InChI, a lone RAuxInfo,
 * unrecognised text) are refused by name in the status line, which is the
 * part the old tabs could not do: pasting a molfile into the AuxInfo tab
 * silently did nothing.
 */
async function loadPastedInput() {
  const text = document.getElementById("workbench-paste").value;
  const format = detectInputFormat(text);
  const ketcher = getKetcher("workbench-ketcher");

  if (format.kind === "empty") {
    /*
     * Clearing the field hands the source back to the editor but does not
     * clear it: the structure may have been edited since it was pasted, and
     * throwing that away because the visitor tidied the box is destructive.
     */
    pastedInput = { text: "", kind: "", label: "" };
    conversionSource = "editor";
    syncSourceNotes();
    await updateWorkbench();
    return;
  }

  /*
   * A PubChem identifier is a pointer, not a structure, so it is resolved
   * here and the record that comes back re-enters as ordinary SD file text.
   * Everything downstream — the conversion, the preview, the record list —
   * then treats it exactly like a pasted SD file, because that is what it is.
   */
  if (format.kind === "pubchem") {
    const generation = ++pubchemRequest;
    const name = `${format.namespace.toUpperCase()} ${format.id}`;
    setConversionStatus("busy", `Fetching ${name} from PubChem…`);

    let record;
    try {
      record = await fetchPubchemRecord(format.namespace, format.id);
    } catch (error) {
      if (generation !== pubchemRequest) {
        return;
      }
      pastedInput = { text: "", kind: "", label: "" };
      conversionSource = "editor";
      syncSourceNotes();
      setConversionStatus(
        "error",
        `${name} could not be fetched. ${error.message ?? error}`
      );
      return;
    }
    if (generation !== pubchemRequest) {
      return;
    }

    pastedInput = {
      text: record,
      kind: "sdf",
      label: "SD file text",
      provenance: `the record PubChem returned for ${name}`,
    };
    conversionSource = "paste";
    syncSourceNotes();
    await updateWorkbench();
    await previewPastedInput(ketcher, pastedInput.label);
    return;
  }

  if (!format.convertible) {
    /*
     * Not a structure, so it cannot be the source — and neither can whatever
     * was pasted before it. Leaving the previous paste in force would show an
     * answer derived from text the field no longer contains, which is exactly
     * the field-and-answer disagreement this design removes. The editor takes
     * over; it still holds the last preview, and the status line says why.
     */
    pastedInput = { text: "", kind: "", label: "" };
    conversionSource = "editor";
    syncSourceNotes();
    await updateWorkbench();
    setConversionStatus("error", `This looks like ${format.label}. ${format.reason}`);
    return;
  }

  pastedInput = { text, kind: format.kind, label: format.label };
  if (format.kind === "rinchi") {
    const paired = splitRinchiPaste(text);
    pastedInput.rinchi = paired.rinchi;
    pastedInput.rauxinfo = paired.rauxinfo;
  }
  conversionSource = "paste";
  syncSourceNotes();

  /*
   * Convert FIRST, draw SECOND — and this order is the whole point.
   *
   * These bytes are converted verbatim by a library that has never heard of
   * the editor, so the answer must not wait on the editor to render them.
   * It did, once: the conversion was sequenced after `setMolecule` resolved,
   * and a structure that drew correctly but whose promise settled late left
   * the output stuck on "Reading a molfile…" with the answer already
   * computable. The preview is a convenience; the identifier is the product.
   */
  await updateWorkbench();
  await previewPastedInput(ketcher, format.label);
}

/*
 * Draw whatever is currently the pasted input, after it has been converted.
 *
 * Split out because a PubChem lookup reaches this point too, by a different
 * route and under a different name — `label` is what a failure to draw calls
 * the thing, and for a fetched record that is not the text in the field.
 */
async function previewPastedInput(ketcher, label) {
  if (!ketcher) {
    /* No editor to preview in. The identifiers above are already correct. */
    return;
  }

  /*
   * Now the preview. Guarded, because setMolecule dispatches `change` and an
   * unguarded one would look like a user edit and hand the source straight
   * back to the editor. Raced against a timeout, because a preview that never
   * arrives must not leave the guard raised — that would make every later
   * edit invisible to the surface.
   */
  const drawable = previewTextFor(pastedInput);
  if (drawable === null) {
    return;
  }

  let previewFailed = "";
  loadingIntoEditor = true;
  try {
    await Promise.race([
      ketcher.setMolecule(drawable),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("the editor did not respond")), 15000)
      ),
    ]);
  } catch (error) {
    console.error("Drawing the pasted input failed", error);
    previewFailed = `${label} was converted, but the editor could not draw it: ${
      error.message ?? error
    }`;
  } finally {
    loadingIntoEditor = false;
  }

  /*
   * The preview's serialization, so a later `change` can be told apart from
   * this load. Read after the guard is lifted and before any user edit.
   */
  editorBaseline = await getMolfileFromKetcher(ketcher, "v2000");

  /*
   * Reported after the conversion, so it cannot overwrite the answer's own
   * status — and phrased so it is clear the identifiers still stand.
   */
  if (previewFailed) {
    setConversionStatus("error", previewFailed);
  }
}

/*
 * The text to draw as a preview, which is not always the text that was
 * converted: an AuxInfo is drawn from the molfile the library rebuilt out of
 * it, a RInChI from a reaction file rebuilt out of it, an RD file from the
 * $RXN it embeds (Ketcher has no RD parser, though the RInChI library does).
 * null means there is nothing to draw, which is not an error.
 */
function previewTextFor(input) {
  switch (input.kind) {
    case "molfile":
    case "rxnfile":
      return input.text;
    case "rdfile":
      return input.text.slice(input.text.indexOf("$RXN"));
    case "sdf":
      return firstSdfRecord(input.text);
    case "auxinfo":
      return input.molfile ?? null;
    case "rinchi":
      return input.rxnfile ?? null;
    default:
      return null;
  }
}

/*
 * The first record of pasted SD file text. getSDFDelimiter handles all three
 * line-ending conventions; a single record often has no terminator at all,
 * in which case the whole text is the record.
 */
function firstSdfRecord(sdfText) {
  const delimiter = getSDFDelimiter(sdfText);
  return delimiter ? sdfText.split(delimiter)[0] : sdfText;
}

/*
 * Both output blocks stay in the DOM with their content intact, so drawing a
 * reaction arrow and then deleting it does not re-run a conversion to get
 * the InChI back.
 */
function showOutput(kind) {
  document.querySelectorAll("[data-output]").forEach((block) => {
    block.hidden = block.dataset.output !== kind;
  });
}

function clearWorkbenchResults() {
  writeResult(
    "",
    "workbench-inchi",
    "workbench-inchikey",
    "workbench-auxinfo",
    "workbench-logs",
    "workbench-rinchi",
    "workbench-longrinchikey",
    "workbench-shortrinchikey",
    "workbench-webrinchikey",
    "workbench-rauxinfo",
    "workbench-rinchi-logs"
  );
}

async function convertMoleculeFromKetcher(ketcher) {
  const options = collectInchiOptions(optionsPanel());
  const inchiVersion = getVersion();
  setConversionStatus("busy", `Converting with InChI ${inchiVersion}…`);

  /*
   * Serialization goes through getMolfileFromKetcher, which uses Ketcher's
   * own formatterFactory rather than Indigo. The format comes from
   * VERSION_BEHAVIOR, not a version-name comparison; v2000 is what every
   * version but Enhanced Stereochemistry wants.
   */
  const molfileFormat = versionBehavior(inchiVersion).molfileFormat ?? "v2000";
  const molfile = await getMolfileFromKetcher(ketcher, molfileFormat);
  if (molfile === null) {
    setConversionStatus(
      "error",
      "The structure editor could not hand over this structure. Please reload the page (CTRL + F5) if this persists."
    );
    return;
  }

  const [inchi, auxinfo] = await convertMolfileToInchiAndWriteResults(
    molfile,
    options,
    inchiVersion,
    "workbench-inchi",
    "workbench-inchikey",
    "workbench-auxinfo",
    "workbench-logs"
  );

  document
    .getElementById("workbench-ngl-viewer")
    .loadStructure(molfile, inchi, auxinfo);
}

/*
 * Cleared before every reaction conversion, unlike the InChI path.
 * convertRxnfileToRinchiAndWriteResults writes only the log when
 * rinchiFromRxnfile throws, so a previous reaction's RInChI would survive the
 * failure — and the outcome check below would then read it as success.
 */
function clearRinchiResults() {
  writeResult(
    "",
    "workbench-rinchi",
    "workbench-longrinchikey",
    "workbench-shortrinchikey",
    "workbench-webrinchikey",
    "workbench-rauxinfo",
    "workbench-rinchi-logs"
  );
}

/*
 * RInChI has no version selector of its own — there is one build — so the
 * status line reports the outcome rather than a version. The build itself is
 * named beside the results, written once when the workbench connects.
 */
function reportRinchiOutcome() {
  const rinchi = document.getElementById("workbench-rinchi").textContent.trim();
  const ok = rinchi.startsWith("RInChI=");
  /*
   * A pasted RInChI was not converted *to* a RInChI — it is the input. Saying
   * so would be circular, and worse, it would hide that the string came back
   * untouched, which is the property that makes the keys trustworthy.
   */
  const echoed = conversionSource === "paste" && pastedInput.kind === "rinchi";
  setConversionStatus(
    ok ? "ok" : "error",
    ok
      ? echoed
        ? "Derived the three keys from the pasted RInChI, unchanged."
        : `Converted ${sourceLabel()} to a RInChI.`
      : echoed
        ? "No keys derived from the pasted RInChI; see the log."
        : `No RInChI generated for ${sourceLabel()}; see the log.`
  );
  markResultsStale(false);
}

async function convertReactionFromKetcher(ketcher) {
  setConversionStatus("busy", "Converting the reaction to a RInChI…");
  clearRinchiResults();

  /*
   * The arrow is the default, the checkbox is the override. Syncing it to the
   * arrow whenever the arrow says "equilibrium" means a drawn equilibrium
   * shows as checked, while a pasted reaction — whose RXN carries no such
   * notation — can still be declared one by hand.
   */
  const forceEquilibrium = document.getElementById("workbench-forceequilibrium");
  if (hasEquilibriumReactionArrow(ketcher)) {
    forceEquilibrium.checked = true;
  }

  const rxnfile = await ketcher.getRxn();
  await convertRxnfileToRinchiAndWriteResults(
    rxnfile,
    forceEquilibrium.checked,
    "workbench-rinchi",
    "workbench-longrinchikey",
    "workbench-shortrinchikey",
    "workbench-webrinchikey",
    "workbench-rauxinfo",
    "workbench-rinchi-logs"
  );
  reportRinchiOutcome();
}

async function onChangeInchiVersion() {
  await updateInchiOptions(() => updateWorkbench());
  await updateKetcherOptions(getKetcher("workbench-ketcher"), getVersion());
}

/*
 * The records of the chosen SD file, converted once. Selecting one afterwards
 * is a redraw, not a reconversion — a 2000-record file is minutes of
 * WebAssembly work and must not be repeated because someone clicked a row.
 */
let sdfRecords = [];
let selectedSdfRecord = -1;

/*
 * The version and flags the list was converted under.
 *
 * A later version or option change re-converts only the selected record, so
 * every other row becomes a claim about settings that no longer apply. The
 * old tab re-ran the whole file on every change; doing that to a 2000-record
 * file because someone ticked a checkbox is worse. The list says it is stale
 * instead, and offers to run again.
 */
let sdfRecordsSettings = "";

function sdfSettingsNow() {
  return `${getVersion()} ${collectInchiOptions(optionsPanel())}`;
}

function markSdfRecordsStale() {
  const host = document.querySelector("[data-sdf-records]");
  if (!host || sdfRecords.length === 0) {
    return;
  }
  const stale = sdfRecordsSettings !== sdfSettingsNow();
  host.classList.toggle("records-stale", stale);
  const notice = host.querySelector("[data-records-stale]");
  if (notice) {
    notice.hidden = !stale;
  }
}

async function loadSdFile() {
  const input = document.getElementById("workbench-sdf");
  const host = document.querySelector("[data-sdf-records]");
  const file = input.files[0];

  sdfRecords = [];
  selectedSdfRecord = -1;
  host.hidden = true;
  host.replaceChildren();
  writeResult("", "workbench-sdf-export");
  document.getElementById("workbench-sdf-export-wrapper").hidden = true;

  if (!file) {
    return;
  }
  // Case-insensitive: Windows tools routinely write ".SDF".
  if (!file.name.toLowerCase().endsWith(".sdf")) {
    setConversionStatus(
      "error",
      `"${file.name}" is not an SD file. Please choose a file with the .sdf extension.`
    );
    return;
  }
  if (file.size === 0) {
    setConversionStatus("error", `"${file.name}" is empty.`);
    return;
  }

  const sdfText = await file.text();
  const delimiter = getSDFDelimiter(sdfText);
  /*
   * A single-record file exported as .sdf often has no "$$$$" terminator.
   * That is still something we can convert, so treat the whole text as one
   * record instead of rejecting the file.
   */
  const entries = (delimiter ? sdfText.split(delimiter) : [sdfText]).filter(
    (entry) => entry.trim() !== ""
  );

  if (entries.length === 0) {
    setConversionStatus(
      "error",
      `No records found in "${file.name}". Records are separated by "$$$$".`
    );
    return;
  }

  const options = collectInchiOptions(optionsPanel());
  const inchiVersion = getVersion();
  let completed = 0;
  setConversionStatus(
    "busy",
    `Converting ${entries.length} record${entries.length === 1 ? "" : "s"} with InChI ${inchiVersion}…`
  );

  try {
    sdfRecords = await throttleMap(entries, async (molfile, index) => {
      try {
        const result = await getAllFromMolfile(molfile, options, inchiVersion);
        return {
          molfile,
          inchi: result.inchi,
          auxinfo: result.auxinfo,
          inchikey: result.inchikey,
          log: result.inchi === "" ? `Record ${index + 1} could not be converted.` : "",
        };
      } catch (error) {
        console.error(`Caught exception from getAllFromMolfile(): ${error}`);
        return {
          molfile,
          inchi: "",
          auxinfo: "",
          inchikey: "",
          log: `Record ${index + 1} could not be converted. Detail: ${error.message}`,
        };
      } finally {
        completed++;
        // Coarse enough not to thrash layout on a file with thousands of records.
        if (completed % 20 === 0) {
          setConversionStatus(
            "busy",
            `Converted ${completed} of ${entries.length} records…`
          );
        }
      }
    });
  } catch (error) {
    console.error(`Error processing SD file: ${error}`);
    setConversionStatus(
      "error",
      `The SD file could not be processed. Detail: ${error.message}`
    );
    return;
  }

  /*
   * The batch outcome goes on the list, not into the status line.
   *
   * The status line describes one conversion — the record currently in the
   * editor — and selectSdfRecord below draws the first record, which fires
   * exactly such a conversion and would overwrite anything written here. A
   * file-level summary also belongs with the file-level thing.
   */
  sdfRecordsSettings = sdfSettingsNow();
  renderSdfRecords();
  renderSdfExport();
  await selectSdfRecord(0);
}

/*
 * The file as one text, in the same shape old tab 4 emitted: InChI, AuxInfo
 * and InChIKey per record, blank-line separated, failures named in place.
 * This is the export — the result plate it is written into already has copy
 * and download.
 */
function renderSdfExport() {
  const field = document.getElementById("workbench-sdf-export-wrapper");
  const text = sdfRecords
    .map((record, index) =>
      record.inchi === ""
        ? `Record ${index + 1} could not be converted.\n${record.log}\n`
        : `${record.inchi}\n${record.auxinfo}\n${record.inchikey}\n`
    )
    .join("\n");
  writeResult(text, "workbench-sdf-export");
  field.hidden = sdfRecords.length === 0;
}

/*
 * textContent throughout, never innerHTML: these records come from a file the
 * visitor was handed by someone else.
 */
function renderSdfRecords() {
  const host = document.querySelector("[data-sdf-records]");
  host.replaceChildren();
  if (sdfRecords.length === 0) {
    host.hidden = true;
    return;
  }

  const plate = document.createElement("div");
  plate.className = "notation-frame record-list";

  const head = document.createElement("div");
  head.className = "identifier-head";
  const title = document.createElement("span");
  title.className = "apparatus";
  const failed = sdfRecords.filter((record) => record.inchi === "").length;
  title.textContent =
    `${sdfRecords.length} record${sdfRecords.length === 1 ? "" : "s"}` +
    (failed === 0 ? "" : ` · ${failed} could not be converted`);
  head.appendChild(title);
  if (failed > 0) {
    /* Not by colour alone: the count is in the words above. */
    title.classList.add("record-list-failures");
  }

  /*
   * The staleness notice. Hidden until the version or the flags move away from
   * the ones these rows were converted under, at which point every row except
   * the selected one is describing settings that no longer apply. Rerunning is
   * the visitor's decision, because on a large file it is minutes of work.
   */
  const stale = document.createElement("span");
  stale.className = "records-stale-notice";
  stale.dataset.recordsStale = "";
  stale.hidden = true;
  const staleText = document.createElement("span");
  staleText.className = "apparatus";
  staleText.textContent = "Converted with earlier settings";
  const again = document.createElement("button");
  again.type = "button";
  again.className = "link-button";
  again.textContent = "Convert again";
  again.addEventListener("click", () => loadSdFile());
  stale.append(staleText, again);
  head.appendChild(stale);

  plate.appendChild(head);

  const list = document.createElement("div");
  list.className = "record-rows";
  /*
   * Not role="listbox". A listbox's options are not buttons and it promises
   * arrow-key navigation that is not implemented here; a group of pressable
   * buttons is what this actually is.
   */
  list.setAttribute("role", "group");
  list.setAttribute("aria-label", "SD file records");

  sdfRecords.forEach((record, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "record-row";
    row.setAttribute("aria-pressed", String(index === selectedSdfRecord));
    row.dataset.record = String(index);
    row.addEventListener("click", () => selectSdfRecord(index));

    const number = document.createElement("span");
    number.className = "record-number apparatus";
    number.textContent = String(index + 1);

    const identifier = document.createElement("span");
    identifier.className = "record-identifier";
    identifier.textContent = record.inchikey || record.log || "no InChI";

    row.append(number, identifier);
    list.appendChild(row);
  });

  plate.appendChild(list);
  host.appendChild(plate);
  host.hidden = false;
}

/*
 * Draw the chosen record and let the ordinary conversion path describe it.
 * The identifier is already known, but going back through updateWorkbench()
 * means the plates, the version stamp, the comparison and the 3D viewer are
 * filled by the same code as a drawn structure — one path, not two.
 */
async function selectSdfRecord(index) {
  const record = sdfRecords[index];
  if (!record) {
    return;
  }
  selectedSdfRecord = index;

  document.querySelectorAll(".record-row").forEach((row) => {
    row.setAttribute(
      "aria-pressed",
      String(Number(row.dataset.record) === index)
    );
  });

  const ketcher = getKetcher("workbench-ketcher");
  if (ketcher) {
    /* setMolecule fires the editor's `change` event, which updateWorkbench is
     * already subscribed to. See the note in loadPastedInput. */
    await ketcher.setMolecule(record.molfile);
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

async function updateInchiOptions(updateFunction) {
  /*
   * Say which version is loading, before the wait rather than after it. Every
   * non-default version is a cold ~1 MB WebAssembly fetch and compile, because
   * warmUp() only prefetches the default one — several seconds during which
   * the old UI showed nothing at all.
   */
  setConversionStatus("busy", `Loading InChI ${getVersion()}…`);
  markResultsStale(true);

  /*
   * Snapshotted after addInchiOptionsForm has already rebuilt the panel, so
   * this restore is a no-op — a pre-existing bug, not introduced here. Left
   * exactly as it was; fixing it is a separate change with its own test.
   */
  await addInchiOptionsForm(() => updateFunction());
  const optionsState = getInchiOptionsState(optionsPanel());
  applyInchiOptionsState(optionsPanel(), optionsState);
  updateChangedOptionCount();

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
  stampVersion(inchiVersion);
  markResultsStale(false);
  renderComparison();

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
      "error",
      `No InChI generated by ${inchiVersion} (code ${return_code}). ${detail}`
    );
  } else {
    const optionSummary =
      options === "" ? "default options" : `options ${options}`;
    setConversionStatus(
      "ok",
      `Converted ${sourceLabel()} with InChI ${inchiVersion}, ${optionSummary}.` +
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

/*
 * The reverse direction: this surface's RInChI back to RXN or RD file text.
 * The RInChI comes from the plate rather than from a second paste field —
 * there is only one reaction on the surface, and asking the visitor to paste
 * back the string the app just produced was the tab's own worst feature.
 */
async function downloadReactionFile() {
  /*
   * The pasted RInChI wins over the generated one when there is one.
   *
   * Old RInChI tab 4 converted whatever you pasted, with no round trip
   * through an editor. Here the reaction has been drawn by Ketcher and read
   * back, so the RInChI on the plate may not be byte-identical to the one
   * pasted — and it is the pasted string the visitor wants a file for.
   */
  const pasted = splitRinchiPaste(
    document.getElementById("workbench-paste").value
  );
  const rinchi =
    pasted.rinchi ||
    document.getElementById("workbench-rinchi").textContent.trim();
  const rauxinfo =
    pasted.rauxinfo ||
    document.getElementById("workbench-rauxinfo").textContent.trim();
  const format = document.querySelector(
    'input[name="reactionFileFormat"]:checked'
  ).value;

  writeResult("", "workbench-reaction-file");

  if (!rinchi.startsWith("RInChI=")) {
    setConversionStatus(
      "error",
      "There is no RInChI to convert yet. Draw or paste a reaction first."
    );
    return;
  }

  /*
   * Its own log element, not the RInChI's: convertRinchiToTextfile *replaces*
   * the content of whatever it is handed, and the RInChI log is the record of
   * the conversion that produced the string being converted here.
   */
  const fileText = await convertRinchiToTextfile(
    rinchi,
    rauxinfo,
    format,
    "workbench-reaction-file-logs"
  );
  if (!fileText) {
    /* Without this the status line still reads "ok" from the RInChI run and
     * the empty plate is the only sign anything went wrong. */
    setConversionStatus(
      "error",
      `This RInChI could not be converted to ${format} file text; see the log.`
    );
    return;
  }
  writeResult(fileText, "workbench-reaction-file");
  setConversionStatus("ok", `Generated ${format} file text for this RInChI.`);
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

/**
 * Get molfile from Ketcher editor
 * @param {Object} ketcher - Ketcher instance
 * @param {String} format - Format to retrieve: "v2000" (default) or "v3000"
 * @returns {Promise<String>} - Molfile string in the requested format
 */
async function getMolfileFromKetcher(ketcher, format = "v2000") {
  try {
    const struct = ketcher.editor.struct();
    if (struct.isBlank()) {
      return null;
    }

    const formatter =
      format === "v3000"
        ? ketcher.formatterFactory.create("molV3000", {}, false, struct)
        : ketcher.formatterFactory.create("mol", {}, false, struct);
    return await formatter.getStringFromStructureAsync(struct);
  } catch (error) {
    /*
     * Returning null rather than raising an alert(): every caller now reports
     * failure through the status line, which is where the rest of this app
     * says what went wrong. An alert is the only modal interruption in the
     * product and it cannot be read by anything that logs.
     */
    console.error("Ketcher could not serialize the structure", error);
    return null;
  }
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
