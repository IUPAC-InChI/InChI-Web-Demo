class InsertHTMLElement extends HTMLElement {
  constructor(htmlPath) {
    super();
    this.htmlPath = htmlPath;
  }

  async connectedCallback() {
    let html = `<p>Error loading ${this.tagName}.</p>`;
    const response = await fetch(this.htmlPath);
    if (response.ok) {
      html = await response.text();
    }
    this.innerHTML = html;
  }
}

class AboutElement extends InsertHTMLElement {
  constructor() {
    super("components/about.html");
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
    [...document.querySelectorAll("#rinchi-version")].map((span) => {
      span.innerText = `Results computed with RInChI version ${RINCHI_VERSION}`;
    });
  }
}

class InChIVersionSelectionElement extends HTMLElement {
  constructor() {
    super();
    this.onVersionChange = new Function(this.getAttribute("onVersionChange"));
  }

  async connectedCallback() {
    this.innerHTML = `<div class="bounding-box">
      <h4>Version</h4>
      <select id="version-dropdown" style="display: block;" data-version></select>
      <span id="version-commit" style="display: block;"></span>
    </div>`;

    const dropdown = this.querySelector("#version-dropdown");
    const commitLink = this.querySelector("#version-commit");

    for (const [versionName, versionConfig] of Object.entries(
      availableInchiVersions
    )) {
      const option = document.createElement("option");
      option.innerHTML = versionName;
      option.value = versionName;
      option.selected = Boolean(versionConfig.default);
      dropdown.appendChild(option);
    }

    dropdown.addEventListener("change", (event) => {
      const selectedVersion = event.target.value;
      this.onVersionChange();
      const url = availableInchiVersions[selectedVersion].url;
      commitLink.innerHTML = `<a href=${url} target="_blank">${url}</a>`;
    });

    const url = availableInchiVersions[dropdown.value].url;
    commitLink.innerHTML = `<a href=${url} target="_blank">${url}</a>`;
  }
}

class InChIResultFieldElement extends HTMLElement {
  constructor() {
    super();
    this.title = this.getAttribute("title");
    this._id = this.getAttribute("id");
    this.setAttribute("id", `${this._id}-wrapper`); // Avoid "id" attribute name conflict with the pre element.
  }

  connectedCallback() {
    this.innerHTML = `<div class="mt-2 border rounded bg-light" style="--bs-bg-opacity: 0.3">
      <div
        class="border-bottom py-1 px-3 d-flex align-items-center justify-content-between"
      >
        <small class="font-monospace">${this.title}</small>
        <div class="btn-group" role="group">
          <button
            id=copy-button-${this._id}
            type="button"
            class="btn btn-sm btn-outline-secondary ms-auto"
            title="Copy to clipboard"
            disabled
          >
            <i class="bi bi-clipboard"></i>
          </button>
          <button
            id=download-button-${this._id}
            type="button"
            class="btn btn-sm btn-outline-secondary ms-auto"
            title="Download to text file"
            disabled
          >
            <i class="bi bi-download"></i>
          </button>
        </div>
      </div>
      <pre id="${this._id}" class="py-1 px-3 mb-0 inchi-result-text" style="max-height: 500px"></pre>
    </div>`;

    const resultText = this.querySelector(`#${this._id}`);
    const copyButton = this.querySelector(`#copy-button-${this._id}`);
    const downloadButton = this.querySelector(`#download-button-${this._id}`);

    copyButton.addEventListener("click", () => {
      navigator.clipboard.writeText(resultText.innerText.trim());
    });

    downloadButton.addEventListener("click", () => {
      const text = resultText.innerText.trim();
      if (!text) {
        alert("No InChI results to download.");
        return;
      }
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${this.title}_${new Date().toISOString()}.txt`; // Default filename
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

    const observer = new MutationObserver(toggleButtonState);
    observer.observe(resultText, {
      attributes: true,
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
      })
    );

    const boundingBox = document.createElement("div");
    boundingBox.setAttribute("class", "bounding-box");
    boundingBox.innerHTML = "<h4>Options</h4>" + htmlFragments.join("");
    this.appendChild(boundingBox);

    if (inchiVersion === "Latest with Molecular Inorganics") {
      this.querySelector('input[data-id="NPZz"]').checked = true;
    }

    /*
     * Reassign the name of the "stereoRadio" radio button group.
     */
    this.querySelectorAll(
      'input.form-check-input[type="radio"][name="stereoRadio"]'
    ).forEach((input) => {
      input.name = "stereoRadio-" + tabDivId;
    });

    /*
     * Register an on-change event on the "Include Stereo" checkbox to switch the
     * 'disabled' state of the inputs that cope with stereo options.
     */
    this.querySelector(
      'input.form-check-input[data-id="includeStereo"]'
    ).addEventListener("change", function () {
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
      'input.form-check-input[data-id="treatPolymers"]'
    ).addEventListener("change", function () {
      document
        .getElementById(tabDivId)
        .querySelectorAll("input.form-check-input[data-inchi-polymer-option]")
        .forEach((input) => {
          input.disabled = !this.checked;
        });
        document
        .getElementById(tabDivId)
        .querySelector('input.form-check-input[data-id="NPZz"]')
        .checked = this.checked;
    });

    /*
     * Register an on-click event on the "Reset InChI Options" link.
     */
    this.querySelector("a[data-reset-inchi-options]").addEventListener(
      "click",
      function () {
        resetInchiOptions(tabDivId);
        updateFunction();
      }
    );

    /*
     * Assign ids to all <input> elements and assign the target id of their
     * <label> element accordingly. Also register an on-change event to call
     * updateFunction.
     */
    this.querySelectorAll("input.form-check-input").forEach((input) => {
      input.id = input.dataset.id + "-" + tabDivId;
      input.nextElementSibling.htmlFor = input.id;

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
      }
    );
  }
}
class InChIOptions106Element extends InChIOptionsElement {
  constructor() {
    super();
    this.componentPaths = [
      "components/106-options.html",
      "components/base-options.html",
    ];
  }
}
class InChIOptionsLatestElement extends InChIOptionsElement {
  constructor() {
    super();
    this.componentPaths = [
      "components/tautomer-options.html",
      "components/base-options.html",
    ];
  }
}
class InChIOptionsLatestMoInElement extends InChIOptionsElement {
  constructor() {
    super();
    this.componentPaths = [
      "components/tautomer-options.html",
      "components/latest-moin-options.html",
      "components/base-options.html",
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
  const inchiParsed = parseInchi(inchi);
  const auxinfoParsed = parseAuxinfo(auxinfo);

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

    this.annotationButtons = Object.keys(this.annotationColors).map((id) => ({
      id,
      text: annotationButtonTexts[id],
      color: this.annotationColors[id],
    }));

    this.annotationSelection = Object.fromEntries(
      Object.keys(this.annotationColors).map((id) => [id, false])
    );

    this.innerHTML = `<div id="annotation-selection" class="mt-2"></div>
      <div id="ngl-viewport" style="width: 100%; height: 600px;"></div>`;

    this.stage = undefined;
    this.structure = undefined;
    this.structureKey = undefined;
    this.annotationData = undefined;
    this.annotationSelectionElement = undefined;
  }

  connectedCallback() {
    const viewportElement = this.querySelector("#ngl-viewport");
    this.stage = new NGL.Stage(viewportElement, { backgroundColor: "white" });
    const resizeObserver = new ResizeObserver(() => this.stage.handleResize());
    resizeObserver.observe(viewportElement);

    this.annotationSelectionElement = this.querySelector(
      "#annotation-selection"
    );
    this.annotationButtons.forEach((button) => {
      const buttonElement = document.createElement("button");
      buttonElement.id = button.id;
      buttonElement.textContent = button.text;
      buttonElement.classList.add(button.color);
      buttonElement.classList.add("annotation-button");
      buttonElement.disabled = true;

      buttonElement.addEventListener("click", () => {
        const isActive = buttonElement.classList.toggle("active");
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
          `#${button.id}`
        );
        const annotationAvailable =
          button.id === "index"
            ? true
            : this.annotationData.get(button.id).size > 0;
        buttonElement.disabled = !annotationAvailable;
        buttonElement.classList.remove("active");
      });
      this.annotationSelection = Object.fromEntries(
        Object.keys(this.annotationColors).map((id) => [id, false])
      );

      this.structure.autoView();
    } catch (error) {
      console.log(error);
      this.structure = undefined;
      this.structureKey = undefined;
      this.annotationData = undefined;
      this.annotationButtons.forEach((button) => {
        const buttonElement = this.annotationSelectionElement.querySelector(
          `#${button.id}`
        );
        buttonElement.disabled = true;
        buttonElement.classList.remove("active");
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

customElements.define("inchi-about", AboutElement);
customElements.define("inchi-inchi-tools", InChIToolsElement);
customElements.define("inchi-rinchi-tools", RInChIToolsElement);
customElements.define("inchi-version-selection", InChIVersionSelectionElement);
customElements.define("inchi-result-field", InChIResultFieldElement);
customElements.define("inchi-options-106", InChIOptions106Element);
customElements.define("inchi-options-latest", InChIOptionsLatestElement);
customElements.define(
  "inchi-options-latest-moin",
  InChIOptionsLatestMoInElement
);
customElements.define("inchi-ngl-viewer", NGLViewerElement);
