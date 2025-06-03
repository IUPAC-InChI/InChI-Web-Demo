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

    addInchiOptionsForm("inchi-tab1-pane", () => updateInchiTab1());
    addInchiOptionsForm("inchi-tab2-pane", () => updateInchiTab2());
  }
}

class RInChIToolsComponent extends InsertHTMLComponent {
  constructor() {
    super("components/rinchi-tools.html");
  }
  async connectedCallback() {
    await super.connectedCallback();

    addVersions("rinchi-tab1-pane", availableRInchiVersions);
    addVersions("rinchi-tab2-pane", availableRInchiVersions);
    addVersions("rinchi-tab3-pane", availableRInchiVersions);
    addVersions("rinchi-tab4-pane", availableRInchiVersions);
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

customElements.define("inchi-about-component", AboutComponent);
customElements.define("inchi-inchi-tools-component", InChIToolsComponent);
customElements.define("inchi-rinchi-tools-component", RInChIToolsComponent);
customElements.define("inchi-inchi-version-selection", InChIVersionSelection);
