cmake_minimum_required(VERSION 3.15)
project(InchiWeb C)

# Enable POSIX extensions for strdup and newer InChI features
add_definitions(-D_GNU_SOURCE)

# Variables & Paths
set(INCHI_WEB_NAME "inchi-web-latest" CACHE STRING "Output filename")
set(MODULE_NAME "inchiModule" CACHE STRING "Emscripten module export name")

# Source directories
set(P_BASE "${CMAKE_CURRENT_SOURCE_DIR}/../INCHI_BASE/src")
set(P_API "${CMAKE_CURRENT_SOURCE_DIR}/../INCHI_API/libinchi/src")

# Source Collection
# Automatically include all .c files from the base and API directories
file(GLOB BASE_SOURCES "${P_BASE}/*.c")
file(GLOB API_SOURCES "${P_API}/*.c")
set(MAIN_SOURCE inchi_web.c)

add_executable(${INCHI_WEB_NAME} ${MAIN_SOURCE} ${BASE_SOURCES} ${API_SOURCES})

# Compiler Options & Definitions
target_include_directories(${INCHI_WEB_NAME} PRIVATE ${P_BASE} ${P_API})
target_compile_definitions(${INCHI_WEB_NAME} PRIVATE 
    COMPILE_ANSI_ONLY 
    TARGET_EXE_STANDALONE 
    TARGET_API_LIB
)

# Use gnu99 to support modern C features and POSIX functions like strdup
target_compile_options(${INCHI_WEB_NAME} PRIVATE -std=gnu99 -O3)

# Emscripten Linker Flags
if(EMSCRIPTEN)
    set(EXPORTED_FUNCTIONS "_inchi_from_molfile,_inchikey_from_inchi,_molfile_from_inchi,_molfile_from_auxinfo,_malloc,_free")
    set(EXPORTED_RUNTIME_METHODS "ccall,cwrap,UTF8ToString,stringToUTF8,lengthBytesUTF8")

    target_link_options(${INCHI_WEB_NAME} PRIVATE
        "-sEXPORTED_FUNCTIONS=${EXPORTED_FUNCTIONS}"
        "-sEXPORTED_RUNTIME_METHODS=${EXPORTED_RUNTIME_METHODS}"
        "-sEXPORT_NAME='${MODULE_NAME}'"
        "-sMODULARIZE"
        "-sENVIRONMENT=web,node"
        "-sSTACK_SIZE=2097152"
        "-O3"
    )

    # Set suffix to .js so Emscripten generates the required glue code
    set_target_properties(${INCHI_WEB_NAME} PROPERTIES SUFFIX ".js")

    # POST_BUILD: Deployment & Cleanup
    add_custom_command(TARGET ${INCHI_WEB_NAME} POST_BUILD
        # Create target directory if it doesn't exist
        COMMAND ${CMAKE_COMMAND} -E make_directory "${ARTIFACT_DIR}"
        COMMAND ${CMAKE_COMMAND} -E echo "Deploying artifacts to: ${ARTIFACT_DIR}"
        
        # Copy .js and .wasm files to the final destination
        COMMAND ${CMAKE_COMMAND} -E copy "${CMAKE_CURRENT_BINARY_DIR}/${INCHI_WEB_NAME}.js" "${ARTIFACT_DIR}/"
        COMMAND ${CMAKE_COMMAND} -E copy "${CMAKE_CURRENT_BINARY_DIR}/${INCHI_WEB_NAME}.wasm" "${ARTIFACT_DIR}/"
        
        # Cleanup original files in the build folder
        COMMAND ${CMAKE_COMMAND} -E remove "${CMAKE_CURRENT_BINARY_DIR}/${INCHI_WEB_NAME}.js"
        COMMAND ${CMAKE_COMMAND} -E remove "${CMAKE_CURRENT_BINARY_DIR}/${INCHI_WEB_NAME}.wasm"
        
        COMMENT "Relocating Wasm artifacts to InChI-Web-Demo/pages/inchi and cleaning build directory"
    )
endif()
