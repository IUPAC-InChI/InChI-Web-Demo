// rinchi.js assumes global availability of the rinchi module.
// That's why we need to inject the module into the global scope before using rinchi.js.
global.rinchiModule11 = require("../pages/rinchi/librinchi-1.1.js");

const {
  rinchiFromRxnfile,
  fileTextFromRinchi,
  rinchikeyFromRinchi,
} = require("../pages/rinchi.js");

const rxnfile = `$RXN

      RInChI1.00

  2  1
$MOL
Reactant1
  InChIV10                                     

  6  5  0  0  0  0  0  0  0  0  1 V2000
   -0.8250   -0.7557    0.0000 C   0  0  0     0  0  0  0  0  0
   -0.4125   -0.0412    0.0000 C   0  0  0     0  0  0  0  0  0
    0.4125   -0.0412    0.0000 C   0  0  0     0  0  0  0  0  0
    0.8250    0.6733    0.0000 C   0  0  0     0  0  0  0  0  0
   -0.6260    0.7557    0.0000 O   0  0  0     0  0  0  0  0  0
    0.8250   -0.7557    0.0000 Br  0  0  0     0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
  2  5  1  6  0  0  0
  3  4  1  0  0  0  0
  3  6  1  1  0  0  0
M  END
$MOL
Reactant2
  InChIV10                                     

  2  1  0  0  0  0  0  0  0  0  1 V2000
   -0.4125    0.0000    0.0000 Na  0  0  0     0  0  0  0  0  0
    0.4125    0.0000    0.0000 O   0  0  0     0  0  0  0  0  0
  1  2  1  0  0  0  0
M  END
$MOL
Product1
  InChIV10                                     

  5  5  0  0  0  0  0  0  0  0  1 V2000
   -1.1270   -0.5635    0.0000 C   0  0  0     0  0  0  0  0  0
   -0.4125   -0.1510    0.0000 C   0  0  0     0  0  0  0  0  0
    0.4125   -0.1510    0.0000 C   0  0  0     0  0  0  0  0  0
    1.1270   -0.5635    0.0000 C   0  0  0     0  0  0  0  0  0
    0.0000    0.5635    0.0000 O   0  0  0     0  0  0  0  0  0
  1  2  1  6  0  0  0
  2  3  1  0  0  0  0
  2  5  1  0  0  0  0
  3  4  1  1  0  0  0
  3  5  1  0  0  0  0
M  END
`;

const rauxinfo =
  "RAuxInfo=1.00.1/0/N:4,1,3,2,5/E:(1,2)(3,4)/it:im/rA:5nCCCCO/rB:N1;s2;P3;s2s3;/rC:-1.127,-.5635,0;-.4125,-.151,0;.4125,-.151,0;1.127,-.5635,0;0,.5635,0;<>0/N:4,1,3,2,6,5/it:im/rA:6nCCCCOBr/rB:s1;s2;s3;N2;P3;/rC:-.825,-.7557,0;-.4125,-.0412,0;.4125,-.0412,0;.825,.6733,0;-.626,.7557,0;.825,-.7557,0;!1/N:1;2/rA:2nNaO/rB:s1;/rC:-.4125,0,0;.4125,0,0;";

const rinchi =
  "RInChI=1.00.1S/C4H8O/c1-3-4(2)5-3/h3-4H,1-2H3/t3-,4?/m0/s1<>C4H9BrO/c1-3(5)4(2)6/h3-4,6H,1-2H3/t3-,4+/m1/s1!Na.H2O/h;1H2/q+1;/p-1/d-";

test("RInChI from RXNFile", async () => {
  const result = await rinchiFromRxnfile(
    rxnfile,
    false,
    "1.1-dev with InChI 1.07.3"
  );
  expect(result.rinchi).toBe(rinchi);
});

test("File text from RInChI", async () => {
  const result = await fileTextFromRinchi(
    rinchi,
    rauxinfo,
    "RXN",
    "1.1-dev with InChI 1.07.3"
  );
  expect(result.fileText).toBe(rxnfile);
});

test.each([
  [
    "L",
    "Long-RInChIKey=SA-BUHFF-PQXKWPLDPFFDJP-WUCPZUCCSA-N--JCYSVJNMXBWPHS-DMTCNVIQSA-N-HEMHJVSKTPXQMS-UHFFFAOYSA-M",
  ],
  [
    "S",
    "Short-RInChIKey=SA-BUHFF-PQXKWPLDPF-LSZRVNUIRJ-UHFFFADPSC-NIBFB-MCQMH-NUHFF-ZZZ",
  ],
  ["W", "Web-RInChIKey=UFEYRRLMNYPCDUWUI-MSZCBGVVHVRIXSA"],
])("RInChI key from RInChI with key type %s", async (keyType, expectedKey) => {
  const result = await rinchikeyFromRinchi(
    rinchi,
    keyType,
    "1.1-dev with InChI 1.07.3"
  );
  expect(result.rinchikey).toBe(expectedKey);
});
