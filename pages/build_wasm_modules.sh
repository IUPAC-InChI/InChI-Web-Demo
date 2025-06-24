#!/bin/bash

# Run commands in subshells (i.e., ()) to avoid unintended interactions.

set -e
set -u


root_dir=$1  # Absolute path to the root directory of the project
readonly root_dir

inchi_versions_file="${root_dir}/pages/inchi_versions.json"
readonly inchi_versions_file

source "${root_dir}/pages/utils.sh"

# Build InChI
build_inchi_wasm "1.06" "$inchi_versions_file" "$root_dir" "${root_dir}/inchi/util.c.patch"
build_inchi_wasm "1.07.3" "$inchi_versions_file" "$root_dir"
build_inchi_wasm "1.07.3 with Molecular inorganics" "$inchi_versions_file" "$root_dir"

# Build RInChI
build_rinchi_wasm "$root_dir"
