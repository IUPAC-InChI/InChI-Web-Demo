class InsertHTMLComponent extends HTMLElement {
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
    if (this.parentElement) {
      this.parentElement.insertAdjacentHTML("beforeend", html);
    }
    this.remove();
  }
}

class AboutComponent extends InsertHTMLComponent {
  constructor() {
    super("components/about.html");
  }
}

class InChIToolsComponent extends InsertHTMLComponent {
  constructor() {
    super("components/inchi-tools.html");
  }

  async connectedCallback() {
    await super.connectedCallback();

    await addInchiOptionsForm("inchi-tab1-pane", () => updateInchiTab1());
    await addInchiOptionsForm("inchi-tab2-pane", () => updateInchiTab2());
  }
}

class RInChIToolsComponent extends InsertHTMLComponent {
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

class InChIVersionSelection extends HTMLElement {
  constructor() {
    super();
    this.onVersionChange = new Function(this.getAttribute("onVersionChange"));
  }

  async connectedCallback() {
    const html = `<div style="border: 1px solid #ddd; border-radius: 4px; padding: 12px; background-color: #f9f9f9; width: fit-content;">
    <label for="version-dropdown" style="display: block;">InChI version</label>
    <select id="version-dropdown" style="display: block;" data-version></select>
    <span id="version-commit" style="display: block;"></span>
  </div>`;

    const parentElement = this.parentElement;
    parentElement.insertAdjacentHTML("afterbegin", html);

    const dropdown = parentElement.querySelector("#version-dropdown");
    const commitLink = parentElement.querySelector("#version-commit");

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
      const commitHash = availableInchiVersions[selectedVersion].commit;
      commitLink.innerHTML = `<a href="https://github.com/IUPAC-InChI/InChI/tree/${commitHash}" target="_blank">${commitHash}</a>`;
    });

    const commitHash = availableInchiVersions[dropdown.value].commit;
    commitLink.innerHTML = `<a href="https://github.com/IUPAC-InChI/InChI/tree/${commitHash}" target="_blank">${commitHash}</a>`;
  }
}

class InChIOptionsComponent extends HTMLElement {
  constructor() {
    super();
  }

  async postCreate(tabDivId, updateFunction) {
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

    this.innerHTML = htmlFragments.join("\n");

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
class InChIOptions106Component extends InChIOptionsComponent {
  constructor() {
    super();
    this.componentPaths = [
      "components/106-options.html",
      "components/base-options.html",
    ];
  }
}
class InChIOptions107Component extends InChIOptionsComponent {
  constructor() {
    super();
    this.componentPaths = [
      "components/tautomer-options.html",
      "components/base-options.html",
    ];
  }
}
class InChIOptions107MoInComponent extends InChIOptionsComponent {
  constructor() {
    super();
    this.componentPaths = [
      "components/tautomer-options.html",
      "components/107-moin-options.html",
      "components/base-options.html",
    ];
  }
}

customElements.define("inchi-about-component", AboutComponent);
customElements.define("inchi-inchi-tools-component", InChIToolsComponent);
customElements.define("inchi-rinchi-tools-component", RInChIToolsComponent);
customElements.define("inchi-inchi-version-selection", InChIVersionSelection);
customElements.define("inchi-options-106", InChIOptions106Component);
customElements.define("inchi-options-107", InChIOptions107Component);
customElements.define("inchi-options-107-moin", InChIOptions107MoInComponent);
