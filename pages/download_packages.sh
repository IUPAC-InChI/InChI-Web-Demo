#!/bin/bash

# Run commands in subshells (i.e., ()) to avoid unintended interactions.

set -e
set -u


root_dir=$1  # Absolute path to the root directory of the project
readonly root_dir

source "${root_dir}/pages/utils.sh"

(
    download_package "${root_dir}/pages/jquery" "https://code.jquery.com/jquery-3.7.1.min.js"

    download_package "${root_dir}/pages/bootstrap" "https://github.com/twbs/bootstrap/releases/download/v5.2.3/bootstrap-5.2.3-dist.zip"

    download_package "${root_dir}/pages/bootstrap-icons" "https://github.com/twbs/icons/releases/download/v1.10.3/bootstrap-icons-1.10.3.zip"

    download_package "${root_dir}/pages/bootstrap-multiselect" "https://github.com/davidstutz/bootstrap-multiselect/archive/refs/tags/v1.1.2.zip"
)
