#!/bin/bash


download_package() {
    local artifact_dir=$1
    readonly artifact_dir
    local url=$2
    readonly url

    rm -rf "$artifact_dir"
    wget -P "$artifact_dir" "$url"
    local archive
    archive=$(find "$artifact_dir" -type f -name "*.zip")
    readonly archive
    if [ -n "$archive" ]; then
        unzip "$archive" -d "$artifact_dir"
    fi
}


build_ketcher() {
    local _root_dir=$1
    readonly _root_dir

    local source_dir="${_root_dir}/ketcher/react-app"
    readonly source_dir
    local artifact_dir="${_root_dir}/pages/ketcher"
    readonly artifact_dir

    cd "$source_dir" || exit

    yarn install --frozen-lockfile --non-interactive
    yarn run build

    rm -rf "$artifact_dir" && mkdir -p "$artifact_dir"
    cp -R build/* "$artifact_dir"
}


clone_inchi_source() {
    local commit=$1  # branch or tag
    readonly commit
    local target_dir=$2
    readonly target_dir

    # Download only INCHI-1-SRC from branch with git: https://stackoverflow.com/a/52269934
    git clone --no-checkout --depth 1 --branch "$commit" --single-branch --filter=tree:0 https://github.com/IUPAC-InChI/InChI.git "$target_dir"
    cd "$target_dir" || exit
    git sparse-checkout set --no-cone /INCHI-1-SRC
    git checkout
}


build_inchi_wasm() {
    local commit=$1  # branch or tag
    readonly commit
    local artifact_name=$2
    readonly artifact_name
    local module_name=$3  # FIXME: Use artifact_name
    readonly module_name
    local _root_dir=$4
    readonly _root_dir
    local patch_file=${5:-'no_patch'}
    readonly patch_file

    local source_dir="${_root_dir}/source/inchi"
    readonly source_dir
    local artifact_dir="${_root_dir}/pages/inchi"
    readonly artifact_dir

    rm -rf "${source_dir}/${artifact_name:?}" && mkdir -p "${source_dir}/${artifact_name}"
    if [ ! -d "$artifact_dir" ]; then
         mkdir -p "$artifact_dir"
    fi

    clone_inchi_source "$commit" "${source_dir}/${artifact_name}"

    if [ "$patch_file" != "no_patch" ]; then
        echo "Applying patch: $patch_file"
        git apply "$patch_file"
    fi

    # Build JavaScript and WASM modules
    cp -R "${_root_dir}/inchi/INCHI_WEB" INCHI-1-SRC
    cd INCHI-1-SRC/INCHI_WEB || exit
    make -j -f makefile INCHI_WEB_NAME="$artifact_name" MODULE_NAME="$module_name"
    make -f makefile clean
    cp "${artifact_name}.js" "${artifact_name}.wasm" "$artifact_dir"
}


build_rinchi_wasm() {
    local _root_dir=$1
    readonly _root_dir

    local source_dir="${_root_dir}/source/rinchi"
    readonly source_dir
    local artifact_dir="${_root_dir}/pages/rinchi"
    readonly artifact_dir

    rm -rf "$source_dir" && mkdir -p "$source_dir"
    rm -rf "$artifact_dir" && mkdir -p "$artifact_dir"

    # RInChI needs InChI source
    clone_inchi_source "v1.07.3" "${source_dir}/InChI"

    # Get RInChI source
    git clone --no-checkout --depth 1 --branch "main" --single-branch https://github.com/IUPAC-InChI/RInChI.git "${source_dir}/RInChI"
    cd "${source_dir}/RInChI" || exit
    # Use specific commit for reproducibility
    git checkout "46643428f8a547114466dc34ab847bfb890b836a"

    # Patch RInChI to enable emcc compilation
    git apply "${_root_dir}/rinchi/rinchi.patch"

    # Build JavaScript and WASM modules
    cd "${source_dir}/RInChI/src/rinchi_lib" || exit
    make -j -f Makefile-32bit
    cp librinchi-1.1.* "$artifact_dir"
}
