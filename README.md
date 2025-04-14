# InChI-Web-Demo

## Local development

We recommend setting up our [development container](./.devcontainer.json) as a pre-configured local development environment.
For details on how to get started with the container see <https://containers.dev> and <https://code.visualstudio.com/docs/devcontainers/containers>.
When you're not using the development container, make sure that your environment supports the Emscripten toolchain (<https://github.com/emscripten-core/emsdk>).

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
