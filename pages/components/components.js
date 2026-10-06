/*
 * Suffix every id below `root` and rewrite the attributes that point at them.
 * A component rendered more than once ships the same static markup several
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
    }
  );
}

/*
 * Fetch an HTML fragment, revalidating it and reusing the result.
 *
 * These fragments are pulled in from JS rather than linked from index.html, so
 * a hard reload does not necessarily refresh them and the browser can pair a
 * new stylesheet with a stale fragment. "no-cache" forces a conditional
 * request; memoising by URL fetches a shared template only once.
 */
const fragmentCache = new Map();

function loadFragment(path) {
  if (!fragmentCache.has(path)) {
    fragmentCache.set(
      path,
      fetch(path, { cache: "no-cache" }).then((response) => {
        if (!response.ok) {
          // Not cached as a failure: another instance may succeed on retry.
          fragmentCache.delete(path);
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return response.text();
      })
    );
  }
  return fragmentCache.get(path);
}

class InsertHTMLElement extends HTMLElement {
  constructor(htmlPath) {
    super();
    this.htmlPath = htmlPath;
  }

  async connectedCallback() {
    try {
      this.innerHTML = await loadFragment(this.htmlPath);
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

class ReportMaskElement extends InsertHTMLElement {
  constructor() {
    super("components/report-mask.html");
  }

  async connectedCallback() {
    await super.connectedCallback();

    this.dialog = this.querySelector("dialog");
    this.openBtn = this.querySelector(".mask-open");
    this.submitBtn = this.querySelector(".mask-submit");
    this.form = this.querySelector("form");
    this.nameInput = this.querySelector(".mask-name");
    this.descriptionInput = this.querySelector(".mask-description");

    this.openBtn.addEventListener("click", () => this.open());
    this.querySelector(".mask-close").addEventListener("click", () =>
      this.dialog.close()
    );
    this.querySelector(".mask-cancel").addEventListener("click", () =>
      this.dialog.close()
    );
    this.form.addEventListener("submit", (event) => this.submit(event));
  }

  open() {
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
    const textOrNull = (id) => {
      const el = document.getElementById(id);
      return el && el.textContent && el.textContent.trim()
        ? el.textContent.trim()
        : null;
    };

    /*
     * A pasted molfile is reported verbatim rather than re-serialized by the
     * editor, so a bug living in the file is not normalised away.
     */
    let molfile_v2 = null;
    let molfile_v3 = null;
    const pastedMolfile =
      conversionSource !== "paste"
        ? null
        : pastedInput.kind === "molfile"
          ? pastedInput.text
          : pastedInput.kind === "sdf"
            ? firstSdfRecord(pastedInput.text)
            : null;

    if (pastedMolfile !== null) {
      /* V3000 declares itself on the counts line; the library reads either. */
      if (/V3000/.test(pastedMolfile)) {
        molfile_v3 = pastedMolfile;
      } else {
        molfile_v2 = pastedMolfile;
      }
    } else {
      const ketcher = getKetcher("workbench-ketcher");
      if (ketcher) {
        molfile_v2 = await getMolfileFromKetcher(ketcher, "v2000");
        molfile_v3 = await getMolfileFromKetcher(ketcher, "v3000");
      }
    }

    const inchi = textOrNull("workbench-inchi");
    const inchikey = textOrNull("workbench-inchikey");
    const auxinfo = textOrNull("workbench-auxinfo");
    const log = textOrNull("workbench-logs");
    const cleanedLog =
      log && log.startsWith("InChI options: ")
        ? log.replace(/^InChI options: [^\n]*\n?/, "")
        : log;
    const inchi_version = getVersion();

    let options = "";
    try {
      options = getInchiOptions(optionsPanel())
        .map((o) => "-" + o)
        .join(" ");
    } catch (err) {
      options = "";
    }

    const { name, description } = data;

    /*
     * Pasted input that no molfile field can carry (AuxInfo, a reaction file,
     * a RInChI) rides in the description: the endpoint has no field for it.
     */
    const pasted =
      conversionSource === "paste" && pastedMolfile === null
        ? `\n\n--- Converted input (${pastedInput.kind}), verbatim ---\n${pastedInput.text}`
        : "";

    const payload = {
      input_source: "WebDemo",
      inchi_version: inchi_version,
      user: name || null,
      description: (description ?? "") + pasted,
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
      new CustomEvent("reportMask:json", { detail: payload })
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
        }
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

    // Keep the text on failure so the submission can be retried.
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
        glyph: "check-lg",
        title: "Report submitted",
        message:
          "Thank you for your report. It has been received and will be reviewed shortly.",
      },
      error: {
        iconClass: "error",
        glyph: "x-lg",
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
    this.glyphEl.className = "feedback-glyph";
    this.glyphEl.innerHTML = icon(state.glyph);
    this.titleEl.textContent = state.title;
    this.messageEl.textContent = msg
      ? `${state.message} ${msg}`
      : state.message;
    this.dialog.showModal();
    this.confirmBtn.focus();
  }
}

class InChIWorkbenchElement extends InsertHTMLElement {
  constructor() {
    super("components/workbench.html");
  }

  async connectedCallback() {
    await super.connectedCallback();

    /*
     * addInchiOptionsForm, not updateInchiOptions: the latter runs a
     * conversion before the Ketcher iframe has loaded. The first conversion
     * is driven by onKetcherLoaded's `change` subscription.
     */
    await addInchiOptionsForm(() => updateWorkbench());

    // There is one RInChI build, so its version is stated once.
    this.querySelectorAll(".rinchi-version").forEach((span) => {
      span.textContent = `Computed with RInChI version ${RINCHI_VERSION}`;
    });
  }
}

class InChIVersionSelectionElement extends HTMLElement {
  constructor() {
    super();
    this.onVersionChange = new Function(this.getAttribute("onVersionChange"));
  }

  async connectedCallback() {
    // The version list is fetched and may not be loaded yet when this connects.
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

    const dropdownId = "version-dropdown";

    this.innerHTML = `<div class="bounding-box">
      <h2 class="inchi-section-heading" id="version-heading">
        InChI version
      </h2>
      <label class="visually-hidden" for="${dropdownId}">InChI version</label>
      <select id="${dropdownId}" class="form-select form-select-sm mt-1" data-version></select>
      <p class="version-commit apparatus mt-2 mb-0"></p>
    </div>`;

    const dropdown = this.querySelector("select[data-version]");
    const commitLink = this.querySelector(".version-commit");

    // The grouping is derived from the URL rather than stored in inchi_versions.json.
    const groupFor = (url) => {
      if (typeof url !== "string") {
        return "Other builds";
      }
      if (url.includes("/releases/tag/")) {
        return "Released";
      }
      if (url.includes("/pull/")) {
        return "Open pull requests";
      }
      return "Development builds";
    };

    const groupOrder = [
      "Released",
      "Development builds",
      "Open pull requests",
      "Other builds",
    ];
    const groups = new Map(groupOrder.map((name) => [name, []]));

    for (const [versionName, versionConfig] of Object.entries(
      availableInchiVersions
    )) {
      groups.get(groupFor(versionConfig.url)).push([versionName, versionConfig]);
    }

    for (const groupName of groupOrder) {
      const entries = groups.get(groupName);
      if (entries.length === 0) {
        continue;
      }
      const optgroup = document.createElement("optgroup");
      optgroup.label = groupName;
      for (const [versionName, versionConfig] of entries) {
        const option = document.createElement("option");
        option.textContent = versionName;
        option.value = versionName;
        option.selected = Boolean(versionConfig.default);
        optgroup.appendChild(option);
      }
      dropdown.appendChild(optgroup);
    }

    const showCommitLink = (versionName) => {
      const url = availableInchiVersions[versionName].url;
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      const group = groupFor(url);
      const pull = url.match(/\/pull\/(\d+)/);
      link.textContent = pull
        ? `Pull request #${pull[1]}`
        : group === "Released"
          ? `${versionName} release notes`
          : "Source revision";
      commitLink.replaceChildren(
        document.createTextNode(`${group} · `),
        link
      );
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
     * Results arrive without a user action, so the fields that carry the
     * outcome announce themselves. Opt-in, so one edit is not announced by
     * every field.
     */
    const live = this.hasAttribute("live")
      ? ' aria-live="polite" aria-atomic="false"'
      : "";

    /*
     * `notation` turns the plain text sink into a keyed notation view: "inchi"
     * splits the string into its layers, "inchikey" into its three blocks.
     * Fields without it (AuxInfo, the log, RInChI file text) stay as a <pre>,
     * because their content has no layer grammar to reveal.
     */
    this.notation = this.getAttribute("notation") ?? "";

    /*
     * The <pre> is the single source of truth for the text. When a notation
     * view is rendered from it, the <pre> is hidden so a screen reader does
     * not read the identifier twice.
     */
    const hidden =
      this.notation || this.hasAttribute("placeholder") ? " hidden" : "";
    const viewLive = this.notation ? live : "";
    const preLive = this.notation ? "" : live;

    this.innerHTML = `<div class="identifier-plate notation-frame">
      <div class="identifier-head">
        <span class="apparatus">${escapeHtml(this.fieldTitle)}</span>
        <span class="d-flex align-items-center gap-2">
          <span class="version-stamp" data-version-stamp hidden></span>
          <span class="btn-group" role="group">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary result-copy"
              aria-label="Copy ${escapeHtml(this.fieldTitle)} to clipboard"
              disabled
            >
              ${icon("clipboard")}
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary result-download"
              aria-label="Download ${escapeHtml(this.fieldTitle)} as a text file"
              disabled
            >
              ${icon("download")}
            </button>
          </span>
        </span>
      </div>
      <div class="identifier-view"${viewLive}${hidden ? "" : " hidden"}></div>
      <pre id="${this._id}" class="py-1 px-3 mb-0 inchi-result-text" style="max-height: 500px"${preLive}${hidden}></pre>
    </div>`;

    const resultText = this.querySelector(`#${this._id}`);
    const view = this.querySelector(".identifier-view");
    const stamp = this.querySelector("[data-version-stamp]");
    const copyButton = this.querySelector(".result-copy");
    const downloadButton = this.querySelector(".result-download");

    copyButton.addEventListener("click", async () => {
      const iconHost = copyButton;
      try {
        await navigator.clipboard.writeText(resultText.innerText.trim());
        iconHost.innerHTML = icon("clipboard-check");
        copyButton.setAttribute("aria-label", "Copied to clipboard");
      } catch (error) {
        /*
         * Blocked permission or an insecure context: say so instead of leaving
         * the user to wonder whether the copy worked.
         */
        console.error("Copy to clipboard failed", error);
        iconHost.innerHTML = icon("clipboard-x");
        copyButton.setAttribute(
          "aria-label",
          "Copying failed — select the text and copy manually"
        );
      }
      setTimeout(() => {
        iconHost.innerHTML = icon("clipboard");
        copyButton.setAttribute(
          "aria-label",
          `Copy ${this.fieldTitle} to clipboard`
        );
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
      // Colons are not allowed in Windows filenames.
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `${this.fieldTitle}_${timestamp}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    /*
     * Driven by a MutationObserver rather than by the callers, so every path
     * that writes a result gets the same rendering.
     */
    const placeholder = this.getAttribute("placeholder") ?? "";

    const renderNotation = () => {
      const text = resultText.textContent.trim();

      if (text === "") {
        if (placeholder === "") {
          view.replaceChildren();
          view.hidden = true;
          return;
        }
        view.innerHTML = `<p class="plate-empty">${escapeHtml(
          placeholder
        )}</p>`;
        view.hidden = false;
        resultText.hidden = true;
        return;
      }

      if (!this.notation) {
        view.replaceChildren();
        view.hidden = true;
        resultText.hidden = false;
        return;
      }

      const rows = this.buildNotationRows(text);
      if (rows === null) {
        // Not a well-formed identifier, e.g. an error message or a batch.
        view.innerHTML = `<div class="layer-value px-3 py-2">${escapeHtml(
          text
        )}</div>`;
      } else {
        view.innerHTML = rows;
      }
      view.hidden = false;
      resultText.hidden = true;
    };

    const toggleButtonState = () => {
      const resultAvailable = resultText.textContent.trim().length > 0;
      copyButton.disabled = !resultAvailable;
      downloadButton.disabled = !resultAvailable;
      stamp.hidden = !resultAvailable || stamp.textContent === "";
    };

    const update = () => {
      toggleButtonState();
      renderNotation();
    };

    const observer = new MutationObserver(update);
    observer.observe(resultText, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    update();
  }

  /*
   * Set at the end of a conversion rather than read from the selector, which
   * already shows the new version while a switch is in flight.
   */
  setVersionStamp(version) {
    const stamp = this.querySelector("[data-version-stamp]");
    if (!stamp) {
      return;
    }
    stamp.textContent = version ?? "";
    const hasText =
      this.querySelector(`#${this._id}`).textContent.trim().length > 0;
    stamp.hidden = !version || !hasText;
  }

  /* Mark this plate as showing a result that a newer conversion is replacing. */
  setStale(isStale) {
    this.querySelector(".identifier-plate")?.classList.toggle(
      "identifier-plate-stale",
      Boolean(isStale)
    );
  }

  /*
   * Build the keyed rows for this field's notation, or null when the text is
   * not a single well-formed identifier.
   */
  buildNotationRows(text) {
    // The complete identifier is selectable as one run, ahead of its layers.
    const completeRow =
      `<div class="layer-key">Complete</div>` +
      `<div class="layer-value layer-value-complete">${escapeHtml(text)}</div>`;

    if (this.notation === "inchikey") {
      const blocks = parseInchikeyBlocks(text);
      if (blocks.length === 0) {
        return null;
      }
      const cells = blocks
        .map(
          (block) =>
            `<span class="inchikey-block"><span>${escapeHtml(
              block.value
            )}</span><span class="apparatus">${escapeHtml(
              block.name
            )}</span></span>`
        )
        .join('<span class="inchikey-separator">-</span>');
      return (
        `<div class="identifier-layers">${completeRow}</div>` +
        `<div class="inchikey-blocks">${cells}</div>`
      );
    }

    const parsed = parseInchiLayers(text);
    if (parsed.layers.length === 0) {
      return null;
    }

    const rows = [completeRow];

    for (const layer of parsed.layers) {
      const letter = layerMark(layer.key);
      rows.push(
        `<div class="layer-key"><span class="layer-letter">${escapeHtml(
          letter
        )}</span> ${escapeHtml(layer.name)}</div>`,
        `<div class="layer-value">${escapeHtml(layer.value)}</div>`
      );
    }

    return `<div class="identifier-layers">${rows.join("")}</div>`;
  }
}

/*
 * A "?" (or "!") button that opens an explanation of the option next to it.
 * The element's children are the explanation. It sits after the option's
 * <label>, never inside it: the popover would otherwise be a label descendant,
 * so clicking its prose would toggle the checkbox, and it would land in the
 * label's text.
 *
 *   <inchi-option-help label="What “X” does"><p>…</p></inchi-option-help>
 */
let optionHelpCount = 0;

class InChIOptionHelpElement extends HTMLElement {
  connectedCallback() {
    if (this.querySelector(":scope > .option-help")) {
      return;
    }

    const panel = document.createElement("div");
    panel.id = `option-help-${++optionHelpCount}`;
    panel.setAttribute("popover", "");
    panel.className = "option-help-panel";
    panel.append(...this.childNodes);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-help";
    button.setAttribute("popovertarget", panel.id);
    button.setAttribute("aria-label", this.getAttribute("label"));
    button.textContent = this.getAttribute("mark") ?? "?";

    this.append(button, panel);
  }
}

class InChIOptionsElement extends HTMLElement {
  constructor() {
    super();
  }

  async postCreate(updateFunction, inchiVersion) {
    const htmlFragments = await Promise.all(
      this.componentPaths.map(async (path) => {
        try {
          return await loadFragment(path);
        } catch (error) {
          console.error(`Error loading ${path}`, error);
          return `<p class="alert alert-warning" role="alert">Some options
            could not be loaded. Please reload the page (CTRL + F5).</p>`;
        }
      })
    );

    /*
     * Collapsed when the layout stacks, so the options do not sit between
     * editor and results. Closed inputs stay in the DOM, so getInchiOptions()
     * still reads them.
     */
    const boundingBox = document.createElement("details");
    boundingBox.setAttribute("class", "bounding-box");
    boundingBox.innerHTML =
      '<summary><h2 class="inchi-section-heading">InChI options</h2>' +
      '<span class="options-changed-count apparatus" data-changed-count hidden></span>' +
      "</summary>" +
      htmlFragments.join("");

    /*
     * Follow the layout until the visitor toggles the panel by hand.
     * INCHI_STACK_BREAKPOINT (index.js) is where the tool grid stacks.
     */
    const stacked = window.matchMedia(
      `(max-width: ${INCHI_STACK_BREAKPOINT - 0.02}px)`
    );
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

    /*
     * Both blocks below tolerate a missing input: a fragment that failed to
     * load above is replaced by a warning, and must not take the rest of
     * postCreate (the radio group, the change listeners) down with it.
     */
    const npzz = this.querySelector('input[data-id="NPZz"]');
    if (versionBehavior(inchiVersion).checkNPZzByDefault && npzz) {
      npzz.checked = true;
      npzz.setAttribute("data-default-checked", ""); // A default: "Reset" restores it.
    }

    /*
     * The polymer build exists to exercise polymer handling, so its polymer
     * options start on and enabled instead of behind "Treat polymers".
     */
    if (versionBehavior(inchiVersion).polymerOptionsOn) {
      const treatPolymers = this.querySelector(
        'input[data-id="treatPolymers"]'
      );
      if (treatPolymers) {
        treatPolymers.checked = true;
        treatPolymers.setAttribute("data-default-checked", "");
      }

      this.querySelectorAll(
        "input.form-check-input[data-inchi-polymer-option]"
      ).forEach((input) => {
        input.disabled = false;
        input.removeAttribute("data-default-disabled");
      });
    }

    this.querySelector(
      'input.form-check-input[data-id="includeStereo"]',
      // Optional: an options template is free to leave the checkbox out.
    )?.addEventListener("change", function () {
      optionsPanel()
        .querySelectorAll("input.form-check-input[data-inchi-stereo-option]")
        .forEach((input) => {
          input.disabled = !this.checked;
        });
    });

    this.querySelector(
      'input.form-check-input[data-id="treatPolymers"]'
    )?.addEventListener("change", function () {
      const panel = optionsPanel();
      panel
        .querySelectorAll("input.form-check-input[data-inchi-polymer-option]")
        .forEach((input) => {
          input.disabled = !this.checked;
        });
      panel.querySelector('input.form-check-input[data-id="NPZz"]').checked =
        this.checked;
    });

    this.querySelector("[data-reset-inchi-options]")?.addEventListener(
      "click",
      function () {
        resetInchiOptions(optionsPanel());
        updateChangedOptionCount();
        updateFunction();
      }
    );

    this.querySelectorAll("input.form-check-input").forEach((input) => {
      input.id = input.dataset.id;
      const label = input.nextElementSibling;
      if (label instanceof HTMLLabelElement) {
        label.htmlFor = input.id;
      } else {
        console.error(`No label follows the "${input.dataset.id}" option.`);
      }

      input.addEventListener("change", updateFunction);
    });
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
  /*
   * The toggle chip carries the same colour class, so the fill is scoped to
   * `annotation-label` to keep it off the chip.
   */
  annotation.classList.add("annotation-label");
  annotation.classList.add(color);

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
      auxinfoParsed.get("gE")
    )
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
      Object.keys(this.annotationColors).map((id) => [id, false])
    );

    /*
     * A labelled group, so the buttons read as independent overlays rather
     * than a tab strip. Explanations live in a <details>, not a title
     * attribute, which is mouse-only.
     */
    this.innerHTML = `<h3 class="inchi-section-heading mt-3">Atom annotations</h3>
      <fieldset class="annotation-selection mt-1">
        <legend class="visually-hidden">Atom annotations to overlay</legend>
      </fieldset>
      <details class="mt-1">
        <summary class="apparatus">What these mean</summary>
        <dl class="annotation-legend mt-1 mb-0 small"></dl>
      </details>
      <div class="ngl-viewport mt-2"></div>`;

    this.stage = undefined;
    this.structure = undefined;
    this.structureKey = undefined;
    this.annotationData = undefined;
    this.annotationSelectionElement = undefined;
  }

  /*
   * NGL is large, so the library and its stage are created the first time a
   * structure is shown. Returns false when the viewer cannot run at all.
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
          this.stage.handleResize()
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
    const legend = this.querySelector(".annotation-legend");

    this.annotationButtons.forEach((button) => {
      const buttonElement = document.createElement("button");
      buttonElement.type = "button";
      buttonElement.dataset.annotation = button.id;
      buttonElement.classList.add(button.color);
      buttonElement.classList.add("annotation-button");
      buttonElement.disabled = true;

      const swatch = document.createElement("span");
      swatch.className = "annotation-swatch";
      buttonElement.append(swatch, document.createTextNode(button.text));

      // These are toggles: the pressed state has to be exposed, not just painted.
      buttonElement.setAttribute("aria-pressed", "false");

      buttonElement.addEventListener("click", () => {
        const isActive = buttonElement.classList.toggle("active");
        buttonElement.setAttribute("aria-pressed", String(isActive));
        this.annotationSelection[button.id] = isActive;
        this.annotateStructure();
      });

      this.annotationSelectionElement.appendChild(buttonElement);

      const term = document.createElement("dt");
      term.className = "apparatus";
      term.textContent = button.text;
      const description = document.createElement("dd");
      description.className = "mb-2";
      description.textContent = button.info;
      legend.append(term, description);
    });
  }

  /* Put the annotation buttons back to "nothing to annotate". */
  resetAnnotationButtons() {
    this.annotationButtons.forEach((button) => {
      const buttonElement = this.annotationSelectionElement.querySelector(
        `[data-annotation="${button.id}"]`
      );
      buttonElement.disabled = true;
      buttonElement.classList.remove("active");
      buttonElement.setAttribute("aria-pressed", "false");
    });
  }

  /*
   * structureKey must be cleared too: loadStructure returns early when the
   * key matches, so the same structure could not be drawn again.
   */
  clearStructure() {
    this.structure = undefined;
    this.structureKey = undefined;
    this.annotationData = undefined;
    this.stage?.removeAllComponents();
    this.resetAnnotationButtons();
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
          `[data-annotation="${button.id}"]`
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
        Object.keys(this.annotationColors).map((id) => [id, false])
      );

      this.structure.autoView();
    } catch (error) {
      console.error("The structure could not be rendered", error);
      this.structure = undefined;
      this.structureKey = undefined;
      this.annotationData = undefined;
      this.resetAnnotationButtons();
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
          createAnnotation(atomIndex, this.annotationColors.index)
        );
      }

      if (canonicalIndex && this.annotationSelection.canonicalIndex) {
        annotations.appendChild(
          createAnnotation(canonicalIndex, this.annotationColors.canonicalIndex)
        );
      }

      if (equivalenceClass && this.annotationSelection.equivalenceClass) {
        annotations.appendChild(
          createAnnotation(
            equivalenceClass,
            this.annotationColors.equivalenceClass
          )
        );
      }
      if (hydrogenGroup && this.annotationSelection.hydrogenGroup) {
        annotations.appendChild(
          createAnnotation(hydrogenGroup, this.annotationColors.hydrogenGroup)
        );
      }
      if (hydrogenGroupClass && this.annotationSelection.hydrogenGroupClass) {
        annotations.appendChild(
          createAnnotation(
            hydrogenGroupClass,
            this.annotationColors.hydrogenGroupClass
          )
        );
      }

      this.structure.addAnnotation(atom.positionToVector3(), annotations);
    });
    this.structure.setVisibility(true); // Re-render the structure.
  }
}

customElements.define("inchi-workbench", InChIWorkbenchElement);
customElements.define("report-mask", ReportMaskElement);
customElements.define("feedback-dialog", FeedbackDialogElement);
customElements.define("inchi-version-selection", InChIVersionSelectionElement);
customElements.define("inchi-result-field", InChIResultFieldElement);
customElements.define("inchi-option-help", InChIOptionHelpElement);
customElements.define("inchi-options-106", InChIOptions106Element);
customElements.define("inchi-options-1075", InChIOptions1075Element);
customElements.define("inchi-options-dev", InChIOptionsDevElement);
customElements.define("inchi-options-dev-moin", InChIOptionsDevMoInElement);
customElements.define(
  "inchi-options-dev-enhanced-stereo",
  InChIOptionsDevEnhancedStereoElement
);
customElements.define("inchi-options-no-metal-h", InChIOptionsNoMetalH);
customElements.define(
  "inchi-options-explicit-zero-valence",
  InChIOptionsExplicitZeroValence
);
customElements.define("inchi-ngl-viewer", NGLViewerElement);
