"use strict";

/*
 * WASM module(s) initialization
 *
 * Calling the factory function returns a Promise which resolves to the module object.
 * See https://github.com/emscripten-core/emscripten/blob/fa339b76424ca9fbe5cf15faea0295d2ac8d58cc/src/settings.js#L1183
 */
const availableInchiVersions = {
  "1.06": {
    "module": inchiModule106(),
    "optionsTemplateId": "inchiOptionsTemplate106"
  },
  "1.07.2": {
    "module": inchiModule107(),
    "optionsTemplateId": "inchiOptionsTemplate107",
    "default": true
  }
};

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
  const ptr = module.ccall("inchi_from_molfile", "number", ["string", "string"], [molfile, options]);
  const result = module.UTF8ToString(ptr);
  module._free(ptr);

  return JSON.parse(result);
}

async function inchikeyFromInchi(inchi, inchiVersion) {
  const module = await availableInchiVersions[inchiVersion].module;
  const ptr = module.ccall("inchikey_from_inchi", "number", ["string"], [inchi]);
  const result = module.UTF8ToString(ptr);
  module._free(ptr)

  return JSON.parse(result);
}

async function molfileFromInchi(inchi, options, inchiVersion) {
  const module = await availableInchiVersions[inchiVersion].module;
  const ptr = module.ccall("molfile_from_inchi", "number", ["string", "string"], [inchi, options]);
  const result = module.UTF8ToString(ptr);
  module._free(ptr);

  return JSON.parse(result);
}

async function molfileFromAuxinfo(auxinfo, bDoNotAddH, bDiffUnkUndfStereo, inchiVersion) {
  const module = await availableInchiVersions[inchiVersion].module;
  const ptr = module.ccall("molfile_from_auxinfo", "number", ["string", "number", "number"], [auxinfo, bDoNotAddH, bDiffUnkUndfStereo]);
  const result = module.UTF8ToString(ptr);
  module._free(ptr);

  return JSON.parse(result);
}
