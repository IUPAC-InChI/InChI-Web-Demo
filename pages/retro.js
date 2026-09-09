"use strict";

/*
 * InChI Web App — 3270 preview surface.
 *
 * Wires the real bridges (inchi.js) and the real layer grammar
 * (inchi-layers.js) to a 3270 panel. The flag block is not re-authored here:
 * it is read out of the same pages/components/options/*.html templates the
 * shipped app renders, so a flag added upstream appears on this screen too.
 */

/*
 * inchi.js loads a version's Emscripten glue through this. It is declared in
 * index.js for the shipped app; the getter that calls it is lazy, so a
 * hoisted declaration here is in place before the first read.
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

/* L-alanine. A structure with enough layers that /t and /m are real rows. */
const SAMPLE_MOLFILE = [
  "",
  "  InChI Web App",
  "",
  "  6  5  0  0  1  0  0  0  0  0999 V2000",
  "    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0",
  "   -0.8660    0.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0",
  "    0.0000   -1.0000    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0",
  "    0.8660    0.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0",
  "    1.7320    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0",
  "    0.8660    1.5000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0",
  "  1  2  1  0  0  0  0",
  "  1  3  1  1  0  0  0",
  "  1  4  1  0  0  0  0",
  "  4  5  2  0  0  0  0",
  "  4  6  1  0  0  0  0",
  "M  END",
].join("\n");

/*
 * Which option templates make up a version's flag block. Mirrors the
 * componentPaths of the InChIOptions* elements in components/components.js.
 */
const OPTION_TEMPLATES = {
  "inchi-options-106": [
    "components/options/106-options.html",
    "components/options/stereo-base-options.html",
    "components/options/base-options.html",
  ],
  "inchi-options-1075": [
    "components/options/tautomer-options.html",
    "components/options/stereo-base-options.html",
    "components/options/base-options.html",
  ],
  "inchi-options-dev": [
    "components/options/tautomer-options.html",
    "components/options/stereo-base-options.html",
    "components/options/base-options.html",
  ],
  "inchi-options-dev-moin": [
    "components/options/tautomer-options.html",
    "components/options/latest-moin-options.html",
    "components/options/stereo-base-options.html",
    "components/options/base-options.html",
  ],
  "inchi-options-dev-enhanced-stereo": [
    "components/options/tautomer-options.html",
    "components/options/latest-enhanced-stereo-options.html",
    "components/options/base-options.html",
  ],
  "inchi-options-no-metal-h": [
    "components/options/tautomer-options.html",
    "components/options/latest-moin-options.html",
    "components/options/stereo-base-options.html",
    "components/options/base-options.html",
  ],
  "inchi-options-explicit-zero-valence": [
    "components/options/tautomer-options.html",
    "components/options/latest-moin-options.html",
    "components/options/stereo-base-options.html",
    "components/options/base-options.html",
  ],
};

/* The one template that is a <select multiple> rather than a checkbox list. */
const TAUTOMER_GROUP = "TAUTOMERISM";

const templateCache = new Map();

const el = (id) => document.getElementById(id);

const state = {
  versions: null,
  pinned: null,
  latest: null,
  running: false,
};

/* --------------------------------------------------------------------- OIA */

/*
 * Row 24. "X SYSTEM" is the 3270's own indicator for "the host has your
 * screen and has not answered yet", which is precisely what a cold 1 MB
 * WebAssembly module is. This node is never hidden and never moved.
 */
function oia(text, kind) {
  const node = el("oia");
  node.textContent = text;
  node.className = "oia-state" + (kind ? " " + kind : "");
}

function oiaMeta(text) {
  el("oiameta").textContent = text;
}

/* ------------------------------------------------------------------ helpers */

function escapeHtmlText(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function releaseGroup(url) {
  if (/\/pull\//.test(url)) {
    return "OPEN PULL REQUEST";
  }
  if (/\/releases\/tag\//.test(url)) {
    return "RELEASED";
  }
  return "DEVELOPMENT BRANCH";
}

/* --------------------------------------------------------- version selector */

async function buildVersionSelector() {
  state.versions = await window.inchiVersionsReady;

  const select = el("version");
  const groups = new Map();

  for (const [name, cfg] of Object.entries(state.versions)) {
    const group = releaseGroup(cfg.url ?? "");
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group).push([name, cfg]);
  }

  /* Released first: the order an operator expects to read them in. */
  for (const group of ["RELEASED", "DEVELOPMENT BRANCH", "OPEN PULL REQUEST"]) {
    const entries = groups.get(group);
    if (!entries) {
      continue;
    }
    const optgroup = document.createElement("optgroup");
    optgroup.label = group;
    for (const [name, cfg] of entries) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      option.selected = Boolean(cfg.default);
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
}

function showProvenance() {
  const name = el("version").value;
  const cfg = state.versions[name];
  const commit = cfg.commit === "dev" ? "dev (moving)" : cfg.commit.slice(0, 12);
  el("provenance").innerHTML =
    escapeHtmlText(commit) +
    ' <a href="' +
    escapeHtmlText(cfg.url) +
    '" rel="noreferrer">' +
    escapeHtmlText(cfg.url.replace(/^https:\/\/github\.com\//, "")) +
    "</a>";
}

/* ---------------------------------------------------------------- flag block */

async function fetchTemplate(path) {
  if (!templateCache.has(path)) {
    templateCache.set(
      path,
      fetch(path)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`${path}: ${response.status}`);
          }
          return response.text();
        })
        .then((text) =>
          new DOMParser().parseFromString(text, "text/html")
        )
    );
  }
  return templateCache.get(path);
}

/*
 * Read one option template into plain descriptors. Everything this screen
 * needs about a flag is already in the shipped markup: the flag it turns on or
 * off, its label, whether it defaults checked or disabled, and whether it is
 * gated behind the stereo or polymer master switch.
 */
function readOptionTemplate(doc) {
  const items = [];

  doc.querySelectorAll("input.form-check-input[data-id]").forEach((input) => {
    const label = input.parentElement.querySelector(".form-check-label");
    const caption = label
      ? label.textContent.replace(/\s*\?\s*$/, "").replace(/\s+/g, " ").trim()
      : input.dataset.id;

    items.push({
      id: input.dataset.id,
      type: input.type,
      radioName: input.name || "",
      on: input.dataset.inchiOptionOn ?? "",
      off: input.dataset.inchiOptionOff ?? "",
      caption: caption.replace(/:$/, ""),
      checked: input.hasAttribute("data-default-checked"),
      disabled: input.hasAttribute("data-default-disabled"),
      stereo: input.hasAttribute("data-inchi-stereo-option"),
      polymer: input.hasAttribute("data-inchi-polymer-option"),
      indent: input.parentElement.classList.contains("ms-4"),
    });
  });

  /*
   * The tautomer template is a <select multiple> driven by a jQuery widget in
   * the shipped app. On a 3270 panel a multi-select is a block of selection
   * cells, which is both simpler and closer to the original.
   */
  doc
    .querySelectorAll("select[data-tautomer-multiselect] option[data-id]")
    .forEach((option) => {
      items.push({
        id: option.dataset.id,
        type: "checkbox",
        radioName: "",
        on: option.dataset.inchiOptionOn ?? "",
        off: "",
        /* The flag column already carries the id; the caption need not repeat it. */
        caption: option.textContent
          .replace(/\s+/g, " ")
          .trim()
          .replace(/^\S+\s+-\s+/, ""),
        checked: false,
        disabled: false,
        stereo: false,
        polymer: false,
        indent: false,
        group: TAUTOMER_GROUP,
      });
    });

  return items;
}

function groupName(path) {
  if (path.includes("tautomer")) {
    return TAUTOMER_GROUP;
  }
  if (path.includes("stereo")) {
    return "STEREOCHEMISTRY";
  }
  if (path.includes("moin") || path.includes("106")) {
    return "VERSION SPECIFIC";
  }
  return "STRUCTURE HANDLING";
}

async function buildFlagBlock() {
  const version = el("version").value;
  const templateId = state.versions[version].optionsTemplateId;
  const paths = OPTION_TEMPLATES[templateId] ?? OPTION_TEMPLATES["inchi-options-dev"];

  const sections = [];
  for (const path of paths) {
    const doc = await fetchTemplate(path);
    const items = readOptionTemplate(doc);
    if (items.length > 0) {
      sections.push([groupName(path), items]);
    }
  }

  /* Structure handling reads first: it is the block most runs touch. */
  sections.sort((a, b) => {
    const order = [
      "STRUCTURE HANDLING",
      "STEREOCHEMISTRY",
      TAUTOMER_GROUP,
      "VERSION SPECIFIC",
    ];
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  });

  const host = el("flags");
  host.textContent = "";

  for (const [group, items] of sections) {
    const heading = document.createElement("div");
    heading.className = "group";
    heading.textContent = group;
    host.appendChild(heading);

    for (const item of items) {
      host.appendChild(flagCell(item));
    }
  }

  const legend = document.createElement("p");
  legend.className = "legend";
  legend.textContent =
    "A bracketed flag is the one emitted when its cell is clear. A dim row is gated behind the master switch above it.";
  host.appendChild(legend);

  applyGates();
  refreshCommand();
}

function flagCell(item) {
  const label = document.createElement("label");
  label.className = "sel" + (item.indent ? " indent" : "");

  const input = document.createElement("input");
  input.type = item.type;
  if (item.type === "radio") {
    input.name = item.radioName || "flagradio";
  }
  input.dataset.id = item.id;
  if (item.on) {
    input.dataset.inchiOptionOn = item.on;
  }
  if (item.off) {
    input.dataset.inchiOptionOff = item.off;
  }
  if (item.stereo) {
    input.dataset.stereo = "1";
  }
  if (item.polymer) {
    input.dataset.polymer = "1";
  }
  input.dataset.defaultChecked = item.checked ? "1" : "";
  input.dataset.defaultDisabled = item.disabled ? "1" : "";
  input.checked = item.checked;
  input.disabled = item.disabled;

  const cell = document.createElement("span");
  cell.className = "cell";
  cell.setAttribute("aria-hidden", "true");

  const cap = document.createElement("span");
  cap.className = "cap";
  cap.textContent = item.caption;

  /*
   * The flag itself, shown at rest and in its own column. This is the string
   * the operator pastes into a pipeline, so it belongs on the screen rather
   * than behind a tooltip — and it reads before the caption because it is the
   * thing you cite when you say which flag moved the answer.
   */
  const flag = item.on || item.off;
  const name = document.createElement("span");
  name.className = "flagname";
  name.textContent = flag ? (item.off ? `[-${flag}]` : `-${flag}`) : "";

  label.append(input, cell, name, cap);

  return label;
}

/*
 * Two master switches gate sub-blocks in the shipped app, and they matter
 * visibly: clearing "Include Stereo" or "Treat polymers" takes its whole
 * sub-block out of the assembled command line.
 */
function applyGates() {
  const stereoOn = el("flags").querySelector('input[data-id="includeStereo"]');
  const polymersOn = el("flags").querySelector('input[data-id="treatPolymers"]');

  el("flags")
    .querySelectorAll("input[data-stereo]")
    .forEach((input) => {
      input.disabled = Boolean(stereoOn) && !stereoOn.checked;
    });

  el("flags")
    .querySelectorAll("input[data-polymer]")
    .forEach((input) => {
      input.disabled = !polymersOn || !polymersOn.checked;
    });
}

/* Same collection rule as the shipped app: on-when-checked, off-when-clear. */
function collectFlags() {
  const flags = [];
  const host = el("flags");

  host
    .querySelectorAll("input:enabled[data-inchi-option-on]:checked")
    .forEach((input) => flags.push(input.dataset.inchiOptionOn));

  host
    .querySelectorAll("input:enabled[data-inchi-option-off]:not(:checked)")
    .forEach((input) => flags.push(input.dataset.inchiOptionOff));

  return flags;
}

function refreshCommand() {
  const flags = collectFlags();
  const options = flags.map((flag) => "-" + flag).join(" ");
  el("command").textContent = ("inchi " + options).trim();
  el("flagcount").textContent =
    flags.length === 0
      ? "NO FLAGS SET"
      : flags.length === 1
        ? "1 FLAG SET"
        : `${flags.length} FLAGS SET`;
  return options;
}

function resetFlags() {
  el("flags")
    .querySelectorAll("input[data-id]")
    .forEach((input) => {
      input.checked = input.dataset.defaultChecked === "1";
      input.disabled = input.dataset.defaultDisabled === "1";
    });
  applyGates();
  refreshCommand();
}

/* ------------------------------------------------------------ the record */

function layerRows(parsed) {
  let html = "";
  /* The literal prefix, which is what the version segment of an InChI is. */
  html += `<div class="head">${escapeHtmlText(parsed.prefix + parsed.version)}</div>`;

  for (const layer of parsed.layers) {
    const letter = layer.key === "formula" ? "/" : "/" + layer.key;
    html +=
      '<div class="gutter"></div>' +
      `<div class="key"><span class="letter">${escapeHtmlText(letter)}</span> ${escapeHtmlText(layer.name)}</div>` +
      `<div class="value">${escapeHtmlText(layer.value)}</div>`;
  }
  return html;
}

function keyBlocksHtml(inchikey, changed, recede) {
  const blocks = parseInchikeyBlocks(inchikey);
  if (blocks.length === 0) {
    return "";
  }
  const shortNames = {
    Skeleton: "SKELETON",
    "Stereo and isotopes": "STEREO+ISO",
    Protonation: "PROT",
  };
  const parts = blocks.map(
    (block) =>
      '<span class="block"><b>' +
      escapeHtmlText(block.value) +
      "</b><span>" +
      escapeHtmlText(shortNames[block.name] ?? block.name.toUpperCase()) +
      "</span></span>"
  );
  return (
    '<div class="keyblocks' +
    (changed ? " moved" : "") +
    (recede ? " same" : "") +
    '">' +
    parts.join('<span class="dash">-</span>') +
    "</div>"
  );
}

function renderResult(result) {
  const parsed = parseInchiLayers(result.inchi);
  const host = el("result");

  if (parsed.layers.length === 0) {
    host.innerHTML =
      '<p class="empty">' +
      escapeHtmlText(
        result.error ||
          "No identifier. The library returned nothing to split into layers."
      ) +
      "</p>";
    return;
  }

  host.innerHTML =
    layerRows(parsed) +
    '<div class="gutter"></div>' +
    '<div class="key"><span class="letter">KEY</span> InChIKey</div>' +
    `<div class="value">${escapeHtmlText(result.inchikey || "not generated")}</div>` +
    keyBlocksHtml(result.inchikey, false);

  el("resultstamp").textContent = `${result.version} — ${result.inchi.length} CHARS`;
  el("auxout").textContent = result.auxinfo || "not emitted";
  el("logout").textContent = result.log || result.message || "not emitted";
}

/*
 * The comparison. Divergence is carried by a ">" in the gutter, by intensity
 * and by striking the superseded value — never by hue, so it reads in
 * greyscale, in print, and under colour-vision deficiency.
 */
function renderComparison() {
  const pinned = state.pinned;
  const current = state.latest;
  if (!pinned || !current) {
    el("comparezone").hidden = true;
    return;
  }

  const rows = diffInchiLayers(pinned.inchi, current.inchi);
  const moved = rows.filter((row) => row.status !== "same");

  let html = "";
  for (const row of rows) {
    const letter = row.key === "formula" ? "/" : "/" + row.key;
    const same = row.status === "same";
    html += `<div class="gutter">${same ? "" : "&gt;"}</div>`;
    html +=
      `<div class="key${same ? " same" : " moved"}"><span class="letter">${escapeHtmlText(letter)}</span> ` +
      escapeHtmlText(row.name) +
      "</div>";

    if (same) {
      html += `<div class="value same">${escapeHtmlText(row.after)}</div>`;
    } else if (row.status === "added") {
      html +=
        '<div class="value moved"><span class="absent">not emitted</span> ' +
        '<span class="to">to</span> ' +
        escapeHtmlText(row.after) +
        "</div>";
    } else if (row.status === "removed") {
      html +=
        '<div class="value moved"><span class="was">' +
        escapeHtmlText(row.before) +
        '</span> <span class="to">to</span> <span class="absent">not emitted</span></div>';
    } else {
      html +=
        '<div class="value moved"><span class="was">' +
        escapeHtmlText(row.before) +
        '</span> <span class="to">to</span> ' +
        escapeHtmlText(row.after) +
        "</div>";
    }
  }

  const keyChanged = pinned.inchikey !== current.inchikey;
  html +=
    `<div class="gutter">${keyChanged ? "&gt;" : ""}</div>` +
    `<div class="key${keyChanged ? " moved" : " same"}"><span class="letter">KEY</span> InChIKey</div>` +
    `<div class="value${keyChanged ? " moved" : " same"}">${escapeHtmlText(current.inchikey || "not generated")}</div>` +
    keyBlocksHtml(current.inchikey, keyChanged, !keyChanged);

  el("compare").innerHTML = html;

  const sameVersion = pinned.version === current.version;
  el("comparestamp").textContent = sameVersion
    ? `${current.version}, FLAGS DIFFER`
    : `${pinned.version} TO ${current.version}`;

  el("comparesummary").textContent =
    moved.length === 0 && !keyChanged
      ? sameVersion
        ? "Identical output. Those flags make no difference to this structure."
        : "Identical output. These two versions agree on this structure."
      : `${moved.length === 1 ? "One layer" : moved.length + " layers"} moved` +
        (keyChanged ? ", and the InChIKey changed." : ", and the InChIKey is unchanged.");

  el("comparezone").hidden = false;
}

/*
 * Report a failure. The OIA names the state, the field names the cause and the
 * fix. A previous answer is kept and labelled rather than discarded: a stale
 * reading you can see is worth more than an empty field, provided it says it
 * is stale.
 */
function fail(shortState, reason, log) {
  oia(shortState, "bad");
  el("logout").textContent = log || "not emitted";

  if (state.latest) {
    el("resultstamp").textContent = `${state.latest.version} — LAST GOOD`;
    el("result").classList.add("stale");
    el("evidence").open = true;
    return;
  }

  el("result").innerHTML = '<p class="empty">' + escapeHtmlText(reason) + "</p>";
  el("resultstamp").textContent = " ";
  el("evidence").open = Boolean(log);
}

/* ------------------------------------------------------------------- run */

function currentSource() {
  return document.querySelector('input[name="source"]:checked').value;
}

async function readStructure() {
  const source = currentSource();

  if (source === "molfile") {
    /*
     * Trailing whitespace only. A molfile's first line is its title line and
     * it is legitimately blank — trimming the front shifts the counts line up
     * one row and the library rejects the whole file.
     */
    return el("molfile").value.replace(/\s+$/, "");
  }

  if (source === "auxinfo") {
    const auxinfo = el("auxinfo").value.trim();
    if (auxinfo === "") {
      return "";
    }
    const converted = await molfileFromAuxinfo(auxinfo, "", el("version").value);
    if (converted.return_code !== 0) {
      throw new Error(
        converted.error || "That AuxInfo could not be turned back into a structure."
      );
    }
    return converted.molfile;
  }

  const frame = el("ketcher");
  const ketcher = frame.contentWindow && frame.contentWindow.ketcher;
  if (!ketcher) {
    throw new Error("The editor has not finished loading yet.");
  }
  return await ketcher.getMolfile();
}

async function run() {
  if (state.running) {
    return;
  }
  state.running = true;
  el("run").disabled = true;

  /* Never blank the field and wait: the old answer stays readable, marked. */
  el("result").classList.remove("stale");
  el("result").classList.add("superseded");
  oia("SYSTEM", "busy");

  try {
    const molfile = await readStructure();
    if (molfile === "") {
      fail(
        "FIELD 1 IS EMPTY",
        "Nothing to convert yet. Paste a MOL or SD file, upload one, or draw a structure."
      );
      return;
    }

    if (/\$RXN|^\s*\$RFMT/m.test(molfile) || /M\s+V30\s+BEGIN\s+REACTANT/i.test(molfile)) {
      fail(
        "REACTION REFUSED",
        "This is a reaction, not a structure. Reactions get a RInChI rather than an InChI; remove the reaction arrow to convert it here."
      );
      return;
    }

    const version = el("version").value;
    const flags = refreshCommand();

    const result = await inchiFromMolfile(molfile, flags, version);

    /*
     * An empty InChI with return_code 0 is what the library gives back for
     * input it could not read at all, so a code check alone reports success on
     * a file that produced nothing. The answer is the empty string, not the
     * code.
     */
    if (!result.inchi) {
      fail(
        "NO IDENTIFIER RETURNED",
        result.error ||
          result.message ||
          "The library read field 1 and produced nothing. A MOL file opens with three header lines — title, program, comment — and a counts line fourth; check that field 1 holds one.",
        result.log || result.message
      );
      return;
    }

    if (result.return_code !== 0 && !result.inchi) {
      fail(
        (result.error || result.message || "CONVERSION FAILED").toUpperCase(),
        result.error || result.message || "The library refused this structure.",
        result.log || result.message
      );
      return;
    }

    const keyResult = await inchikeyFromInchi(result.inchi, version);

    state.latest = {
      version,
      flags,
      inchi: result.inchi,
      inchikey: keyResult.return_code === 0 ? keyResult.inchikey : "",
      auxinfo: result.auxinfo,
      log: result.log,
      message: result.message,
      error: result.error,
    };

    renderResult(state.latest);
    renderComparison();

    oia(
      result.return_code === 0
        ? "CONVERSION COMPLETE"
        : "CONVERSION COMPLETE WITH WARNINGS",
      result.return_code === 0 ? "" : "busy"
    );
    if (result.return_code !== 0) {
      el("evidence").open = true;
    }
  } catch (error) {
    fail("CONVERSION FAILED", String(error.message || error));
  } finally {
    el("result").classList.remove("superseded");
    el("run").disabled = false;
    state.running = false;
  }
}

/* --------------------------------------------------------------- wiring */

function fillSeparators() {
  document.querySelectorAll(".fill").forEach((node) => {
    /* Long enough to overrun the widest model; clipped by overflow. */
    node.textContent = "─".repeat(160);
  });
}

async function copyValue(what) {
  if (!state.latest) {
    oia("NOTHING TO COPY YET", "bad");
    return;
  }
  const text = what === "inchi" ? state.latest.inchi : state.latest.inchikey;
  if (!text) {
    oia("NOTHING TO COPY YET", "bad");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    oia(`${what === "inchi" ? "INCHI" : "INCHIKEY"} COPIED`);
  } catch {
    oia("THE BROWSER REFUSED THE CLIPBOARD — SELECT AND COPY", "bad");
  }
}

function setSource(source) {
  document.querySelectorAll("[data-pane]").forEach((pane) => {
    pane.hidden = pane.dataset.pane !== source;
  });
}

function reportModel() {
  const narrow = window.matchMedia("(max-width: 44rem)").matches;
  oiaMeta(narrow ? "MODEL 1  40x12" : "MODEL 2  80x24");
}

async function boot() {
  fillSeparators();
  reportModel();
  window.matchMedia("(max-width: 44rem)").addEventListener("change", reportModel);

  el("molfile").value = SAMPLE_MOLFILE;

  document.querySelectorAll('input[name="source"]').forEach((input) => {
    input.addEventListener("change", () => setSource(input.value));
  });

  el("flags").addEventListener("change", () => {
    applyGates();
    refreshCommand();
  });

  el("resetflags").addEventListener("click", resetFlags);
  el("run").addEventListener("click", run);
  el("clear").addEventListener("click", () => {
    el("molfile").value = "";
    el("auxinfo").value = "";
    el("result").innerHTML =
      '<p class="empty">Field 3 fills with the identifier\'s own layers — formula, connections, hydrogens, stereo — one row per layer, keyed by its InChI letter.</p>';
    el("resultstamp").textContent = " ";
    state.latest = null;
    renderComparison();
    oia("SCREEN CLEARED");
  });
  el("demo").addEventListener("click", () => {
    document.querySelector('input[name="source"][value="molfile"]').checked = true;
    setSource("molfile");
    el("molfile").value = SAMPLE_MOLFILE;
    oia("SAMPLE LOADED — L-ALANINE");
    run();
  });

  el("pin").addEventListener("click", () => {
    if (!state.latest) {
      oia("NOTHING TO PIN YET", "bad");
      return;
    }
    state.pinned = state.latest;
    renderComparison();
    oia(`PINNED ${state.pinned.version.toUpperCase()}`);
  });
  el("unpin").addEventListener("click", () => {
    state.pinned = null;
    renderComparison();
    oia("PINNED RESULT DROPPED");
  });

  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", () => copyValue(button.dataset.copy));
  });

  el("help").addEventListener("click", () => el("helpdialog").showModal());
  el("helpclose").addEventListener("click", () => el("helpdialog").close());

  el("molupload").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    el("molfile").value = await file.text();
    oia(`READ ${file.name.toUpperCase()}`);
    run();
  });

  /*
   * ENTER is the 3270's own submit: the operator fills the fields, then sends
   * the screen to the host. Kept off a textarea and off a real control, where
   * Enter already means something.
   */
  document.addEventListener("keydown", (event) => {
    const tag = event.target.tagName;
    const typing = tag === "TEXTAREA" || tag === "INPUT" || tag === "BUTTON";

    if (event.key === "Enter" && !typing && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      run();
      return;
    }
    /* Ctrl+Enter submits from inside a paste field, as a terminal would. */
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      run();
      return;
    }

    const pf = {
      F1: () => el("helpdialog").showModal(),
      F3: () => el("clear").click(),
      F4: () => resetFlags(),
      F5: () => copyValue("inchi"),
      F6: () => copyValue("inchikey"),
      F7: () => el("pin").click(),
      F8: () => el("unpin").click(),
      F9: () => el("demo").click(),
    }[event.key];

    if (pf) {
      event.preventDefault();
      pf();
    }
  });

  try {
    await buildVersionSelector();
    showProvenance();
    await buildFlagBlock();

    el("version").addEventListener("change", async () => {
      showProvenance();
      await buildFlagBlock();
      oia(`VERSION ${el("version").value.toUpperCase()} SELECTED`);
      run();
    });

    run();
  } catch (error) {
    oia(String(error.message || error).toUpperCase(), "bad");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
