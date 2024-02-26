ifndef C_COMPILER
	C_COMPILER   = emcc
endif
ifndef LINKER
	LINKER = emcc
endif
ifndef INCHI_WEB_NAME
	INCHI_WEB_NAME = inchi-web
endif
INCHI_WEB_JS = $(INCHI_WEB_NAME).js
INCHI_WEB_WASM = $(INCHI_WEB_NAME).wasm
ifndef MODULE_NAME
	MODULE_NAME = inchiModule
endif
ifndef P_BASE
	P_BASE = ../INCHI_BASE/src
endif
ifndef P_API
	P_API = ../INCHI_API/libinchi/src
endif
P_INCL = -I$(P_BASE)
C_COMPILER_OPTIONS = $(P_INCL) -ansi -DCOMPILE_ANSI_ONLY -DTARGET_EXE_STANDALONE -O3 -c

EXPORTED_FUNCTIONS = _inchi_from_molfile,_inchikey_from_inchi,_molfile_from_inchi,_molfile_from_auxinfo,_malloc,_free
EXPORTED_RUNTIME_METHODS = ccall,cwrap,UTF8ToString,stringToUTF8,lengthBytesUTF8
LINKER_OPTIONS = -sEXPORTED_FUNCTIONS=$(EXPORTED_FUNCTIONS) -sEXPORTED_RUNTIME_METHODS=$(EXPORTED_RUNTIME_METHODS) -sEXPORT_NAME=$(MODULE_NAME) -sMODULARIZE -sENVIRONMENT=web -sSTACK_SIZE=1048576
# TODO:
# closure ...
# optimize ...

INCHI_OBJS = ichi_bns.o	\
ichi_io.o	\
ichicano.o	\
ichican2.o	\
ichicans.o	\
ichierr.o	\
ichiisot.o	\
ichimake.o	\
ichimak2.o	\
ichimap1.o	\
ichimap2.o	\
ichimap4.o	\
ichinorm.o	\
ichiprt1.o	\
ichiprt2.o	\
ichiprt3.o	\
ichiqueu.o	\
ichiring.o	\
ichisort.o	\
ichister.o	\
ichitaut.o	\
ichiparm.o	\
ichiread.o	\
ichirvr1.o	\
ichirvr2.o	\
ichirvr3.o	\
ichirvr4.o	\
ichirvr5.o	\
ichirvr6.o	\
ichirvr7.o	\
ikey_base26.o	\
ikey_dll.o	\
mol_fmt1.o	\
mol_fmt2.o	\
mol_fmt3.o	\
mol_fmt4.o	\
mol2atom.o	\
readinch.o	\
runichi.o	\
runichi2.o	\
runichi3.o	\
runichi4.o	\
sha2.o	\
strutil.o	\
util.o	\
ichilnct.o	\
inchi_dll.o	\
inchi_dll_a.o	\
inchi_dll_a2.o	\
inchi_dll_b.o	\
inchi_dll_main.o	\
inchi_web.o

$(INCHI_WEB_JS): $(INCHI_OBJS)
	$(LINKER) $(LINKER_OPTIONS) -o $(INCHI_WEB_JS) $(INCHI_OBJS) -lm
%.o: $(P_BASE)/%.c
	$(C_COMPILER) $(C_COMPILER_OPTIONS) -DTARGET_API_LIB $<
%.o: $(P_API)/%.c
	$(C_COMPILER) $(C_COMPILER_OPTIONS) -DTARGET_API_LIB $<
%.o: %.c
	$(C_COMPILER) $(C_COMPILER_OPTIONS) $<
.PHONY: clean
clean:
	rm -f $(INCHI_WEB_JS) $(INCHI_WEB_WASM) $(INCHI_OBJS)
