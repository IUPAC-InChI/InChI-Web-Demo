"use strict";

// Only run this in the browser, not in Node.js.
if (typeof window !== "undefined") {
  // Instantiate `availableInchiVersions` with IIFE (https://developer.mozilla.org/en-US/docs/Glossary/IIFE).
  (async () => {
    const response = await fetch("inchi_versions.json");
    const inchiVersions = await response.json();

    const availableInchiVersions = Object.fromEntries(
      Object.entries(inchiVersions).map(([version, cfg]) => [
        version,
        {
          ...cfg,
          /*
           * WASM module(s) initialization
           *
           * Calling the factory function returns a Promise which resolves to the module object.
           * See https://github.com/emscripten-core/emscripten/blob/fa339b76424ca9fbe5cf15faea0295d2ac8d58cc/src/settings.js#L1183
           */
          module: window[cfg.module](),
        },
      ])
    );
    window.availableInchiVersions = availableInchiVersions;
  })();
}

/*
 * Glue code to invoke the C functions in inchi_web.c
 *
 * Char pointers returned by inchi_from_molfile, inchikey_from_inchi,
 * molfile_from_inchi and molfile_from_auxinfo need to be freed here.
 * See https://github.com/emscripten-core/emscripten/issues/6484 (Emscripten does
 * not do this on its own when using "string" as return type.)
 */
async function inchiFromMolfile(molfile, options, inchiVersion) {
  const module = await availableInchiVersions[inchiVersion].module;
  const ptr = module.ccall(
    "inchi_from_molfile",
    "number",
    ["string", "string"],
    [molfile, options]
  );
  const result = module.UTF8ToString(ptr);
  module._free(ptr);

  return JSON.parse(result);
}

async function inchikeyFromInchi(inchi, inchiVersion) {
  const module = await availableInchiVersions[inchiVersion].module;
  const ptr = module.ccall(
    "inchikey_from_inchi",
    "number",
    ["string"],
    [inchi]
  );
  const result = module.UTF8ToString(ptr);
  module._free(ptr);

  return JSON.parse(result);
}

async function molfileFromInchi(inchi, options, inchiVersion) {
  const module = await availableInchiVersions[inchiVersion].module;
  const ptr = module.ccall(
    "molfile_from_inchi",
    "number",
    ["string", "string"],
    [inchi, options]
  );
  const result = module.UTF8ToString(ptr);
  module._free(ptr);

  return JSON.parse(result);
}

async function molfileFromAuxinfo(
  auxinfo,
  bDoNotAddH,
  bDiffUnkUndfStereo,
  inchiVersion
) {
  const module = await availableInchiVersions[inchiVersion].module;
  const ptr = module.ccall(
    "molfile_from_auxinfo",
    "number",
    ["string", "number", "number"],
    [auxinfo, bDoNotAddH, bDiffUnkUndfStereo]
  );
  const result = module.UTF8ToString(ptr);
  module._free(ptr);

  return JSON.parse(result);
}

async function getAllFromMolfile(molfile, options, inchiVersion) {
  const inchiResult = await inchiFromMolfile(molfile, options, inchiVersion);
  const inchiKeyResult = await inchikeyFromInchi(
    inchiResult.inchi,
    inchiVersion
  );
  const inchi = inchiResult.inchi || "";
  const auxinfo = inchiResult.auxinfo || "";
  const key = inchiKeyResult.inchikey || "";
  return {
    inchi: inchi,
    auxinfo: auxinfo,
    inchikey: key,
  };
}

if (typeof module === "object" && module.exports) {
  // Only export functions in Node. See https://github.com/umdjs/umd.
  // Prevents "Uncaught ReferenceError: module is not defined" in browser.
  module.exports = {
    inchiFromMolfile,
    inchikeyFromInchi,
    molfileFromInchi,
    molfileFromAuxinfo,
    getAllFromMolfile,
  };
}
