/*
 * Suffix every id below `root` and rewrite the attributes that point at them.
 * Components that are rendered once per tab ship the same static markup several
 * times; "for" and "aria-labelledby" resolve to the first matching id in the
 * document, so without scoping the second instance's label would drive the
 * first instance's control.
 */
function scopeIds(root, suffix) {
  root.querySelectorAll("[id]").forEach((element) => {
    element.id = `${element.id}-${suffix}`;
  });

  ["for", "aria-labelledby", "aria-describedby", "aria-controls"].forEach(
    (attribute) => {
      root.querySelectorAll(`[${attribute}]`).forEach((element) => {
        const scoped = element
          .getAttribute(attribute)
          .split(/\s+/)
          .filter((id) => id)
          .map((id) => `${id}-${suffix}`)
          .join(" ");
        element.setAttribute(attribute, scoped);
      });
    },
  );
}

class InsertHTMLElement extends HTMLElement {
  constructor(htmlPath) {
    super();
    this.htmlPath = htmlPath;
  }

  async connectedCallback() {
    try {
      const response = await fetch(this.htmlPath);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      this.innerHTML = await response.text();
    } catch (error) {
      /*
       * Reloading is the only recovery: these fragments are part of the
       * deployment, so a failure here means an interrupted download or a stale
       * cache rather than anything the user can fix in place.
       */
      console.error(`Error loading ${this.htmlPath}`, error);
      this.innerHTML =
        `<p class="alert alert-warning mt-2" role="alert">This part of the ` +
        `page could not be loaded. Please reload the page (CTRL + F5) to try ` +
        `again.</p>`;
      throw error;
    }
  }
}

class AboutElement extends InsertHTMLElement {
  constructor() {
    super("components/about.html");
  }
}

class ReportMaskElement extends InsertHTMLElement {
  constructor() {
    super("components/report-mask.html");
  }

  async connectedCallback() {
    /*
     * Attributes are read here rather than in the constructor: a custom element
     * constructor must not touch attributes, because it also runs for elements
     * that are upgraded before their attributes are parsed.
     */
    this.tabId = this.getAttribute("tabId");

    await super.connectedCallback();
    scopeIds(this, this.tabId);

    this.dialog = this.querySelector("dialog");
    this.openBtn = this.querySelector(".mask-open");
    this.submitBtn = this.querySelector(".mask-submit");
    this.form = this.querySelector("form");
    this.nameInput = this.querySelector(".mask-name");
    this.descriptionInput = this.querySelector(".mask-description");

    this.openBtn.addEventListener("click", () => this.open());
    this.querySelector(".mask-close").addEventListener("click", () =>
      this.dialog.close(),
    );
    this.querySelector(".mask-cancel").addEventListener("click", () =>
      this.dialog.close(),
    );
    this.form.addEventListener("submit", (event) => this.submit(event));
  }

  open() {
    /*
     * showModal() traps focus, closes on Escape, makes the rest of the page
     * inert and restores focus to the trigger on close.
     */
    this.dialog.showModal();
    this.nameInput.focus();
  }

  molfileIsEmpty(molfile) {
    if (!molfile || typeof molfile !== "string") {
      return true;
    }
    const lines = molfile.trim().split("\n");
    let atomCount = 0;
    if (molfile.includes("V3000")) {
      /*
       * "M  V30 COUNTS <atoms> <bonds> ..." — located by content, not by line
       * number: the block before it varies in length between writers.
       */
      const countsLine = lines.find((line) => line.includes("V30 COUNTS"));
      atomCount = countsLine
        ? parseInt(countsLine.trim().split(/\s+/)[3], 10) || 0
        : 0;
    } else {
      // V2000 keeps the atom count in the first three columns of the counts line.
      if (lines.length < 4) {
        return true;
      }
      atomCount = parseInt(lines[2].substring(0, 3).trim(), 10) || 0;
    }
    return atomCount === 0;
  }

  validatePayload({ molfile_v2, molfile_v3 }) {
    if (molfile_v2 === null && molfile_v3 === null) {
      throw new Error("Molfile is required.");
    }
    const v2IsEmpty = this.molfileIsEmpty(molfile_v2);
    const v3IsEmpty = this.molfileIsEmpty(molfile_v3);
    if (v2IsEmpty && v3IsEmpty) {
      throw new Error("Molfile must contain at least one atom.");
    }
  }

  async postData(data = {}) {
    const paneId = `${this.tabId}-pane`;

    const textOrNull = (id) => {
      const el = document.getElementById(id);
      return el && el.textContent && el.textContent.trim()
        ? el.textContent.trim()
        : null;
    };

    let molfile_v2 = null;
    let molfile_v3 = null;
    if (this.tabId === "inchi-tab1") {
      // from ketcher for InChI Tab
      const ketcher = getKetcher(`${this.tabId}-ketcher`);

      try {
        if (ketcher) {
          molfile_v2 = await ketcher.getMolfile("v2000");
          molfile_v3 = await ketcher.getMolfile("v3000");
        }
      } catch (err) {
        molfile_v2 = null;
        molfile_v3 = null;
      }
    } else if (this.tabId === "inchi-tab2") {
      let tab2Data = document.getElementById("inchi-tab2-molfile").value;
      // from molfile for Molfile Tab
      if (tab2Data.includes("V3000")) {
        molfile_v2 = null;
        molfile_v3 = document.getElementById("inchi-tab2-molfile").value;
      } else {
        molfile_v2 = document.getElementById("inchi-tab2-molfile").value;
        molfile_v3 = null;
      }
    }

    const inchi = textOrNull(`${this.tabId}-inchi`);
    const inchikey = textOrNull(`${this.tabId}-inchikey`);
    const auxinfo = textOrNull(`${this.tabId}-auxinfo`);
    // Remove InChI options from the log
    const log = textOrNull(`${this.tabId}-logs`);
    const cleanedLog =
      log && log.startsWith("InChI options: ")
        ? log.replace(/^InChI options: [^\n]*\n?/, "")
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

    const { name, description } = data;

    const payload = {
      input_source: "WebDemo",
      inchi_version: inchi_version,
      user: name || null,
      description: description,
      molfile_v2: molfile_v2,
      molfile_v3: molfile_v3,
      inchi: inchi,
      inchikey: inchikey,
      auxinfo: auxinfo,
      options: options,
      logs: cleanedLog,
    };

    try {
      this.validatePayload(payload);
    } catch (error) {
      return { status: "error", msg: error.message };
    }

    document.dispatchEvent(
      new CustomEvent("reportMask:json", { detail: payload }),
    );

    /*
     * The token is public by construction — this is a static site, so anything
     * the browser needs to send is readable in the page source. Abuse handling
     * belongs on the ingest endpoint.
     */
    const token = "HtEZnZMm3Nwez1nPb3Y53QpcdKscG5B";

    try {
      const response = await fetch(
        "https://cheminfo.beilstein.org/report/ingest_issue?token=" + token,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        console.error("Report ingest failed", response.status, response.statusText);
        return {
          status: "error",
          msg:
            `The report service answered with ${response.status} ` +
            `${response.statusText}. Please try again later or send the ` +
            `structure to inchi@ac.rwth-aachen.de.`,
        };
      }
      return { status: "success", msg: null };
    } catch (error) {
      console.error("Report ingest failed", error);
      return {
        status: "error",
        msg: "Please check your internet connection and try again.",
      };
    }
  }

  async submit(event) {
    event.preventDefault();

    // Guard against a second submission while the first request is in flight.
    if (this.submitBtn.disabled) {
      return;
    }
    const submitLabel = this.submitBtn.textContent;
    this.submitBtn.disabled = true;
    this.submitBtn.textContent = "Submitting…";

    let feedback;
    try {
      feedback = await this.postData({
        name: this.nameInput.value.trim() || null,
        description: this.descriptionInput.value.trim() || null,
      });
    } catch (error) {
      console.error("Error assembling the report", error);
      feedback = {
        status: "error",
        msg: "The report could not be assembled from this tab.",
      };
    } finally {
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = submitLabel;
    }

    /*
     * Keep the user's text when the report did not go through, so a failed
     * submission can be retried without retyping the description.
     */
    if (feedback.status === "success") {
      this.form.reset();
    }
    this.dialog.close();

    const feedbackDialog = document.querySelector("feedback-dialog");
    if (feedbackDialog) {
      feedbackDialog.open(feedback);
    }
  }
}

class FeedbackDialogElement extends InsertHTMLElement {
  constructor() {
    super("components/report-feedback.html");
  }

  async connectedCallback() {
    await super.connectedCallback();

    this.dialog = this.querySelector("dialog");
    this.iconEl = this.querySelector(".feedback-icon");
    this.glyphEl = this.querySelector(".feedback-glyph");
    this.titleEl = this.querySelector("#feedbackTitle");
    this.messageEl = this.querySelector("#feedbackMessage");
    this.confirmBtn = this.querySelector(".feedback-confirm");

    // Escape and focus handling come from <dialog>.showModal().
    this.confirmBtn.addEventListener("click", () => this.dialog.close());
    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog) {
        this.dialog.close();
      }
    });
  }

  static get states() {
    return {
      success: {
        iconClass: "success",
        glyph: "bi bi-check-lg",
        title: "Report submitted",
        message:
          "Thank you for your report. It has been received and will be reviewed shortly.",
      },
      error: {
        iconClass: "error",
        glyph: "bi bi-x-lg",
        title: "Submission failed",
        message: "Your report could not be submitted.",
      },
    };
  }

  open(feedback) {
    const { status, msg } = feedback ?? {};
    const state =
      FeedbackDialogElement.states[status] ??
      FeedbackDialogElement.states.error;
    this.iconEl.className = `feedback-icon ${state.iconClass}`;
    this.glyphEl.className = `feedback-glyph ${state.glyph}`;
    this.titleEl.textContent = state.title;
    this.messageEl.textContent = msg
      ? `${state.message} ${msg}`
      : state.message;
    this.dialog.showModal();
    this.confirmBtn.focus();
  }
}

class InChIToolsElement extends InsertHTMLElement {
  constructor() {
    super("components/inchi-tools.html");
  }

  async connectedCallback() {
    await super.connectedCallback();

    await addInchiOptionsForm("inchi-tab1-pane", () => updateInchiTab1());
    await addInchiOptionsForm("inchi-tab2-pane", () => updateInchiTab2());
    await addInchiOptionsForm("inchi-tab4-pane", () => updateInchiTab4());
  }
}

class RInChIToolsElement extends InsertHTMLElement {
  constructor() {
    super("components/rinchi-tools.html");
  }

  async connectedCallback() {
    await super.connectedCallback();
    this.querySelectorAll(".rinchi-version").forEach((span) => {
      span.textContent = `Results computed with RInChI version ${RINCHI_VERSION}`;
    });
  }
}

class InChIVersionSelectionElement extends HTMLElement {
  constructor() {
    super();
    this.onVersionChange = new Function(this.getAttribute("onVersionChange"));
  }

  async connectedCallback() {
    /*
     * The version list is fetched, so it may not be on `window` yet when this
     * element connects. Awaiting the promise instead of reading the global
     * removes a race that renders an empty version selector on a cold cache.
     */
    try {
      await window.inchiVersionsReady;
    } catch (error) {
      console.error("Error loading inchi_versions.json", error);
      this.innerHTML =
        `<div class="bounding-box"><p class="mb-0" role="alert">The InChI ` +
        `version list could not be loaded. Please reload the page ` +
        `(CTRL + F5).</p></div>`;
      return;
    }

    // Unique per tab, so that the <label> binds to this tab's <select>.
    const suffix = this.closest(".tab-pane")?.id ?? "";
    const dropdownId = `version-dropdown-${suffix}`;

    this.innerHTML = `<div class="bounding-box">
      <label class="h4 d-block" for="${dropdownId}">Version</label>
      <select id="${dropdownId}" style="display: block;" data-version></select>
      <span class="version-commit" style="display: block;"></span>
    </div>`;

    const dropdown = this.querySelector("select[data-version]");
    const commitLink = this.querySelector(".version-commit");

    for (const [versionName, versionConfig] of Object.entries(
      availableInchiVersions,
    )) {
      const option = document.createElement("option");
      option.textContent = versionName;
      option.value = versionName;
      option.selected = Boolean(versionConfig.default);
      dropdown.appendChild(option);
    }

    const showCommitLink = (versionName) => {
      const url = availableInchiVersions[versionName].url;
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = url;
      commitLink.replaceChildren(link);
    };

    dropdown.addEventListener("change", (event) => {
      this.onVersionChange();
      showCommitLink(event.target.value);
    });

    showCommitLink(dropdown.value);
  }
}

class InChIResultFieldElement extends HTMLElement {
  constructor() {
    super();
    /*
     * Not `this.title`: HTMLElement reflects that property to the title
     * attribute, which would put a browser tooltip on the whole result panel
     * and add a stray accessible description.
     */
    this.fieldTitle = this.getAttribute("title");
    this._id = this.getAttribute("id");
    this.setAttribute("id", `${this._id}-wrapper`); // Avoid "id" attribute name conflict with the pre element.
  }

  connectedCallback() {
    /*
     * Results are written without any user action (drawing in Ketcher triggers a
     * conversion), so the fields that carry the outcome announce themselves. It
     * is opt-in: marking every field live would make one edit produce four
     * announcements, and AuxInfo or a full key list is not worth reading aloud.
     */
    const live = this.hasAttribute("live")
      ? ' aria-live="polite" aria-atomic="true"'
      : "";

    this.innerHTML = `<div class="mt-2 border rounded bg-light" style="--bs-bg-opacity: 0.3">
      <div
        class="border-bottom py-1 px-3 d-flex align-items-center justify-content-between"
      >
        <small class="font-monospace">${this.fieldTitle}</small>
        <div class="btn-group" role="group">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary ms-auto result-copy"
            title="Copy to clipboard"
            aria-label="Copy ${this.fieldTitle} to clipboard"
            disabled
          >
            <i class="bi bi-clipboard" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary ms-auto result-download"
            title="Download to text file"
            aria-label="Download ${this.fieldTitle} as a text file"
            disabled
          >
            <i class="bi bi-download" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <pre id="${this._id}" class="py-1 px-3 mb-0 inchi-result-text" style="max-height: 500px"${live}></pre>
    </div>`;

    const resultText = this.querySelector(`#${this._id}`);
    const copyButton = this.querySelector(".result-copy");
    const downloadButton = this.querySelector(".result-download");

    copyButton.addEventListener("click", async () => {
      const icon = copyButton.querySelector("i");
      try {
        await navigator.clipboard.writeText(resultText.innerText.trim());
        icon.className = "bi bi-clipboard-check";
        copyButton.title = "Copied";
      } catch (error) {
        /*
         * Blocked permission or an insecure context: say so instead of leaving
         * the user to wonder whether the copy worked.
         */
        console.error("Copy to clipboard failed", error);
        icon.className = "bi bi-clipboard-x";
        copyButton.title = "Copying failed — select the text and copy manually";
      }
      setTimeout(() => {
        icon.className = "bi bi-clipboard";
        copyButton.title = "Copy to clipboard";
      }, 2000);
    });

    downloadButton.addEventListener("click", () => {
      const text = resultText.innerText.trim();
      if (!text) {
        return;
      }
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Colons are not allowed in Windows filenames, so strip them from the stamp.
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `${this.fieldTitle}_${timestamp}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url); // Clean up the URL object
    });

    const toggleButtonState = () => {
      const resultAvailable = resultText.innerText.trim().length > 0;
      copyButton.disabled = !resultAvailable;
      downloadButton.disabled = !resultAvailable;
    };

    /*
     * Only text changes matter here. Watching attributes as well meant every
     * result field reacted to mutations that can never change its content.
     */
    const observer = new MutationObserver(toggleButtonState);
    observer.observe(resultText, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }
}

class InChIOptionsElement extends HTMLElement {
  constructor() {
    super();
  }

  async postCreate(tabDivId, updateFunction, inchiVersion) {
    const htmlFragments = await Promise.all(
      this.componentPaths.map(async (path) => {
        try {
          const response = await fetch(path);
          return response.ok
            ? await response.text()
            : `<p>Error loading ${path}</p>`;
        } catch {
          return `<p>Error loading ${path}</p>`;
        }
      }),
    );

    /*
     * A <details> rather than a plain panel. Below 992px the grid is still one
     * column, so these twenty-odd checkboxes sit between the editor and the
     * results — measured at 500px of scrolling on a portrait tablet. It starts
     * collapsed there and open on the wide layout that has room for a sidebar.
     * Closed inputs stay in the DOM, so getInchiOptions() still reads them.
     */
    const boundingBox = document.createElement("details");
    boundingBox.setAttribute("class", "bounding-box");
    boundingBox.innerHTML =
      '<summary class="h4">Options</summary>' + htmlFragments.join("");

    /*
     * Follow the layout until the visitor expresses a preference: rotating a
     * tablet into portrait should collapse the panel, but reopening it by hand
     * has to stick.
     */
    const stacked = window.matchMedia("(max-width: 991.98px)");
    boundingBox.open = !stacked.matches;
    let visitorDecided = false;
    boundingBox.addEventListener("toggle", () => {
      if (boundingBox.open !== !stacked.matches) {
        visitorDecided = true;
      }
    });
    stacked.addEventListener("change", (event) => {
      if (!visitorDecided) {
        boundingBox.open = !event.matches;
      }
    });

    this.appendChild(boundingBox);

    if (versionBehavior(inchiVersion).checkNPZzByDefault) {
      this.querySelector('input[data-id="NPZz"]').checked = true;
    }

    /*
     * Reassign the name of the "stereoRadio" radio button group.
     */
    this.querySelectorAll(
      'input.form-check-input[type="radio"][name="stereoRadio"]',
    ).forEach((input) => {
      input.name = "stereoRadio-" + tabDivId;
    });

    /*
     * Register an on-change event on the "Include Stereo" checkbox to switch the
     * 'disabled' state of the inputs that cope with stereo options.
     */
    this.querySelector(
      'input.form-check-input[data-id="includeStereo"]',
      // Optional: an options template is free to leave the checkbox out.
    )?.addEventListener("change", function () {
      document
        .getElementById(tabDivId)
        .querySelectorAll("input.form-check-input[data-inchi-stereo-option]")
        .forEach((input) => {
          input.disabled = !this.checked;
        });
    });

    /*
     * Register an on-change event on the "Treat polymers" checkbox to switch the
     * 'disabled' state of the inputs that cope with polymer options.
     */
    this.querySelector(
      'input.form-check-input[data-id="treatPolymers"]',
    )?.addEventListener("change", function () {
      document
        .getElementById(tabDivId)
        .querySelectorAll("input.form-check-input[data-inchi-polymer-option]")
        .forEach((input) => {
          input.disabled = !this.checked;
        });
      document
        .getElementById(tabDivId)
        .querySelector('input.form-check-input[data-id="NPZz"]').checked =
        this.checked;
    });

    /*
     * Register an on-click event on the "Reset InChI Options" link.
     */
    this.querySelector("[data-reset-inchi-options]")?.addEventListener(
      "click",
      function () {
        resetInchiOptions(tabDivId);
        updateFunction();
      },
    );

    /*
     * Assign ids to all <input> elements and assign the target id of their
     * <label> element accordingly. Also register an on-change event to call
     * updateFunction.
     */
    this.querySelectorAll("input.form-check-input").forEach((input) => {
      input.id = input.dataset.id + "-" + tabDivId;
      const label = input.nextElementSibling;
      if (label instanceof HTMLLabelElement) {
        label.htmlFor = input.id;
      } else {
        console.error(`No label follows the "${input.dataset.id}" option.`);
      }

      input.addEventListener("change", updateFunction);
    });

    /*
     * Initialize the Bootstrap Multiselect widget for tautomer options if it exists.
     */
    $(this)
      .find("select[data-tautomer-multiselect]")
      .multiselect({
        buttonContainer: '<div class="btn-group mw-100"></div>',
        includeSelectAllOption: true,
        nonSelectedText: "Tautomer options",
        numberDisplayed: 1,
        onChange: () => updateFunction(),
        onDeselectAll: () => updateFunction(),
        onSelectAll: () => updateFunction(),
        // Workaround for Bootstrap 5
        templates: {
          button:
            '<button type="button" class="form-select multiselect dropdown-toggle" data-bs-toggle="dropdown"><span class="multiselect-selected-text"></span></button>',
        },
      });

    /*
     * Initialize Bootstrap tooltips
     */
    [...this.querySelectorAll('[data-bs-toggle="tooltip"]')].map(
      (tooltipTriggerEl) => {
        new bootstrap.Tooltip(tooltipTriggerEl);
      },
    );
  }
}
class InChIOptions106Element extends InChIOptionsElement {
  constructor() {
    super();
    this.componentPaths = [
      "components/options/106-options.html",
      "components/options/stereo-base-options.html",
      "components/options/base-options.html",
    ];
  }
}
class InChIOptions1075Element extends InChIOptionsElement {
  constructor() {
    super();
    this.componentPaths = [
      "components/options/tautomer-options.html",
      "components/options/stereo-base-options.html",
      "components/options/base-options.html",
    ];
  }
}
class InChIOptionsDevElement extends InChIOptionsElement {
  constructor() {
    super();
    this.componentPaths = [
      "components/options/tautomer-options.html",
      "components/options/stereo-base-options.html",
      "components/options/base-options.html",
    ];
  }
}
class InChIOptionsDevMoInElement extends InChIOptionsElement {
  constructor() {
    super();
    this.componentPaths = [
      "components/options/tautomer-options.html",
      "components/options/latest-moin-options.html",
      "components/options/stereo-base-options.html",
      "components/options/base-options.html",
    ];
  }
}
class InChIOptionsDevEnhancedStereoElement extends InChIOptionsElement {
  constructor() {
    super();
    this.componentPaths = [
      "components/options/tautomer-options.html",
      "components/options/latest-enhanced-stereo-options.html",
      "components/options/base-options.html",
    ];
  }
}
class InChIOptionsNoMetalH extends InChIOptionsElement {
  constructor() {
    super();
    this.componentPaths = [
      "components/options/tautomer-options.html",
      "components/options/latest-moin-options.html",
      "components/options/stereo-base-options.html",
      "components/options/base-options.html",
    ];
  }
}
class InChIOptionsExplicitZeroValence extends InChIOptionsElement {
  constructor() {
    super();
    this.componentPaths = [
      "components/options/tautomer-options.html",
      "components/options/latest-moin-options.html",
      "components/options/stereo-base-options.html",
      "components/options/base-options.html",
    ];
  }
}

function createAnnotation(text, color) {
  const annotation = document.createElement("div");
  annotation.textContent = text;
  annotation.classList.add(color);
  annotation.classList.add("active");
  annotation.style.color = "black";
  annotation.style.fontWeight = "500";
  annotation.style.paddingLeft = "1%";
  annotation.style.paddingRight = "1%";

  return annotation;
}

function getAnnotationData(inchi, auxinfo) {
  // Returns a map of maps of maps. Innermost maps can be empty.

  const canonicalAtomIndicesByComponents =
    parseCanonicalAtomIndicesByComponents(auxinfo);

  const inchiParsed = parseInchi(inchi, canonicalAtomIndicesByComponents);
  const auxinfoParsed = parseAuxinfo(auxinfo, canonicalAtomIndicesByComponents);

  const annotationData = new Map();

  annotationData.set("canonicalIndex", auxinfoParsed.get("N"));
  annotationData.set("equivalenceClass", auxinfoParsed.get("E"));
  annotationData.set("hydrogenGroup", inchiParsed.get("h"));
  annotationData.set(
    "hydrogenGroupClass",
    mapCanonicalAtomIndicesToMobileHydrogenGroupClasses(
      annotationData.get("hydrogenGroup"),
      auxinfoParsed.get("gE"),
    ),
  );

  return annotationData;
}

function getStructureKey(inchi, auxinfo) {
  if (
    Object.prototype.toString.call(inchi) !== "[object String]" ||
    Object.prototype.toString.call(auxinfo) !== "[object String]"
  ) {
    return undefined;
  }

  return inchi + auxinfo;
}

class NGLViewerElement extends HTMLElement {
  constructor() {
    super();

    this.annotationColors = {
      index: "annotation-index",
      canonicalIndex: "annotation-canonical-index",
      equivalenceClass: "annotation-equivalence-class",
      hydrogenGroup: "annotation-hydrogen-group",
      hydrogenGroupClass: "annotation-hydrogen-group-class",
    };

    const annotationButtonTexts = {
      index: "Index",
      canonicalIndex: "Canonical Index",
      equivalenceClass: "Equivalence Class",
      hydrogenGroup: "Hydrogen Group",
      hydrogenGroupClass: "Hydrogen Group Class",
    };

    const annotationButtonInfo = {
      index: "Order of atoms in the molfile's atom block.",
      canonicalIndex: "Indices assigned by the canonicalization.",
      equivalenceClass:
        "Atoms within an equivalence class are indistinguishable, ignoring stereochemistry; a class is identified by the smallest canonical index in the class.",
      hydrogenGroup:
        "If there are multiple components, groups start at 1 for each component.",
      hydrogenGroupClass:
        "If there are multiple components, group-classes start at 1 for each component.",
    };

    this.annotationButtons = Object.keys(this.annotationColors).map((id) => ({
      id,
      text: annotationButtonTexts[id],
      color: this.annotationColors[id],
      info: annotationButtonInfo[id],
    }));

    this.annotationSelection = Object.fromEntries(
      Object.keys(this.annotationColors).map((id) => [id, false]),
    );

    /*
     * Classes, not ids: this component is rendered in more than one tab, and
     * duplicate ids in a document are invalid and resolve to the first match.
     */
    // Sizing lives in css/index.css so it can respond to the viewport.
    this.innerHTML = `<div class="annotation-selection mt-2"></div>
      <div class="ngl-viewport"></div>`;

    this.stage = undefined;
    this.structure = undefined;
    this.structureKey = undefined;
    this.annotationData = undefined;
    this.annotationSelectionElement = undefined;
  }

  /*
   * NGL is 1.3 MB and only two of the eight tabs render a structure, so the
   * library and its stage are created the first time one is actually needed.
   * Returns false when the viewer cannot run at all.
   */
  async ensureStage() {
    if (this.stagePromise === undefined) {
      this.stagePromise = (async () => {
        const viewportElement = this.querySelector(".ngl-viewport");
        try {
          await loadScriptOnce("ngl/ngl.js");
        } catch (error) {
          console.error(error);
          viewportElement.textContent =
            "The 3D viewer could not be loaded. Please reload the page (CTRL + F5).";
          return false;
        }

        this.stage = new NGL.Stage(viewportElement, {
          backgroundColor: "white",
        });

        /*
         * NGL prints its own "no WebGL" notice into the viewport, but its
         * renderer is then undefined: resizing or loading a structure would
         * throw on every call.
         */
        if (!this.stage.viewer?.renderer) {
          console.error("NGL could not initialize a WebGL renderer.");
          return false;
        }

        const resizeObserver = new ResizeObserver(() =>
          this.stage.handleResize(),
        );
        resizeObserver.observe(viewportElement);
        return true;
      })();
    }
    return this.stagePromise;
  }

  connectedCallback() {
    this.annotationSelectionElement =
      this.querySelector(".annotation-selection");
    this.annotationButtons.forEach((button) => {
      const buttonElement = document.createElement("button");
      buttonElement.type = "button";
      buttonElement.dataset.annotation = button.id;
      buttonElement.textContent = button.text;
      buttonElement.classList.add(button.color);
      buttonElement.classList.add("annotation-button");
      buttonElement.disabled = true;
      buttonElement.title = button.info;
      // These are toggles: the pressed state has to be exposed, not just painted.
      buttonElement.setAttribute("aria-pressed", "false");

      buttonElement.addEventListener("click", () => {
        const isActive = buttonElement.classList.toggle("active");
        buttonElement.setAttribute("aria-pressed", String(isActive));
        this.annotationSelection[button.id] = isActive;
        this.annotateStructure();
      });

      this.annotationSelectionElement.appendChild(buttonElement);
    });
  }

  async loadStructure(molfile, inchi, auxinfo) {
    if (this.structureKey === getStructureKey(inchi, auxinfo)) {
      return;
    }
    if (!(await this.ensureStage())) {
      return;
    }

    this.stage.removeAllComponents();

    const molfileBlob = new Blob([molfile], { type: "text/plain" });
    try {
      this.structure = await this.stage.loadFile(molfileBlob, { ext: "sdf" });
      this.structure.addRepresentation("ball+stick", {
        multipleBond: "symmetric",
      });
      this.annotationData = getAnnotationData(inchi, auxinfo);
      this.structureKey = getStructureKey(inchi, auxinfo);
      this.annotationButtons.forEach((button) => {
        const buttonElement = this.annotationSelectionElement.querySelector(
          `[data-annotation="${button.id}"]`,
        );
        const annotationAvailable =
          button.id === "index"
            ? true
            : this.annotationData.get(button.id).size > 0;
        buttonElement.disabled = !annotationAvailable;
        buttonElement.classList.remove("active");
        buttonElement.setAttribute("aria-pressed", "false");
      });
      this.annotationSelection = Object.fromEntries(
        Object.keys(this.annotationColors).map((id) => [id, false]),
      );

      this.structure.autoView();
    } catch (error) {
      console.error("The structure could not be rendered", error);
      this.structure = undefined;
      this.structureKey = undefined;
      this.annotationData = undefined;
      this.annotationButtons.forEach((button) => {
        const buttonElement = this.annotationSelectionElement.querySelector(
          `[data-annotation="${button.id}"]`,
        );
        buttonElement.disabled = true;
        buttonElement.classList.remove("active");
        buttonElement.setAttribute("aria-pressed", "false");
      });
    }
  }

  annotateStructure() {
    if (!(this.structure && this.annotationData)) {
      return;
    }

    this.structure.removeAllAnnotations();
    this.structure.structure.eachAtom((atom) => {
      const annotations = document.createElement("div");
      annotations.style.display = "flex";
      annotations.style.height = "20px";

      const atomIndex = atom.index + 1;
      const canonicalIndex = this.annotationData
        .get("canonicalIndex")
        .get(atomIndex);
      const equivalenceClass = this.annotationData
        .get("equivalenceClass")
        .get(canonicalIndex);
      const hydrogenGroup = this.annotationData
        .get("hydrogenGroup")
        .get(canonicalIndex);
      const hydrogenGroupClass = this.annotationData
        .get("hydrogenGroupClass")
        .get(canonicalIndex);

      if (this.annotationSelection.index) {
        annotations.appendChild(
          createAnnotation(atomIndex, this.annotationColors.index),
        );
      }

      if (canonicalIndex && this.annotationSelection.canonicalIndex) {
        annotations.appendChild(
          createAnnotation(
            canonicalIndex,
            this.annotationColors.canonicalIndex,
          ),
        );
      }

      if (equivalenceClass && this.annotationSelection.equivalenceClass) {
        annotations.appendChild(
          createAnnotation(
            equivalenceClass,
            this.annotationColors.equivalenceClass,
          ),
        );
      }
      if (hydrogenGroup && this.annotationSelection.hydrogenGroup) {
        annotations.appendChild(
          createAnnotation(hydrogenGroup, this.annotationColors.hydrogenGroup),
        );
      }
      if (hydrogenGroupClass && this.annotationSelection.hydrogenGroupClass) {
        annotations.appendChild(
          createAnnotation(
            hydrogenGroupClass,
            this.annotationColors.hydrogenGroupClass,
          ),
        );
      }

      this.structure.addAnnotation(atom.positionToVector3(), annotations);
    });
    this.structure.setVisibility(true); // Re-render the structure.
  }
}

customElements.define("inchi-about", AboutElement);
customElements.define("inchi-inchi-tools", InChIToolsElement);
customElements.define("report-mask", ReportMaskElement);
customElements.define("feedback-dialog", FeedbackDialogElement);
customElements.define("inchi-rinchi-tools", RInChIToolsElement);
customElements.define("inchi-version-selection", InChIVersionSelectionElement);
customElements.define("inchi-result-field", InChIResultFieldElement);
customElements.define("inchi-options-106", InChIOptions106Element);
customElements.define("inchi-options-1075", InChIOptions1075Element);
customElements.define("inchi-options-dev", InChIOptionsDevElement);
customElements.define(
  "inchi-options-dev-moin",
  InChIOptionsDevMoInElement,
);
customElements.define(
  "inchi-options-dev-enhanced-stereo",
  InChIOptionsDevEnhancedStereoElement,
);
customElements.define(
  "inchi-options-no-metal-h",
  InChIOptionsNoMetalH,
);
customElements.define(
  "inchi-options-explicit-zero-valence",
  InChIOptionsExplicitZeroValence
);
customElements.define("inchi-ngl-viewer", NGLViewerElement);
