// inchi.js assumes global availability of the inchi modules.
// That's why we need to inject the modules into the global scope before using inchi.js.
global.inchiModule106 = require("../pages/inchi/inchi-web106.js");
global.inchiModule107 = require("../pages/inchi/inchi-web107.js");
global.inchiModule107OrgMet = require("../pages/inchi/inchi-web107-orgmet.js");

const {
  inchiFromMolfile,
  inchikeyFromInchi,
  molfileFromInchi,
  molfileFromAuxinfo,
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

test.each([["1.06"], ["1.07.3"], ["1.07.3 with Molecular inorganics"]])(
  "InChI string from molfile with version %s",
  async (version) => {
    const result = await inchiFromMolfile(molfile, "", version);
    expect(result.inchi).toBe(inchiString);
  }
);

test.each([["1.06"], ["1.07.3"], ["1.07.3 with Molecular inorganics"]])(
  "InChI key from InChI string with version %s",
  async (version) => {
    const result = await inchikeyFromInchi(inchiString, version);
    expect(result.inchikey).toBe(inchiKey);
  }
);

test.each([["1.06"], ["1.07.3"], ["1.07.3 with Molecular inorganics"]])(
  "SDF from InChI string with version %s",
  async (version) => {
    const result = await molfileFromInchi(inchiString, "", version);
    expect(result.molfile).toBe(sdf);
  }
);

test.each([["1.06"], ["1.07.3"], ["1.07.3 with Molecular inorganics"]])(
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
