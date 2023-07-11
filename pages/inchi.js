"use strict";

/*
 * WASM module(s) initialization
 *
 * Calling the factory function returns a Promise which resolves to the module object.
 * See https://github.com/emscripten-core/emscripten/blob/fa339b76424ca9fbe5cf15faea0295d2ac8d58cc/src/settings.js#L1183
 */
const inchiModulePromises = {
  "1.06": inchiModule106()
};

const availableInchiVersions = Object.keys(inchiModulePromises);

/*
 * Glue code to invoke the C functions in inchi_web.c
 *
 * Char pointers returned by inchi_from_molfile, inchikey_from_inchi and
 * molfile_from_inchi need to be freed here.
 * See https://github.com/emscripten-core/emscripten/issues/6484 (emscripten does
 * not do this on its own when using "string" as return type)
 */
async function inchiFromMolfile(molfile, options, inchiVersion) {
  const module = await inchiModulePromises[inchiVersion];
  const ptr = module.ccall("inchi_from_molfile", "number", ["string", "string"], [molfile, options]);
  const result = module.UTF8ToString(ptr);
  module._free(ptr);

  return JSON.parse(result);
}

async function inchikeyFromInchi(inchi, inchiVersion) {
  const module = await inchiModulePromises[inchiVersion];
  const ptr = module.ccall("inchikey_from_inchi", "number", ["string"], [inchi]);
  const result = module.UTF8ToString(ptr);
  module._free(ptr)

  return JSON.parse(result);
}

async function molfileFromInchi(inchi, options, inchiVersion) {
  const module = await inchiModulePromises[inchiVersion];
  const ptr = module.ccall("molfile_from_inchi", "number", ["string", "string"], [inchi, options]);
  const result = module.UTF8ToString(ptr);
  module._free(ptr);

  return JSON.parse(result);
}
