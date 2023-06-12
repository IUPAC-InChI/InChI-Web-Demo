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

EXPORTED_FUNCTIONS = _inchi_from_molfile,_inchikey_from_inchi,_molfile_from_inchi,_malloc,_free
EXPORTED_RUNTIME_METHODS = ccall,cwrap,UTF8ToString,stringToUTF8,lengthBytesUTF8
LINKER_OPTIONS = -sEXPORTED_FUNCTIONS=$(EXPORTED_FUNCTIONS) -sEXPORTED_RUNTIME_METHODS=$(EXPORTED_RUNTIME_METHODS) -sEXPORT_NAME=$(MODULE_NAME) -sMODULARIZE -sENVIRONMENT=web -sSTACK_SIZE=1048576
# TODO:
# closure ...
# optimize ...

INCHI_SRCS = $(P_BASE)/ichi_bns.c	\
$(P_BASE)/ichi_io.c	\
$(P_BASE)/ichican2.c	\
$(P_BASE)/ichicano.c	\
$(P_BASE)/ichicans.c	\
$(P_BASE)/ichierr.c	\
$(P_BASE)/ichiprt3.c	\
$(P_BASE)/ichiisot.c	\
$(P_BASE)/ichimake.c	\
$(P_BASE)/ichiqueu.c	\
$(P_BASE)/ichiring.c	\
$(P_BASE)/ichierr.c	\
$(P_BASE)/ichimap1.c	\
$(P_BASE)/ichimap2.c	\
$(P_BASE)/ichimap4.c	\
$(P_BASE)/ichimak2.c	\
$(P_BASE)/ichinorm.c	\
$(P_BASE)/ichiparm.c	\
$(P_BASE)/ichiprt1.c	\
$(P_BASE)/ichiprt2.c	\
$(P_BASE)/ichirvr1.c	\
$(P_BASE)/ichirvr2.c	\
$(P_BASE)/ichirvr3.c	\
$(P_BASE)/ichirvr4.c	\
$(P_BASE)/ichirvr5.c	\
$(P_BASE)/ichirvr6.c	\
$(P_BASE)/ichirvr7.c	\
$(P_BASE)/ichisort.c	\
$(P_BASE)/ichister.c	\
$(P_BASE)/ichitaut.c	\
$(P_BASE)/ikey_base26.c	\
$(P_BASE)/ikey_dll.c	\
$(P_BASE)/mol_fmt1.c	\
$(P_BASE)/mol_fmt2.c	\
$(P_BASE)/mol_fmt3.c	\
$(P_BASE)/mol_fmt4.c	\
$(P_BASE)/readinch.c	\
$(P_BASE)/runichi.c	\
$(P_BASE)/runichi2.c	\
$(P_BASE)/runichi3.c	\
$(P_BASE)/runichi4.c	\
$(P_BASE)/sha2.c	\
$(P_BASE)/strutil.c	\
$(P_BASE)/util.c	\
$(P_BASE)/mol2atom.c	\
$(P_API)/ichilnct.c	\
$(P_API)/inchi_dll.c	\
$(P_API)/inchi_dll_a.c	\
$(P_API)/inchi_dll_a2.c	\
$(P_API)/inchi_dll_b.c	\
$(P_API)/inchi_dll_main.c	\
inchi_web.c

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
