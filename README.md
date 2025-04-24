# InChI-Web-Demo

## Local development

We recommend setting up our [development container](./.devcontainer.json) as a pre-configured local development environment.
For details on how to get started with the container see <https://containers.dev> and <https://code.visualstudio.com/docs/devcontainers/containers>.
When you're not using the development container, make sure that your environment supports the Emscripten toolchain (<https://github.com/emscripten-core/emsdk>).

### Build

The web-demo is served from the `pages` directory.
Set up all required resources under pages by running

```shell
./pages/build_wasm_modules.sh $(pwd)
./pages/download_packages.sh $(pwd)
source ./pages/utils.sh
build_ketcher $(pwd)
```

from the root of the repository (the argument to the scripts must be the absolute path to the root of the project).

Once `pages` contains all resources, serve the web-demo locally on `localhost:8000` with

```shell
cd pages && python3 -m http.server
```

### Test

You find a test suite for the WASM modules under `test`.

Note that we're not aiming to comprehensively exercise the functionality of the modules under test. We leave that up to the underlying packages themselves (e.g., we rely on InChI's downstream test coverage). Rather, this directory contains smoke tests that aim to ensure successful compilation of the WASM modules.

The following commands are assumed to be run from within the `test` directory.
Install the test dependencies by running

```shell
yarn install
```

You can then run the entire suite with

```shell
yarn test
```

or a subset with

```shell
yarn run jest <path_to_test_file>
```
