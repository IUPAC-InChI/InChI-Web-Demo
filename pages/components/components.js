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

    addVersions("inchi-tab1-pane", availableInchiVersions);
    addInchiOptionsForm("inchi-tab1-pane", () => updateInchiTab1());
    initTooltips("inchi-tab1-pane");

    addVersions("inchi-tab2-pane", availableInchiVersions);
    addInchiOptionsForm("inchi-tab2-pane", () => updateInchiTab2());
    initTooltips("inchi-tab2-pane");

    addVersions("inchi-tab3-pane", availableInchiVersions);
    initTooltips("inchi-tab3-pane");
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

customElements.define("inchi-about-component", AboutComponent);
customElements.define("inchi-inchi-tools-component", InChIToolsComponent);
customElements.define("inchi-rinchi-tools-component", RInChIToolsComponent);
