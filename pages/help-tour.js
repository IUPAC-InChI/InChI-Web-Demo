/*
 * The guided tour behind the masthead's Help button.
 *
 * One step per part of the workbench: the part is lit up, the rest of the page
 * dimmed, and a card beside it says what it does. No library — a native
 * <dialog> supplies the modal behaviour (focus trap, Escape to close, an inert
 * page behind it and focus returned to Help on close), and the dimming is a
 * box-shadow spread out from the lit part.
 *
 * Steps whose part is not on screen are skipped when the tour opens: the
 * status line before the first conversion, the RInChI output while the editor
 * holds a molecule, the InChI output while it holds a reaction.
 */

const HELP_TOUR_STEPS = [
  {
    selector: ".tool-input > .ketcher",
    title: "The structure editor",
    body: "Draw a molecule here and its InChI updates as you draw. Draw a reaction arrow and the output switches to RInChI.",
  },
  {
    selector: "[data-paste-panel]",
    title: "Paste a structure",
    body: "Paste a molfile, SD file text, an AuxInfo, a reaction file, a RInChI, a SMILES or a PubChem identifier. Pasted text is converted exactly as given and the editor only draws it; edit the drawing and the drawing becomes the source instead.",
  },
  {
    selector: ".bounding-box:has(#workbench-sdf)",
    title: "SD files",
    body: "Open an SD file for one InChI and InChIKey per record. Choosing a record draws it in the editor and fills the output.",
  },
  {
    selector: ".tool-controls",
    title: "Version and options",
    body: "Choose the InChI version that does the conversion, including development branches and open pull requests. The options change what the InChI encodes; the ? beside an option explains it.",
  },
  {
    selector: "[data-status]",
    title: "What happened",
    body: "This line says what was converted, with which version and which options, or why the conversion failed.",
  },
  {
    selector: "#workbench-inchi-wrapper > .identifier-plate",
    title: "The InChI",
    body: "The full InChI, then each of its layers on its own row, labelled with its prefix letter and what it encodes. Copy or download it with the buttons at the top.",
  },
  {
    selector: "#workbench-inchikey-wrapper > .identifier-plate",
    title: "The InChIKey",
    body: "A fixed-length hash of the InChI, for searching databases. Its three blocks hash the skeleton, the stereo and isotopes, and the protonation.",
  },
  {
    selector: ".comparison-controls",
    title: "Compare results",
    body: "Pin a result, then change the version, the options or the structure. Both answers are shown side by side, and the layers that changed are marked.",
  },
  {
    selector: ".bounding-box:has(> #workbench-ngl-viewer)",
    title: "3D view",
    body: "The structure in 3D. The buttons label the atoms with their index, canonical index, equivalence class or hydrogen group.",
  },
  {
    selector: '[data-output="inchi"] > .secondary-plates',
    title: "AuxInfo and the log",
    body: "AuxInfo holds the atom numbering and coordinates. The log carries the library's warnings, which often explain an unexpected InChI.",
  },
  {
    selector: '[data-output="rinchi"]',
    title: "Reactions",
    body: "A reaction gets a RInChI and its three keys. Tick the equilibrium box for a reaction drawn with a plain arrow, or generate the RXN or RD file text.",
  },
  {
    selector: ".mask-open",
    title: "Report a problem",
    body: "If a result looks wrong, send the structure with a short description. This is the only thing that leaves your browser; every conversion runs locally.",
  },
  {
    selector: ".masthead-utilities",
    title: "Help, theme and About",
    body: "Help opens this tour again. The switch changes between light and dark, and About says who made the app and how.",
  },
];

/* Space kept between the card, the lit part and the viewport edge, in px. */
const HELP_TOUR_MARGIN = 12;

/* How far the light reaches past the part it marks, in px. */
const HELP_TOUR_PADDING = 4;

/*
 * Below the part, else above, else beside it, else whichever of below and
 * above has more room. `size` is the card's measured box, because its height
 * depends on the step's copy.
 */
function pickTourSide(rect, size, view) {
  const room = size.height + HELP_TOUR_MARGIN;
  if (view.height - rect.bottom >= room) return "below";
  if (rect.top >= room) return "above";
  if (view.width - rect.right >= size.width + HELP_TOUR_MARGIN) return "right";
  if (rect.left >= size.width + HELP_TOUR_MARGIN) return "left";
  return view.height - rect.bottom >= rect.top ? "below" : "above";
}

/*
 * The card's top-left corner. Always top and left, clamped to the viewport,
 * so both edges of the card stay on screen even when it has to overlap the
 * part it describes.
 */
function tourCardPosition(rect, side, size, view) {
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  const width = Math.min(size.width, view.width - 2 * HELP_TOUR_MARGIN);
  const maxLeft = view.width - width - HELP_TOUR_MARGIN;
  const maxTop = view.height - size.height - HELP_TOUR_MARGIN;
  const centred = clamp(
    rect.left + rect.width / 2 - width / 2,
    HELP_TOUR_MARGIN,
    maxLeft
  );
  const gap = HELP_TOUR_MARGIN + HELP_TOUR_PADDING;

  switch (side) {
    case "below":
      return {
        top: clamp(rect.bottom + gap, HELP_TOUR_MARGIN, maxTop),
        left: centred,
      };
    case "above":
      return {
        top: clamp(rect.top - size.height - gap, HELP_TOUR_MARGIN, maxTop),
        left: centred,
      };
    case "right":
      return {
        top: clamp(rect.top, HELP_TOUR_MARGIN, maxTop),
        left: clamp(rect.right + gap, HELP_TOUR_MARGIN, maxLeft),
      };
    default:
      return {
        top: clamp(rect.top, HELP_TOUR_MARGIN, maxTop),
        left: clamp(rect.left - width - gap, HELP_TOUR_MARGIN, maxLeft),
      };
  }
}

/* Built on first use and kept: the tour can be reopened any number of times. */
let helpTourDialog = null;

function buildHelpTourDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "help-tour";
  dialog.setAttribute("aria-labelledby", "helpTourTitle");
  dialog.setAttribute("aria-describedby", "helpTourBody");
  dialog.innerHTML = `<div class="help-tour-spotlight" aria-hidden="true"></div>
    <div class="help-tour-card">
      <header>
        <span class="apparatus" data-tour-count></span>
        <button type="button" class="help-tour-close" data-tour-close aria-label="Close the tour">
          <svg class="app-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" />
          </svg>
        </button>
      </header>
      <div aria-live="polite">
        <h2 id="helpTourTitle"></h2>
        <p id="helpTourBody"></p>
      </div>
      <div class="help-tour-controls">
        <button type="button" class="btn btn-sm btn-outline-secondary" data-tour-back>Back</button>
        <button type="button" class="btn btn-sm btn-primary" data-tour-next>Next</button>
      </div>
    </div>`;
  document.body.append(dialog);
  return dialog;
}

function openHelpTour() {
  const steps = HELP_TOUR_STEPS.map((step) => ({
    ...step,
    target: document.querySelector(step.selector),
  })).filter(({ target }) => target && target.getClientRects().length > 0);
  if (steps.length === 0) {
    return;
  }

  helpTourDialog ??= buildHelpTourDialog();
  const dialog = helpTourDialog;
  const spotlight = dialog.querySelector(".help-tour-spotlight");
  const card = dialog.querySelector(".help-tour-card");
  const count = dialog.querySelector("[data-tour-count]");
  const title = dialog.querySelector("#helpTourTitle");
  const body = dialog.querySelector("#helpTourBody");
  const back = dialog.querySelector("[data-tour-back]");
  const next = dialog.querySelector("[data-tour-next]");
  const close = dialog.querySelector("[data-tour-close]");

  let index = 0;
  let frame = 0;

  const place = () => {
    frame = 0;
    const rect = steps[index].target.getBoundingClientRect();
    const pad = HELP_TOUR_PADDING;
    Object.assign(spotlight.style, {
      top: `${rect.top - pad}px`,
      left: `${rect.left - pad}px`,
      width: `${rect.width + 2 * pad}px`,
      height: `${rect.height + 2 * pad}px`,
    });
    const box = card.getBoundingClientRect();
    const size = { width: box.width, height: box.height };
    const view = { width: window.innerWidth, height: window.innerHeight };
    const { top, left } = tourCardPosition(
      rect,
      pickTourSide(rect, size, view),
      size,
      view
    );
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
  };

  /* Scrolling, smooth or not, moves the part: follow it, once per frame. */
  const schedulePlace = () => {
    frame ||= requestAnimationFrame(place);
  };

  const show = (stepIndex) => {
    index = stepIndex;
    const step = steps[index];
    count.textContent = `${index + 1} of ${steps.length}`;
    title.textContent = step.title;
    body.textContent = step.body;
    back.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? "Finish" : "Next";
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    step.target.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
    place();
    next.focus();
  };

  const onNext = () =>
    index === steps.length - 1 ? dialog.close() : show(index + 1);
  const onBack = () => index > 0 && show(index - 1);
  const onClose = () => dialog.close();
  /* The dimmed page is the dialog itself; the card stops its own clicks. */
  const onDimmerClick = (event) => event.target === dialog && dialog.close();

  next.addEventListener("click", onNext);
  back.addEventListener("click", onBack);
  close.addEventListener("click", onClose);
  dialog.addEventListener("click", onDimmerClick);
  window.addEventListener("resize", schedulePlace);
  window.addEventListener("scroll", schedulePlace, { capture: true });

  /* Escape closes natively, so cleanup hangs on `close`, not on the buttons. */
  dialog.addEventListener(
    "close",
    () => {
      next.removeEventListener("click", onNext);
      back.removeEventListener("click", onBack);
      close.removeEventListener("click", onClose);
      dialog.removeEventListener("click", onDimmerClick);
      window.removeEventListener("resize", schedulePlace);
      window.removeEventListener("scroll", schedulePlace, { capture: true });
      cancelAnimationFrame(frame);
      frame = 0;
    },
    { once: true }
  );

  dialog.showModal();
  show(0);
}

/*
 * An empty editor gets caffeine first (index.js), so the InChI steps point at
 * real layers rather than placeholders. The button is disabled while that
 * converts, because a first conversion can wait on a cold WebAssembly module.
 */
if (typeof document !== "undefined") {
  const help = document.querySelector("[data-help-open]");
  help?.addEventListener("click", async () => {
    help.disabled = true;
    try {
      await loadTourSampleIntoEmptyEditor();
    } catch (error) {
      console.error("Preparing the tour sample failed", error);
    }
    help.disabled = false;
    /* Disabling dropped focus; the dialog returns it to whatever had it. */
    help.focus();
    openHelpTour();
  });
}

if (typeof module === "object" && module.exports) {
  module.exports = { HELP_TOUR_STEPS, pickTourSide, tourCardPosition };
}
