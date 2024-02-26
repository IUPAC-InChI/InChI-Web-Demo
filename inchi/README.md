# Building InChI to WebAssembly using Emscripten

## Traps

### `__isascii` (until InChI v1.06)
The `__isascii` function used in *INCHI-1-SRC/INCHI_BASE/src/util.c* needs to be provided by *ichicomp.h*. Fixed by [util.c.patch](util.c.patch). This problem [was previously identified in Richard Apodaca's Depth-First blog](https://depth-first.com/articles/2019/05/15/compiling-inchi-to-webassembly-part-1/). `__isascii` and `isascii` have never been part of the C standard and some implementations of the C standard library support it, for instance [the GNU C Library (glibc)](https://sourceware.org/glibc/manual/latest/html_node/Classification-of-Characters.html#index-isascii). On the other hand, Emscripten uses *musl* as its implementation of the C standard library, which has never adopted them.

### Emscripten's file system
[Emscripten's file system architecture](https://emscripten.org/docs/porting/files/file_systems_overview.html#) behaves a bit differently than what programmers expect from the C standard library. This becomes relevant when the *inchi-1.js* program compiled from *INCHI_EXE* running in a node.js runtime wants to interact with files in InChI's test suite (*INCHI-1-TEST*).

Solution: Addition of the linker flags `-lnodefs.js` and `-lnoderawfs.js` for the compilation of *INCHI_EXE*. Invocation of `NODEFS` is [well documented](https://emscripten.org/docs/api_reference/Filesystem-API.html#file-systems), but the article [does not mention `noderawfs.js` to be used for `NODERAWFS`](https://github.com/emscripten-core/emscripten/issues/15377#issuecomment-1285167486).

### Stack overflow in test *zzp-Polymers-FoldCRU-NPZZ*
With the WASM build one particular test in InChI's test suite fails with a stack overflow, namely *zzp-Polymers-FoldCRU-NPZZ* (see [inchify_zzp.sh](INCHI-1-TEST/inchify_zzp.sh)). The molecular structure in question is *ZZP059* in *zzp.sdf* (part of InChI's *INCHI-1-TEST/test/test-datasets.zip*).

Solution: Increase stack size using the linker flag `-sSTACK_SIZE` (default value is 65536; 1048576 is the lowest working value). This flag is also required for the *INCHI_WEB* build (can be reproduced by calling `inchiFromMolfile(molfileZZP059, "-Polymers -FoldCRU -NPZZ -AuxNone -OutErrINCHI -NoLabels", "1.06")` in the browser's JS console).

## *INCHI_WEB*: Emscripten bits and pieces

### Modularization and namespacing
We would like to include WASM compilations from different InChI versions on a single web page. Emscripten's [modularization concept](https://emscripten.org/docs/getting_started/FAQ.html#can-i-use-multiple-emscripten-compiled-programs-on-one-web-page) allows to rename modules and thus provides a simple way of "namespacing" JS variables. This has been applied by adding the linker flags `-sEXPORT_NAME` and `-sMODULARIZE` to the makefiles. The module name can be specified via the make variable `MODULE_NAME`.

With modularization enabled we have to initialize the module ourselves by calling its factory method (`module_name()`). The returned Promise object resolves with the actual module object and the exported runtime functions can be called with it.

### Reducing code size
* by using the linker flag [`-sENVIRONMENT=web`](https://emscripten.org/docs/getting_started/FAQ.html#can-i-build-javascript-that-only-runs-on-the-web)
* ... (TODO)
