"use strict";

/*
 * WASM module(s) initialization
 *
 * Calling the factory function return a Promise which resolves to the module object.
 * See https://github.com/emscripten-core/emscripten/blob/fa339b76424ca9fbe5cf15faea0295d2ac8d58cc/src/settings.js#L1183
 */
const rinchiModulePromises = {
  "1.00": rinchiModule100()
};

const availableRInchiVersions = Object.keys(rinchiModulePromises);

/*
 * Glue code to invoke rinchi_lib's C functions.
 *
 * See https://medium.com/@scalevectors/webassembly-c-pointers-strings-part-2-8e173e50912b
 * on how to cope with char** arguments.
 */
async function rinchiFromRxnfile(rxnfile, forceEquilibrium, rinchiVersion) {
  const module = await rinchiModulePromises[rinchiVersion];

  const out_rinchi_stringPtr = module._malloc(4);
  const out_rinchi_auxinfoPtr = module._malloc(4);
  const res = module.ccall(
    "rinchilib_rinchi_from_file_text",
    "number",
    ["string", "string", "boolean", "number", "number"],
    ["RXN", rxnfile, forceEquilibrium, out_rinchi_stringPtr, out_rinchi_auxinfoPtr]
  );
  const rinchi = module.UTF8ToString(module.getValue(out_rinchi_stringPtr, "i32"));
  const rauxinfo = module.UTF8ToString(module.getValue(out_rinchi_auxinfoPtr, "i32"));
  module._free(out_rinchi_stringPtr);
  module._free(out_rinchi_auxinfoPtr);

  let error = "";
  if (res != 0) {
    error = module.ccall("rinchilib_latest_err_msg", "string", [], []);
  }

  return {"rinchi": rinchi, "rauxinfo": rauxinfo, "return_code": res, "error": error};
}

async function rxnfileFromRinchi(rinchi, rinchiVersion) {
  const module = await rinchiModulePromises[rinchiVersion];

  const out_file_textPtr = module._malloc(4);
  const res = module.ccall(
    "rinchilib_file_text_from_rinchi",
    "number",
    ["string", "string", "string", "number"],
    [rinchi, "", "RXN", out_file_textPtr]
  );
  const rxnfile = module.UTF8ToString(module.getValue(out_file_textPtr, "i32"));
  module._free(out_file_textPtr);

  let error = "";
  if (res != 0) {
    error = module.ccall("rinchilib_latest_err_msg", "string", [], []);
  }

  return {"rxnfile": rxnfile, "return_code": res, "error": error};
}

async function rinchikeyFromRinchi(rinchi, keyType, rinchiVersion) {
  const module = await rinchiModulePromises[rinchiVersion];

  const out_rinchi_keyPtr = module._malloc(4);
  const res = module.ccall(
    "rinchilib_rinchikey_from_rinchi",
    "number",
    ["string", "string", "number"],
    [rinchi, keyType, out_rinchi_keyPtr]
  );
  const rinchikey = module.UTF8ToString(module.getValue(out_rinchi_keyPtr, "i32"));
  module._free(out_rinchi_keyPtr);

  let error = "";
  if (res != 0) {
    error = module.ccall("rinchilib_latest_err_msg", "string", [], []);
  }

  return {"rinchikey": rinchikey, "return_code": res, "error": error};
}
