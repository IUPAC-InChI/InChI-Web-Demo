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
(
    build_inchi_wasm $(jq -r '."1.06" | "\(.commit) \(.name) \(.module)"' "$inchi_versions_file") "$root_dir" "${root_dir}/inchi/util.c.patch"

    build_inchi_wasm $(jq -r '."1.07.3" | "\(.commit) \(.name) \(.module)"' "$inchi_versions_file") "$root_dir"

    build_inchi_wasm $(jq -r '."1.07.3 with Molecular inorganics" | "\(.commit) \(.name) \(.module)"' "$inchi_versions_file") "$root_dir"
)

# Build RInChI
(
    build_rinchi_wasm "$root_dir"
)
