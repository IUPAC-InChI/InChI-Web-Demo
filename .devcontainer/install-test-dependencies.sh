#!/usr/bin/env bash
set -euo pipefail

npm install --global yarn

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root/test"

yarn install --frozen-lockfile
yarn playwright install --with-deps chromium
