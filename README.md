# InChI-Web-Demo

## Local development

:warning:
We'll facilitate local development with a devcontainer in the future.
The following instructions are an interim solution (aka hack).
:warning:

The webdemo is served from the `pages` directory.
To serve the webdemo locally, `pages` needs to contain all resources that are [built on CI](.github/workflows/ci.yml).
`pages` already contains some of those resources, whereas others are missing.
The  missing resources are the ones that are listed in [pages/.gitignore](pages/.gitignore).
You can download the missing resources from the latest CI run (<https://github.com/IUPAC-InChI/InChI-Web-Demo/actions>) and copy them into `pages`.
Once `pages` contains all resources, you can serve the webdemo locally on `localhost:8000` with `cd pages && python3 -m http.server`.
