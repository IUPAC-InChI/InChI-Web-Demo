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

## Deployment

You can deploy the web-demo via GitHub actions.
Navigate to the "Deploy GitHub Pages" workflow in the "Actions" tab of the GitHub repository.
The workflow has a manual trigger,
i.e., you can deploy the web-demo with the [push of a button](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/manually-running-a-workflow).
For details regarding the deployment, have a look at the [workflow configuration](.github/workflows/ci.yml).

## Update an InChI version

The web-demo allows for the selection of different InChI versions.
Those versions are configured in [inchi_versions.json](./pages/inchi_versions.json).
Each version is pinned to a specific commit.
You can change the commit that's associated with a version by editing the version's `commit` entry.
Once you've changed the commit, you can re-compile the web-assembly module of the version:

```shell
source ./pages/utils.sh
build_inchi_wasm <version> pages/inchi_versions.json $(pwd)
```

where `<version>` can be any of the top-level keys in `inchi_versions.json`.
It's a good idea to subsequently [test the update locally](#test).
Once you're satisfied with the test results, you can [deploy the update](#deployment).
