"use strict";

/*
 * The theme switch, on its own so that more than one page can carry it.
 *
 * Extracted from index.js when About became a separate page: that page needs
 * the control and nothing else index.js does. Loading index.js there would
 * throw on availableInchiVersions during warm-up and install the tool
 * surface's key listener on a page with no tool on it.
 */

/*
 * Theme switch.
 *
 * Three states exist even though the control has two: an explicit "light", an
 * explicit "dark", and no choice at all — in which case the page follows the
 * system and keeps following it if the system changes mid-session. The switch
 * reports whichever theme is actually in force.
 *
 * The stored value is applied by a small inline script in the <head> of each
 * page so nothing ever paints in the wrong theme first; this only handles the
 * control.
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
