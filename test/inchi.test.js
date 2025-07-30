// inchi.js assumes global availability of the inchi modules.
// That's why we need to inject the modules into the global scope before using inchi.js.
global.inchiModule106 = require("../pages/inchi/inchi-web106.js");
global.inchiModuleLatest = require("../pages/inchi/inchi-web-latest.js");
global.inchiModuleLatestMoIn = require("../pages/inchi/inchi-web-latest-moin.js");

// Mock availableInchiVersions for global availability during testing.
const loadInchiVersions = () => {
  const inchiVersions = require("../pages/inchi_versions.json");
  return Object.fromEntries(
    Object.entries(inchiVersions).map(([version, cfg]) => [
      version,
      {
        ...cfg,
        module: global[cfg.module](),
      },
    ])
  );
};
global.availableInchiVersions = loadInchiVersions();

const {
  inchiFromMolfile,
  inchikeyFromInchi,
  molfileFromInchi,
  molfileFromAuxinfo,
  parseInchi,
  parseAuxinfo,
} = require("../pages/inchi.js");

const molfile = `https://en.wikipedia.org/wiki/This_Is_Water
  -OEChem-03132411562D

  3  2  0     0  0  0  0  0  0999 V2000
    2.5369   -0.1550    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    3.0739    0.1550    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
    2.0000    0.1550    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  1  3  1  0  0  0  0
M  END
`;

const molfileZZP059 = `ZZP059
  ACCLDraw03071615532D

  6  5  0  0  0  0  0  0  0  0999 V2000
    4.5459   -5.3093    0.0000 *   0  0  0  0  0  0  0  0  0  0  0  0
    6.2241   -4.7152    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    7.2340   -5.3019    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    8.2513   -4.7152    0.0000 C   0  0  3  0  0  0  0  0  0  0  0  0
    9.7809   -5.2944    0.0000 *   0  0  0  0  0  0  0  0  0  0  0  0
    8.2513   -3.5346    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
  3  4  1  0  0  0  0
  4  5  1  0  0  0  0
  4  6  1  0  0  0  0
M  STY  1   1 SRU
M  SLB  1   1   1
M  SCN  1   1 HT 
M  SAL   1  4   2   4   3   6
M  SBL   1  2   1   4
M  SDI   1  4    5.3108   -5.5989    5.3108   -4.4182
M  SDI   1  4    8.8082   -4.4182    8.8082   -5.5915
M  SMT   1 n
M  END
`;

const sdf = `Structure #1. 
  InChIV10                                     

  1  0  0  0  0  0  0  0  0  0  1 V2000
    0.0000    0.0000    0.0000 O   0  0  0     0  0  0  0  0  0
M  END
$$$$
`;

const inchiString = "InChI=1S/H2O/h1H2";
const inchiKey = "XLYOFNOQVPJJNP-UHFFFAOYSA-N";
const auxinfo = "AuxInfo=1/0/N:1/rA:1nO/rB:/rC:;";

test.each([["1.06"], ["Latest"], ["Latest with Molecular Inorganics"]])(
  "InChI string from molfile with version %s",
  async (version) => {
    const result = await inchiFromMolfile(molfile, "", version);
    expect(result.inchi).toBe(inchiString);
  }
);

test.each([["1.06"], ["Latest"], ["Latest with Molecular Inorganics"]])(
  "InChI key from InChI string with version %s",
  async (version) => {
    const result = await inchikeyFromInchi(inchiString, version);
    expect(result.inchikey).toBe(inchiKey);
  }
);

test.each([["1.06"], ["Latest"], ["Latest with Molecular Inorganics"]])(
  "SDF from InChI string with version %s",
  async (version) => {
    const result = await molfileFromInchi(inchiString, "", version);
    expect(result.molfile).toBe(sdf);
  }
);

test.each([["1.06"], ["Latest"], ["Latest with Molecular Inorganics"]])(
  "SDF from InChI auxinfo with version %s",
  async (version) => {
    const result = await molfileFromAuxinfo(auxinfo, 0, 0, version);
    expect(result.molfile).toBe(sdf);
  }
);

test("Sufficient stack size", async () => {
  try {
    await inchiFromMolfile(
      molfileZZP059,
      "-Polymers -FoldCRU -NPZZ -AuxNone -OutErrINCHI -NoLabels",
      "1.06"
    );
  } catch (error) {
    expect(error.message).not.toBe("memory access out of bounds");
  }
});

const oxamideTestdata = {
  molfile: `10113
  -OEChem-07312504283D

 10  9  0     0  0  0  0  0  0999 V2000
    1.3125    0.9772   -0.5850 O   0  0  0  0  0  0  0  0  0  0  0  0
   -1.3125    0.9773    0.5849 O   0  0  0  0  0  0  0  0  0  0  0  0
    1.3155   -1.0274    0.5996 N   0  0  0  0  0  0  0  0  0  0  0  0
   -1.3155   -1.0275   -0.5995 N   0  0  0  0  0  0  0  0  0  0  0  0
    0.7477    0.0502   -0.0281 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.7477    0.0501    0.0281 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.3232   -1.1390    0.6384 H   0  0  0  0  0  0  0  0  0  0  0  0
    0.7594   -1.7496    1.0464 H   0  0  0  0  0  0  0  0  0  0  0  0
   -0.7594   -1.7497   -1.0462 H   0  0  0  0  0  0  0  0  0  0  0  0
   -2.3232   -1.1391   -0.6383 H   0  0  0  0  0  0  0  0  0  0  0  0
  1  5  2  0  0  0  0
  2  6  2  0  0  0  0
  3  5  1  0  0  0  0
  3  7  1  0  0  0  0
  3  8  1  0  0  0  0
  4  6  1  0  0  0  0
  4  9  1  0  0  0  0
  4 10  1  0  0  0  0
  5  6  1  0  0  0  0
M  END
`,
  expectedH: new Map([
    [6, 2],
    [4, 2],
    [5, 1],
    [3, 1],
  ]),
  expectedE: new Map([
    [6, 5],
    [5, 5],
    [4, 3],
    [3, 3],
    [2, 1],
    [1, 1],
  ]),
  expectedGE: new Map([
    [1, 1],
    [2, 1],
  ]),
  expectedN: new Map([
    [5, 1],
    [6, 2],
    [3, 3],
    [4, 4],
    [1, 5],
    [2, 6],
  ]),
};

const benzoicAcidTestdata = {
  molfile: `243
  -OEChem-07312505273D

 15 15  0     0  0  0  0  0  0999 V2000
    2.3067   -1.1843    0.0008 O   0  0  0  0  0  0  0  0  0  0  0  0
    2.4571    1.0837   -0.0005 O   0  0  0  0  0  0  0  0  0  0  0  0
    0.3072    0.0339    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.4142    1.2278    0.0003 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.3662   -1.1878   -0.0003 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.8088    1.2003    0.0003 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.7609   -1.2153   -0.0003 C   0  0  0  0  0  0  0  0  0  0  0  0
   -2.4820   -0.0213    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.7611    0.0629   -0.0003 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.0914    2.1900    0.0004 H   0  0  0  0  0  0  0  0  0  0  0  0
    0.1555   -2.1407   -0.0006 H   0  0  0  0  0  0  0  0  0  0  0  0
   -2.3706    2.1298    0.0005 H   0  0  0  0  0  0  0  0  0  0  0  0
   -2.2859   -2.1661   -0.0005 H   0  0  0  0  0  0  0  0  0  0  0  0
   -3.5679   -0.0428    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
    3.2873   -1.1536    0.0011 H   0  0  0  0  0  0  0  0  0  0  0  0
  1  9  1  0  0  0  0
  1 15  1  0  0  0  0
  2  9  2  0  0  0  0
  3  4  2  0  0  0  0
  3  5  1  0  0  0  0
  3  9  1  0  0  0  0
  4  6  1  0  0  0  0
  4 10  1  0  0  0  0
  5  7  2  0  0  0  0
  5 11  1  0  0  0  0
  6  8  2  0  0  0  0
  6 12  1  0  0  0  0
  7  8  1  0  0  0  0
  7 13  1  0  0  0  0
  8 14  1  0  0  0  0
M  END
`,
  expectedH: new Map([
    [9, 1],
    [8, 1],
  ]),
  expectedE: new Map([
    [2, 2],
    [4, 4],
    [3, 2],
    [5, 4],
    [9, 8],
    [8, 8],
  ]),
  expectedGE: undefined,
  expectedN: new Map([
    [8, 1],
    [6, 2],
    [7, 3],
    [4, 4],
    [5, 5],
    [3, 6],
    [9, 7],
    [1, 8],
    [2, 9],
  ]),
};

test.each(
  ["1.06", "Latest", "Latest with Molecular Inorganics"].flatMap((version) =>
    [oxamideTestdata, benzoicAcidTestdata].map((testdata) => [
      version,
      testdata,
    ])
  )
)("Parse layers with version %s", async (version, testdata) => {
  const { inchi, auxinfo } = await inchiFromMolfile(
    testdata.molfile,
    "",
    version
  );
  const auxinfoParsed = parseAuxinfo(auxinfo);
  const inchiParsed = parseInchi(inchi);
  expect(inchiParsed.get("h")).toEqual(testdata.expectedH);
  expect(auxinfoParsed.get("N")).toEqual(testdata.expectedN);
  expect(auxinfoParsed.get("E")).toEqual(testdata.expectedE);
  expect(auxinfoParsed.get("gE")).toEqual(testdata.expectedGE);
});
