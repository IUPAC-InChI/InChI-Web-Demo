"use strict";

const RINCHI_VERSION = "1.1-dev with Latest InChI";

/*
 * WASM module initialization, deferred to first use.
 *
 * Calling the factory function returns a Promise which resolves to the module
 * object, and that promise is reused for every later call.
 * See https://github.com/emscripten-core/emscripten/blob/fa339b76424ca9fbe5cf15faea0295d2ac8d58cc/src/settings.js#L1183
 *
 * In the browser the 1.7 MB module is only fetched once something needs a
 * RInChI; under Node the test harness has already put the factory on `global`.
 */
let rinchiModulePromise;

function rinchiModule() {
  if (!rinchiModulePromise) {
    rinchiModulePromise =
      typeof window === "undefined"
        ? Promise.resolve(rinchiModule11())
        : loadScriptOnce("rinchi/librinchi-1.1.js").then(() =>
            window.rinchiModule11()
          );
  }
  return rinchiModulePromise;
}

/*
 * Glue code to invoke rinchi_lib's C functions.
 *
 * See https://medium.com/@scalevectors/webassembly-c-pointers-strings-part-2-8e173e50912b
 * on how to cope with char** arguments.
 */
async function rinchiFromRxnfile(rxnfile, forceEquilibrium) {
  const module = await rinchiModule();

  const out_rinchi_stringPtr = module._malloc(4);
  const out_rinchi_auxinfoPtr = module._malloc(4);
  const res = module.ccall(
    "rinchilib_rinchi_from_file_text",
    "number",
    ["string", "string", "boolean", "number", "number"],
    [
      "AUTO",
      rxnfile,
      forceEquilibrium,
      out_rinchi_stringPtr,
      out_rinchi_auxinfoPtr,
    ]
  );
  const rinchi = module.UTF8ToString(
    module.getValue(out_rinchi_stringPtr, "i32")
  );
  const rauxinfo = module.UTF8ToString(
    module.getValue(out_rinchi_auxinfoPtr, "i32")
  );
  module._free(out_rinchi_stringPtr);
  module._free(out_rinchi_auxinfoPtr);

  let error = "";
  if (res != 0) {
    error = module.ccall("rinchilib_latest_err_msg", "string", [], []);
  }

  return { rinchi: rinchi, rauxinfo: rauxinfo, return_code: res, error: error };
}

async function fileTextFromRinchi(rinchi, rauxinfo, format) {
  const module = await rinchiModule();

  const out_file_textPtr = module._malloc(4);
  const res = module.ccall(
    "rinchilib_file_text_from_rinchi",
    "number",
    ["string", "string", "string", "number"],
    [rinchi, rauxinfo, format, out_file_textPtr]
  );
  const fileText = module.UTF8ToString(
    module.getValue(out_file_textPtr, "i32")
  );
  module._free(out_file_textPtr);

  let error = "";
  if (res != 0) {
    error = module.ccall("rinchilib_latest_err_msg", "string", [], []);
  }

  return { fileText: fileText, return_code: res, error: error };
}

async function rinchikeyFromRinchi(rinchi, keyType) {
  const module = await rinchiModule();

  const out_rinchi_keyPtr = module._malloc(4);
  const res = module.ccall(
    "rinchilib_rinchikey_from_rinchi",
    "number",
    ["string", "string", "number"],
    [rinchi, keyType, out_rinchi_keyPtr]
  );
  const rinchikey = module.UTF8ToString(
    module.getValue(out_rinchi_keyPtr, "i32")
  );
  module._free(out_rinchi_keyPtr);

  let error = "";
  if (res != 0) {
    error = module.ccall("rinchilib_latest_err_msg", "string", [], []);
  }

  return { rinchikey: rinchikey, return_code: res, error: error };
}

if (typeof module === "object" && module.exports) {
  // Only export functions in Node. See https://github.com/umdjs/umd.
  // Prevents "Uncaught ReferenceError: module is not defined" in browser.
  module.exports = {
    rinchiFromRxnfile,
    fileTextFromRinchi,
    rinchikeyFromRinchi,
  };
}
