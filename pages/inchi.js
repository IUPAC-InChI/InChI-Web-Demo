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

function parseCoordinates(layer) {
  // Returns an array of coordinate triplets (x, y, z) for each atom in the molfile.
  // The array is in the same order as the atoms are listed in the molfile's atom block.
  const coordinateTriplets = layer.split(";").filter(Boolean);
  const allCoordinates = [];

  for (const coordinateTriplet of coordinateTriplets) {
    const coordinates = coordinateTriplet
      .split(",")
      .map((coordinate) => coordinate.trim());

    if (coordinates.length !== 3) {
      return [];
    }

    const coordinateFloats = coordinates.map((coordinate) =>
      parseFloat(coordinate)
    );

    if (coordinateFloats.some((coordinate) => isNaN(coordinate))) {
      return [];
    }

    allCoordinates.push(coordinateFloats);
  }

  return allCoordinates;
}

function parseCanonicalAtomIndices(layer) {
  // Returns a map of molfile atom indices (i.e., 1-based line numbers from start of atom block)
  // to InChI's 1-based canonical atom indices.
  let originalToCanonicalAtomIndices = new Map();

  const originalAtomIndices = layer
    .split(",")
    .map((originalAtomIndex) => parseInt(originalAtomIndex.trim()));

  if (originalAtomIndices.some((atomIndex) => isNaN(atomIndex))) {
    return originalToCanonicalAtomIndices;
  }

  originalToCanonicalAtomIndices = originalAtomIndices.reduce(
    (map, original, canonical) => (map.set(original, canonical + 1), map),
    originalToCanonicalAtomIndices
  );

  return originalToCanonicalAtomIndices;
}

function parseAtomEquivalenceClasses(layer) {
  // Returns a map of InChI's 1-based canonical atom indices to non-stereo equivalence classes.
  const canonicalAtomIndicesToEquivalentClasses = new Map();

  const equivalenceClasses = layer.match(/\([^)]+\)/g);
  if (!equivalenceClasses) return canonicalAtomIndicesToEquivalentClasses;

  equivalenceClasses.forEach((equivalenceClass) => {
    const equivalenceClassMembers = equivalenceClass.slice(1, -1).split(",");
    const equivalenceClassId = parseInt(equivalenceClassMembers[0].trim());
    for (const member of equivalenceClassMembers) {
      canonicalAtomIndicesToEquivalentClasses.set(
        parseInt(member.trim()),
        equivalenceClassId
      );
    }
  });

  return canonicalAtomIndicesToEquivalentClasses;
}

function parseMobileHydrogenGroups(layer) {
  // Returns a map of InChI's 1-based canonical atom indices to mobile hydrogen groups.
  const canonicalAtomIndicesToMobileHydrogenGroups = new Map();

  const mobileHydrogenGroups = layer.match(/\([^)]+\)/g);
  if (!mobileHydrogenGroups) return canonicalAtomIndicesToMobileHydrogenGroups;

  mobileHydrogenGroups.forEach((mobileHydrogenGroup, index) => {
    const canonicalAtomIndices = mobileHydrogenGroup
      .slice(1, -1)
      .split(",")
      .slice(1);
    const groupId = index + 1;
    canonicalAtomIndices.forEach((canonicalAtomIndex) => {
      canonicalAtomIndicesToMobileHydrogenGroups.set(
        parseInt(canonicalAtomIndex),
        groupId
      );
    });
  });

  return canonicalAtomIndicesToMobileHydrogenGroups;
}

function parseMobileHydrogenGroupClasses(layer) {
  // Returns a map of mobile hydrogen groups to mobile hydrogen group classes.
  // Such a class gives 1-based IDs to sets of equivalent mobile hydrogen groups.
  const mobileHydrogenGroupsToMobileHydrogenGroupClasses = new Map();

  const mobileHydrogenGroupClasses = layer.match(/\([^)]+\)/g);
  if (!mobileHydrogenGroupClasses)
    return mobileHydrogenGroupsToMobileHydrogenGroupClasses;

  mobileHydrogenGroupClasses.forEach((mobileHydrogenGroupClass, index) => {
    const mobileHydrogenGroups = mobileHydrogenGroupClass
      .slice(1, -1)
      .split(",");
    const mobileHydrogenGroupClassId = index + 1;
    mobileHydrogenGroups.forEach((mobileHydrogenGroup) => {
      mobileHydrogenGroupsToMobileHydrogenGroupClasses.set(
        parseInt(mobileHydrogenGroup),
        mobileHydrogenGroupClassId
      );
    });
  });

  return mobileHydrogenGroupsToMobileHydrogenGroupClasses;
}

function mapCanonicalAtomIndicesToMobileHydrogenGroupClasses(
  canonicalAtomIndicesToMobileHydrogenGroups,
  mobileHydrogenGroupsToMobileHydrogenGroupClasses
) {
  const canonicalAtomIndicesToMobileHydrogenGroupClasses = new Map();
  if (
    !canonicalAtomIndicesToMobileHydrogenGroups.size ||
    !mobileHydrogenGroupsToMobileHydrogenGroupClasses.size
  ) {
    return canonicalAtomIndicesToMobileHydrogenGroupClasses;
  }
  for (const [
    canonicalAtomIndex,
    mobileHydrogenGroup,
  ] of canonicalAtomIndicesToMobileHydrogenGroups.entries()) {
    const mobileHydrogenGroupClass =
      mobileHydrogenGroupsToMobileHydrogenGroupClasses.get(mobileHydrogenGroup);
    if (mobileHydrogenGroupClass !== undefined) {
      canonicalAtomIndicesToMobileHydrogenGroupClasses.set(
        canonicalAtomIndex,
        mobileHydrogenGroupClass
      );
    }
  }
  return canonicalAtomIndicesToMobileHydrogenGroupClasses;
}

function parseInchi(inchi) {
  const parsers = { h: parseMobileHydrogenGroups };
  const layerResults = new Map(
    Object.keys(parsers).map((key) => [key, new Map()])
  );
  const layers = inchi.split("/");

  for (const [layerName, layerParser] of Object.entries(parsers)) {
    const layer = layers.find((layer) => layer.startsWith(layerName));
    if (layer) {
      layerResults.set(layerName, layerParser(layer.slice(layerName.length)));
    }
  }

  return layerResults;
}

function parseAuxinfo(auxinfo) {
  const parsers = {
    N: parseCanonicalAtomIndices,
    E: parseAtomEquivalenceClasses,
    gE: parseMobileHydrogenGroupClasses,
    rC: parseCoordinates,
  };
  const layerResults = new Map(
    Object.keys(parsers).map((key) => [key, new Map()])
  );
  const layers = auxinfo.split("/");

  for (const [layerName, layerParser] of Object.entries(parsers)) {
    const layer = layers.find((layer) => layer.startsWith(layerName + ":"));
    if (layer) {
      layerResults.set(
        layerName,
        layerParser(layer.slice(layerName.length + 1))
      );
    }
  }

  return layerResults;
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
    parseInchi,
    parseAuxinfo,
    mapCanonicalAtomIndicesToMobileHydrogenGroupClasses,
  };
}
