// inchi.js assumes global availability of the inchi modules.
// That's why we need to inject the modules into the global scope before using inchi.js.
global.inchiModule106 = require("../pages/inchi/inchi-web106.js");
global.inchiModuleLatest = require("../pages/inchi/inchi-web-latest.js");
global.inchiModuleLatestMoIn = require("../pages/inchi/inchi-web-latest-moin.js");
global.inchiModuleLatestEnhancedStereo = require("../pages/inchi/inchi-web-latest-enhanced-stereo.js");

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
    ]),
  );
};
global.availableInchiVersions = loadInchiVersions();

const versions = [
  ["1.06"],
  ["Latest"],
  ["Latest with Molecular Inorganics"],
  ["Latest with Enhanced Stereochemistry"],
];

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

test.each(versions)(
  "InChI string from molfile with version %s",
  async (version) => {
    const result = await inchiFromMolfile(molfile, "", version);
    expect(result.inchi).toBe(inchiString);
  },
);

test.each(versions)(
  "InChI key from InChI string with version %s",
  async (version) => {
    const result = await inchikeyFromInchi(inchiString, version);
    expect(result.inchikey).toBe(inchiKey);
  },
);

test.each(versions)(
  "SDF from InChI string with version %s",
  async (version) => {
    const result = await molfileFromInchi(inchiString, "", version);
    expect(result.molfile).toBe(sdf);
  },
);

test.each(versions)(
  "SDF from InChI auxinfo with version %s",
  async (version) => {
    const result = await molfileFromAuxinfo(auxinfo, 0, 0, version);
    expect(result.molfile).toBe(sdf);
  },
);

test("Sufficient stack size", async () => {
  try {
    await inchiFromMolfile(
      molfileZZP059,
      "-Polymers -FoldCRU -NPZZ -AuxNone -OutErrINCHI -NoLabels",
      "1.06",
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
  versions.flatMap(([version]) =>
    [oxamideTestdata, benzoicAcidTestdata].map((testdata) => [
      version,
      testdata,
    ]),
  ),
)("Parse layers with version %s", async (version, testdata) => {
  const { inchi, auxinfo } = await inchiFromMolfile(
    testdata.molfile,
    "",
    version,
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
  expectedGE: new Map([
    [1, 1],
    [2, 1],
  ]),
};

test.each(versions)("Parse components with version %s", async (version) => {
  const { inchi, auxinfo } = await inchiFromMolfile(
    componentsTestdata.molfile,
    "",
    version,
  );

  const canonicalAtomIndicesByComponents =
    parseCanonicalAtomIndicesByComponents(auxinfo);

  const auxinfoParsed = parseAuxinfo(auxinfo, canonicalAtomIndicesByComponents);
  const inchiParsed = parseInchi(inchi, canonicalAtomIndicesByComponents);

  expect(auxinfoParsed.get("E")).toEqual(componentsTestdata.expectedE);
  expect(auxinfoParsed.get("N")).toEqual(componentsTestdata.expectedN);
  expect(inchiParsed.get("h")).toEqual(componentsTestdata.expectedH);
});

test.each(versions)(
  "Parse multiple different components containing hydrogen groups with version %s",
  async (version) => {
    const { inchi, auxinfo } = await inchiFromMolfile(
      `
  Ketcher  1152615162D 1   1.00000     0.00000     0

 48 47  0  0  0  0  0  0  0  0999 V2000
    7.5441   -1.4832   -0.7658 O   0  0  0  0  0  0  0  0  0  0  0  0
    5.6052   -7.6459   -0.1796 O   0  0  0  0  0  0  0  0  0  0  0  0
   13.3529   -7.5368    0.1575 O   0  0  0  0  0  0  0  0  0  0  0  0
   11.1647   -1.4633    0.7930 O   0  0  0  0  0  0  0  0  0  0  0  0
    7.6593   -3.3055   -2.5671 O   0  0  0  0  0  0  0  0  0  0  0  0
    6.0019   -6.3344    1.9887 O   0  0  0  0  0  0  0  0  0  0  0  0
   12.9252   -6.2130   -1.9973 O   0  0  0  0  0  0  0  0  0  0  0  0
   11.1016   -3.3067    2.5755 O   0  0  0  0  0  0  0  0  0  0  0  0
    8.6822   -5.0128    0.4157 C   0  0  0  0  0  0  0  0  0  0  0  0
   10.1675   -5.0181   -0.4115 C   0  0  0  0  0  0  0  0  0  0  0  0
    7.4085   -3.9740    0.0295 C   0  0  0  0  0  0  0  0  0  0  0  0
    7.2717   -5.6285   -0.2792 C   0  0  0  0  0  0  0  0  0  0  0  0
   11.6042   -5.5911    0.2656 C   0  0  0  0  0  0  0  0  0  0  0  0
   11.4076   -3.9392   -0.0244 C   0  0  0  0  0  0  0  0  0  0  0  0
    7.5494   -2.9298   -1.2489 C   0  0  0  0  0  0  0  0  0  0  0  0
    6.2462   -6.5388    0.6510 C   0  0  0  0  0  0  0  0  0  0  0  0
   12.6756   -6.4457   -0.6651 C   0  0  0  0  0  0  0  0  0  0  0  0
   11.2113   -2.9138    1.2623 C   0  0  0  0  0  0  0  0  0  0  0  0
    8.8045   -5.2231    1.6197 H   0  0  0  0  0  0  0  0  0  0  0  0
   10.0449   -5.2260   -1.6159 H   0  0  0  0  0  0  0  0  0  0  0  0
    6.7856   -3.5279    0.9833 H   0  0  0  0  0  0  0  0  0  0  0  0
    7.3590   -5.9889   -1.4449 H   0  0  0  0  0  0  0  0  0  0  0  0
   11.5314   -5.9661    1.4280 H   0  0  0  0  0  0  0  0  0  0  0  0
   12.0066   -3.4586   -0.9763 H   0  0  0  0  0  0  0  0  0  0  0  0
    7.6396   -0.7691   -1.6020 H   0  0  0  0  0  0  0  0  0  0  0  0
    4.9180   -8.2667    0.4209 H   0  0  0  0  0  0  0  0  0  0  0  0
   14.0713   -8.1205   -0.4437 H   0  0  0  0  0  0  0  0  0  0  0  0
   11.0316   -0.7619    1.6347 H   0  0  0  0  0  0  0  0  0  0  0  0
   16.7064   -1.8315   -0.5290 O   0  0  0  0  0  0  0  0  0  0  0  0
   14.3329   -1.8314    0.5289 O   0  0  0  0  0  0  0  0  0  0  0  0
   16.7091   -3.6441    0.5422 N   0  0  0  0  0  0  0  0  0  0  0  0
   14.3301   -3.6442   -0.5421 N   0  0  0  0  0  0  0  0  0  0  0  0
   16.1957   -2.6697   -0.0254 C   0  0  0  0  0  0  0  0  0  0  0  0
   14.8436   -2.6698    0.0254 C   0  0  0  0  0  0  0  0  0  0  0  0
   17.6203   -3.7450    0.5773 H   0  0  0  0  0  0  0  0  0  0  0  0
   16.2063   -4.2971    0.9462 H   0  0  0  0  0  0  0  0  0  0  0  0
   14.8330   -4.2972   -0.9460 H   0  0  0  0  0  0  0  0  0  0  0  0
   13.4190   -3.7451   -0.5772 H   0  0  0  0  0  0  0  0  0  0  0  0
   17.7814   -5.2065   -0.5290 O   0  0  0  0  0  0  0  0  0  0  0  0
   15.4079   -5.2064    0.5289 O   0  0  0  0  0  0  0  0  0  0  0  0
   17.7841   -7.0191    0.5422 N   0  0  0  0  0  0  0  0  0  0  0  0
   15.4051   -7.0192   -0.5421 N   0  0  0  0  0  0  0  0  0  0  0  0
   17.2707   -6.0447   -0.0254 C   0  0  0  0  0  0  0  0  0  0  0  0
   15.9186   -6.0448    0.0254 C   0  0  0  0  0  0  0  0  0  0  0  0
   18.6953   -7.1200    0.5773 H   0  0  0  0  0  0  0  0  0  0  0  0
   17.2813   -7.6721    0.9462 H   0  0  0  0  0  0  0  0  0  0  0  0
   15.9080   -7.6722   -0.9460 H   0  0  0  0  0  0  0  0  0  0  0  0
   14.4940   -7.1201   -0.5772 H   0  0  0  0  0  0  0  0  0  0  0  0
  1 15  1  0  0  0  0
  1 25  1  0  0  0  0
  2 16  1  0  0  0  0
  2 26  1  0  0  0  0
  3 17  1  0  0  0  0
  3 27  1  0  0  0  0
  4 18  1  0  0  0  0
  4 28  1  0  0  0  0
  5 15  2  0  0  0  0
  6 16  2  0  0  0  0
  7 17  2  0  0  0  0
  8 18  2  0  0  0  0
  9 10  1  0  0  0  0
  9 11  1  0  0  0  0
  9 12  1  0  0  0  0
  9 19  1  0  0  0  0
 10 13  1  0  0  0  0
 10 14  1  0  0  0  0
 10 20  1  0  0  0  0
 11 12  1  0  0  0  0
 11 15  1  0  0  0  0
 11 21  1  0  0  0  0
 12 16  1  0  0  0  0
 12 22  1  0  0  0  0
 13 14  1  0  0  0  0
 13 17  1  0  0  0  0
 13 23  1  0  0  0  0
 14 18  1  0  0  0  0
 14 24  1  0  0  0  0
 29 33  2  0  0  0  0
 30 34  2  0  0  0  0
 31 33  1  0  0  0  0
 31 35  1  0  0  0  0
 31 36  1  0  0  0  0
 32 34  1  0  0  0  0
 32 37  1  0  0  0  0
 32 38  1  0  0  0  0
 33 34  1  0  0  0  0
 39 43  2  0  0  0  0
 40 44  2  0  0  0  0
 41 43  1  0  0  0  0
 41 45  1  0  0  0  0
 41 46  1  0  0  0  0
 42 44  1  0  0  0  0
 42 47  1  0  0  0  0
 42 48  1  0  0  0  0
 43 44  1  0  0  0  0
M  END
`,
      "",
      version,
    );

    const canonicalAtomIndicesByComponents =
      parseCanonicalAtomIndicesByComponents(auxinfo);

    const auxinfoParsed = parseAuxinfo(
      auxinfo,
      canonicalAtomIndicesByComponents,
    );

    expect(auxinfoParsed.get("gE")).toEqual(
      new Map([
        [1, 1],
        [2, 1],
        [3, 1],
        [4, 1],
      ]),
    );
  },
);
