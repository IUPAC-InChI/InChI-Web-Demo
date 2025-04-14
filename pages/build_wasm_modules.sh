#!/bin/bash

# Run commands in subshells (i.e., ()) to avoid unintended interactions.

set -e
set -u


root_dir=$1  # Absolute path to the root directory of the project
readonly root_dir

source "${root_dir}/pages/utils.sh"

# Build InChI
(
    build_inchi_wasm "v1.06" "inchi-web106" "inchiModule106" "$root_dir" "${root_dir}/inchi/util.c.patch"

    build_inchi_wasm "v1.07.3" "inchi-web107" "inchiModule107" "$root_dir"

    build_inchi_wasm "orgmet" "inchi-web107-orgmet" "inchiModule107OrgMet" "$root_dir"
)

# Build RInChI
(
    build_rinchi_wasm "$root_dir"
)
