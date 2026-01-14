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
  parseCanonicalAtomIndicesByComponents,
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
  expectedGE: new Map(),
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
  const canonicalAtomIndicesByComponents =
    parseCanonicalAtomIndicesByComponents(auxinfo);

  const auxinfoParsed = parseAuxinfo(auxinfo, canonicalAtomIndicesByComponents);
  const inchiParsed = parseInchi(inchi, canonicalAtomIndicesByComponents);

  expect(inchiParsed.get("h")).toEqual(testdata.expectedH);
  expect(auxinfoParsed.get("N")).toEqual(testdata.expectedN);
  expect(auxinfoParsed.get("E")).toEqual(testdata.expectedE);
  expect(auxinfoParsed.get("gE")).toEqual(testdata.expectedGE);
});

const componentsTestdata = {
  molfile: `
  Ketcher  1122615412D 1   1.00000     0.00000     0

 25 23  0  0  0  0  0  0  0  0999 V2000
    7.4868   -5.5080   -0.5290 O   0  0  0  0  0  0  0  0  0  0  0  0
    5.1132   -5.5079    0.5289 O   0  0  0  0  0  0  0  0  0  0  0  0
    7.4895   -7.3206    0.5422 N   0  0  0  0  0  0  0  0  0  0  0  0
    5.1105   -7.3206   -0.5421 N   0  0  0  0  0  0  0  0  0  0  0  0
    6.9761   -6.3462   -0.0254 C   0  0  0  0  0  0  0  0  0  0  0  0
    5.6239   -6.3463    0.0254 C   0  0  0  0  0  0  0  0  0  0  0  0
    8.4007   -7.4215    0.5773 H   0  0  0  0  0  0  0  0  0  0  0  0
    6.9867   -7.9736    0.9462 H   0  0  0  0  0  0  0  0  0  0  0  0
    5.6133   -7.9737   -0.9460 H   0  0  0  0  0  0  0  0  0  0  0  0
    4.1993   -7.4216   -0.5772 H   0  0  0  0  0  0  0  0  0  0  0  0
   13.2868   -4.2830   -0.5290 O   0  0  0  0  0  0  0  0  0  0  0  0
   10.9132   -4.2829    0.5289 O   0  0  0  0  0  0  0  0  0  0  0  0
   13.2895   -6.0956    0.5422 N   0  0  0  0  0  0  0  0  0  0  0  0
   10.9105   -6.0956   -0.5421 N   0  0  0  0  0  0  0  0  0  0  0  0
   12.7761   -5.1212   -0.0254 C   0  0  0  0  0  0  0  0  0  0  0  0
   11.4239   -5.1213    0.0254 C   0  0  0  0  0  0  0  0  0  0  0  0
   14.2007   -6.1965    0.5773 H   0  0  0  0  0  0  0  0  0  0  0  0
   12.7867   -6.7486    0.9462 H   0  0  0  0  0  0  0  0  0  0  0  0
   11.4133   -6.7487   -0.9460 H   0  0  0  0  0  0  0  0  0  0  0  0
    9.9993   -6.1966   -0.5772 H   0  0  0  0  0  0  0  0  0  0  0  0
    7.7000   -2.7463    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    8.5090   -3.3341    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    8.2000   -4.2852    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    7.2000   -4.2852    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    6.8910   -3.3341    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  5  2  0  0  0  0
  2  6  2  0  0  0  0
  3  5  1  0  0  0  0
  3  7  1  0  0  0  0
  3  8  1  0  0  0  0
  4  6  1  0  0  0  0
  4  9  1  0  0  0  0
  4 10  1  0  0  0  0
  5  6  1  0  0  0  0
 11 15  2  0  0  0  0
 12 16  2  0  0  0  0
 13 15  1  0  0  0  0
 13 17  1  0  0  0  0
 13 18  1  0  0  0  0
 14 16  1  0  0  0  0
 14 19  1  0  0  0  0
 14 20  1  0  0  0  0
 15 16  1  0  0  0  0
 21 25  1  0     0  0
 25 24  1  0     0  0
 24 23  1  0     0  0
 23 22  1  0     0  0
 22 21  1  0     0  0
M  END
`,
  expectedE: new Map([
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 6],
    [7, 6],
    [8, 8],
    [9, 8],
    [10, 10],
    [11, 10],
    [12, 12],
    [13, 12],
    [14, 14],
    [15, 14],
    [16, 16],
    [17, 16],
  ]),
  expectedN: new Map([
    [1, 10],
    [2, 11],
    [3, 8],
    [4, 9],
    [5, 6],
    [6, 7],
    [11, 16],
    [12, 17],
    [13, 14],
    [14, 15],
    [15, 12],
    [16, 13],
    [21, 1],
    [22, 2],
    [23, 4],
    [24, 5],
    [25, 3],
  ]),
  expectedH: new Map([
    [14, 1],
    [16, 1],
    [15, 2],
    [17, 2],
    [8, 1],
    [10, 1],
    [9, 2],
    [11, 2],
  ]),
};

test.each([["1.06"], ["Latest"], ["Latest with Molecular Inorganics"]])(
  "Parse components with version %s",
  async (version) => {
    const { inchi, auxinfo } = await inchiFromMolfile(
      componentsTestdata.molfile,
      "",
      version
    );

    const canonicalAtomIndicesByComponents =
      parseCanonicalAtomIndicesByComponents(auxinfo);

    const auxinfoParsed = parseAuxinfo(
      auxinfo,
      canonicalAtomIndicesByComponents
    );
    const inchiParsed = parseInchi(inchi, canonicalAtomIndicesByComponents);

    expect(auxinfoParsed.get("E")).toEqual(componentsTestdata.expectedE);
    expect(auxinfoParsed.get("N")).toEqual(componentsTestdata.expectedN);
    expect(inchiParsed.get("h")).toEqual(componentsTestdata.expectedH);
  }
);
