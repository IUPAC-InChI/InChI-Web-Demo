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
    local commit=$1  # hash
    readonly commit
    local target_dir=$2
    readonly target_dir

    # Download only INCHI-1-SRC from commit with git: https://stackoverflow.com/a/52269934
    git clone --no-checkout --filter=tree:0 https://github.com/IUPAC-InChI/InChI.git "$target_dir"
    cd "$target_dir" || exit
    git fetch --depth 1 origin "$commit"
    git sparse-checkout set --no-cone /INCHI-1-SRC
    git checkout "$commit"
}

build_inchi_wasm() {
    (
        local version=$1
        readonly version
        local version_config_file=$2
        readonly version_config_file
        local _root_dir=$3
        readonly _root_dir
        local patch_file=${4:-'no_patch'}
        readonly patch_file

        # Parse version configuration file.
        local params
        params=$(jq -r --arg version "$version" '.[$version] | "\(.commit) \(.name) \(.module)"' "$version_config_file")
        local commit artifact_name module_name
        read -r commit artifact_name module_name <<< "$params"

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
    )
}


build_rinchi_wasm() {
    (
        local _root_dir=$1
        readonly _root_dir

        local source_dir="${_root_dir}/source/rinchi"
        readonly source_dir
        local artifact_dir="${_root_dir}/pages/rinchi"
        readonly artifact_dir

        rm -rf "$source_dir" && mkdir -p "$source_dir"
        rm -rf "$artifact_dir" && mkdir -p "$artifact_dir"

        # RInChI needs InChI source
        clone_inchi_source $(jq -r '."1.07.3".commit' "${_root_dir}/pages/inchi_versions.json")  "${source_dir}/InChI"

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
    )
}
