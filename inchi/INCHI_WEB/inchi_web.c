#include <stdlib.h>
#include <string.h>
#include "inchi_api.h"
#include <emscripten.h>

/*
 * Note on the use of malloc():
 *
 * There are no NULL checks for the results of malloc calls because we are compiling with
 * ABORTING_MALLOC=1 (default setting). Tests should make sure that turning ALLOW_MEMORY_GROWTH
 * on is not required.
 * See https://github.com/emscripten-core/emscripten/blob/fa339b76424ca9fbe5cf15faea0295d2ac8d58cc/src/settings.js#L131
 *
 * What happens when malloc aborts? We can catch a JS exception.
 * See https://github.com/emscripten-core/emscripten/issues/9715
 */

/*
 * InChI from Molfile
 * ------------------
 */

/*
 * Safe way to serialize to JSON.
 * See https://livebook.manning.com/book/webassembly-in-action/c-emscripten-macros/v-7/67
 */
EM_JS(char*, to_json_inchi, (int return_code, char *inchi, char *auxinfo, char *message, char *log), {
  const json = JSON.stringify({
    "return_code": return_code,
    "inchi": Module.UTF8ToString(inchi),
    "auxinfo": Module.UTF8ToString(auxinfo),
    "message": Module.UTF8ToString(message),
    "log": Module.UTF8ToString(log)
  });

  const byteCount = Module.lengthBytesUTF8(json) + 1;
  const jsonPtr = Module._malloc(byteCount);
  Module.stringToUTF8(json, jsonPtr, byteCount);

  return jsonPtr;
});

char* inchi_from_molfile(char *molfile, char *options) {
  int ret;
  inchi_Output *output;
  char *json;

  output = malloc(sizeof(*output));
  memset(output, 0, sizeof(*output));

  ret = MakeINCHIFromMolfileText(molfile, options, output);

  switch(ret) {
    case mol2inchi_Ret_OKAY: {
      json = to_json_inchi(0, output->szInChI, output->szAuxInfo, "", "");
      break;
    }
    case mol2inchi_Ret_WARNING: {
      json = to_json_inchi(1, output->szInChI, output->szAuxInfo, output->szMessage, output->szLog);
      break;
    }
    case mol2inchi_Ret_EOF:
    case mol2inchi_Ret_ERROR:
    case mol2inchi_Ret_ERROR_get:
    case mol2inchi_Ret_ERROR_comp: {
      json = to_json_inchi(-1, "", "", output->szMessage, output->szLog);
      break;
    }
    default: {
      json = to_json_inchi(-1, "", "", "", "MakeINCHIFromMolfileText: Unknown return code");
    }
  }

  FreeINCHI(output);
  free(output);

  // Caller should free this.
  return json;
}

/*
 * InChIKey from InChI
 * -------------------
 */
EM_JS(char*, to_json_inchikey, (int return_code, char *inchikey, char *message), {
  const json = JSON.stringify({
    "return_code": return_code,
    "inchikey": Module.UTF8ToString(inchikey),
    "message": Module.UTF8ToString(message)
  });

  const byteCount = Module.lengthBytesUTF8(json) + 1;
  const jsonPtr = Module._malloc(byteCount);
  Module.stringToUTF8(json, jsonPtr, byteCount);

  return jsonPtr;
});

char* inchikey_from_inchi(char* inchi) {
  int ret;
  char szINCHIKey[28], szXtra1[65], szXtra2[65];
  char *json;

  ret = GetINCHIKeyFromINCHI(inchi, 0, 0, szINCHIKey, szXtra1, szXtra2);

  switch(ret) {
    case INCHIKEY_OK: {
      json = to_json_inchikey(0, szINCHIKey, "");
      break;
    }
    case INCHIKEY_UNKNOWN_ERROR: {
      json = to_json_inchikey(-1, "", "GetINCHIKeyFromINCHI: Unknown program error");
      break;
    }
    case INCHIKEY_EMPTY_INPUT: {
      json = to_json_inchikey(-1, "", "GetINCHIKeyFromINCHI: Source string is empty");
      break;
    }
    case INCHIKEY_INVALID_INCHI_PREFIX: {
      json = to_json_inchikey(-1, "", "GetINCHIKeyFromINCHI: Invalid InChI prefix or invalid version (not 1)");
      break;
    }
    case INCHIKEY_NOT_ENOUGH_MEMORY: {
      json = to_json_inchikey(-1, "", "GetINCHIKeyFromINCHI: Not enough memory");
      break;
    }
    case INCHIKEY_INVALID_INCHI: {
      json = to_json_inchikey(-1, "", "GetINCHIKeyFromINCHI: Source InChI has invalid layout");
      break;
    }
    case INCHIKEY_INVALID_STD_INCHI: {
      json = to_json_inchikey(-1, "", "GetINCHIKeyFromINCHI: Source standard InChI has invalid layout");
      break;
    }
    default: {
      json = to_json_inchikey(-1, "", "GetINCHIKeyFromINCHI: Unknown return code");
    }
  }

  // Caller should free this.
  return json;
}

/*
 * Molfile from InChI
 * ------------------
 */
EM_JS(char*, to_json_molfile, (int return_code, char *molfile, char *message, char *log), {
  const json = JSON.stringify({
    "return_code": return_code,
    "molfile": Module.UTF8ToString(molfile),
    "message": Module.UTF8ToString(message),
    "log": Module.UTF8ToString(log)
  });

  const byteCount = Module.lengthBytesUTF8(json) + 1;
  const jsonPtr = Module._malloc(byteCount);
  Module.stringToUTF8(json, jsonPtr, byteCount);

  return jsonPtr;
});

/*
 * Copies data fields from an inchi_OutputStructEx struct to a new inchi_InputEx struct.
 */
inchi_InputEx inchi_OutputStructEx_to_inchi_InputEx(inchi_OutputStructEx* out) {
  inchi_InputEx result;

  result.atom = out->atom;
  result.stereo0D = out->stereo0D;
  result.num_atoms = out->num_atoms;
  result.num_stereo0D = out->num_stereo0D;
  result.polymer = out->polymer;
  result.v3000 = out->v3000;

  return result;
}

char* molfile_from_inchi(char* inchi, char* options) {
  int ret;
  inchi_InputINCHI input;
  inchi_OutputStructEx *output;
  char *json;

  input.szInChI = inchi;
  input.szOptions = options;

  output = malloc(sizeof(*output));
  memset(output, 0, sizeof(*output));

  ret = GetStructFromINCHIEx(&input, output);

  switch(ret) {
    case inchi_Ret_OKAY: {
      inchi_InputEx inputEx = inchi_OutputStructEx_to_inchi_InputEx(output);
      inputEx.szOptions = "-OutputSDF";
      inchi_Output outputEx;

      // TODO: Handle return value of this API call.
      GetINCHIEx(&inputEx, &outputEx);

      json = to_json_molfile(0, outputEx.szInChI, "", "");
      FreeINCHI(&outputEx);

      break;
    }
    case inchi_Ret_WARNING: {
      inchi_InputEx inputEx = inchi_OutputStructEx_to_inchi_InputEx(output);
      inputEx.szOptions = "-OutputSDF";
      inchi_Output outputEx;

      // TODO: Handle return value of this API call.
      GetINCHIEx(&inputEx, &outputEx);

      json = to_json_molfile(1, outputEx.szInChI, output->szMessage, output->szLog);
      FreeINCHI(&outputEx);

      break;
    }
    case inchi_Ret_ERROR:
    case inchi_Ret_FATAL:
    case inchi_Ret_UNKNOWN:
    case inchi_Ret_BUSY:
    case inchi_Ret_EOF:
    case inchi_Ret_SKIP: {
      json = to_json_molfile(-1, "", output->szMessage, output->szLog);
      break;
    }
    default:
      json = to_json_molfile(-1, "", "", "GetStructFromINCHIEx: Unknown return code");
  }

  FreeStructFromINCHIEx(output);
  free(output);

  // Caller should free this.
  return json;
}

/*
 * Molfile from AuxInfo
 * --------------------
 */
char* molfile_from_auxinfo(char* auxinfo, int bDoNotAddH, int bDiffUnkUndfStereo) {
  int ret;
  InchiInpData *output;
  inchi_Input *pInp;
  char *json;

  output = malloc(sizeof(*output));
  memset(output, 0, sizeof(*output));
  pInp = malloc(sizeof(*pInp));
  memset(pInp, 0, sizeof(*pInp));

  output->pInp = pInp;

  ret = Get_inchi_Input_FromAuxInfo(auxinfo, bDoNotAddH, bDiffUnkUndfStereo, output);

  /*
   * Handling of the MDL chiral flag, see
   * https://github.com/IUPAC-InChI/RInChI/blob/0e14efe8ca7509262fe7b7aecd8c900ef00ffd9f/src/lib/inchi_generator.cpp#L316-L347
   */
  int output_chiral_flag = output->bChiral;
  char *options;
  switch(output_chiral_flag) {
    case 1: {
      options = "-OutputSDF -SUCF -ChiralFlagON";
      break;
    }
    case 2: {
      options = "-OutputSDF -SUCF -ChiralFlagOFF";
      break;
    }
    default:
      options = "-OutputSDF";
  }

  switch(ret) {
    case inchi_Ret_OKAY: {
      pInp->szOptions = options;
      inchi_Output inchi_output;

      // TODO: Handle return value of this API call.
      GetINCHI(pInp, &inchi_output);

      json = to_json_molfile(0, inchi_output.szInChI, "", "");
      FreeINCHI(&inchi_output);

      break;
    }
    case inchi_Ret_WARNING: {
      pInp->szOptions = options;
      inchi_Output inchi_output;

      // TODO: Handle return value of this API call.
      GetINCHI(pInp, &inchi_output);

      json = to_json_molfile(1, inchi_output.szInChI, output->szErrMsg, "");
      FreeINCHI(&inchi_output);

      break;
    }
    case inchi_Ret_ERROR:
    case inchi_Ret_FATAL:
    case inchi_Ret_UNKNOWN:
    case inchi_Ret_BUSY:
    case inchi_Ret_EOF:
    case inchi_Ret_SKIP: {
      json = to_json_molfile(-1, "", output->szErrMsg, "");
      break;
    }
    default:
      json = to_json_molfile(-1, "", "", "Get_inchi_Input_FromAuxInfo: Unknown return code");
  }

  Free_inchi_Input(pInp);
  free(output);
  free(pInp);

  // Caller should free this.
  return json;
}
